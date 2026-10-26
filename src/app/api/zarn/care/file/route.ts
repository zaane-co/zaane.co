import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {clientAccess,isStudioAdmin} from '@/lib/zarn-clients';
import {getPrivate,putPrivate,r2Configured} from '@/lib/r2';
import {nextFrom,type Repeat} from '@/lib/zarn-care';
// Receipts (admin-only) and deliveries, each with an optional file kept privately in R2 and served only through here.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day=/^\d{4}-\d{2}-\d{2}$/;
const MAX=4*1024*1024;
// Only these open in the browser; anything else downloads.
const inline=new Set(['image/png','image/jpeg','image/webp','image/gif','application/pdf']);
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me||me.account_type==='guest')return fail('Sign in first.',401);
 const form=await request.formData(),s=(k:string,max=2000)=>String(form.get(k)??'').trim().slice(0,max);
 const kind=s('kind'),file=form.get('file'),db=serviceClient();
 const upload=file instanceof File&&file.size>0?file:null;
 if(upload&&upload.size>MAX)return fail('Files must be under 4 MB.');
 if(upload&&!r2Configured())return fail('File storage isn’t set up yet.',503);
 const store=async(lead:string)=>{
  if(!upload)return {file_key:'',file_name:'',file_size:0,file_type:''};
  const name=upload.name.replace(/[^\w.\- ]+/g,'').slice(-120)||'file';
  const key=await putPrivate(`zarn/care/${lead}/${crypto.randomUUID()}-${name}`,new Uint8Array(await upload.arrayBuffer()),upload.type||'application/octet-stream',name);
  return {file_key:key,file_name:name,file_size:upload.size,file_type:upload.type||''};
 };
 if(kind==='receipt'){
  if(!isStudioAdmin(me))return fail('Only admins can add receipts.',403);
  const lead=s('lead_id'),direction=s('direction'),title=s('title',160),amount=Number(s('amount')),currency=s('currency',4)||'NGN',paid_on=s('paid_on'),invoice=s('invoice_id');
  if(!uuid.test(lead)||!(await clientAccess(me,lead)).allowed)return fail('No access.',403);
  if(direction!=='in'&&direction!=='out')return fail('Choose who paid.');
  if(!title)return fail('Say what the payment was for.');
  if(!(amount>0)||amount>1e12)return fail('Enter the amount.');
  if(!day.test(paid_on))return fail('Pick the payment date.');
  let invoice_id:string|null=null;
  if(direction==='in'&&uuid.test(invoice)){const {data:inv}=await db.from('invoices').select('id').eq('id',invoice).eq('lead_id',lead).maybeSingle();invoice_id=inv?.id??null;}
  try{
   const f=await store(lead);
   const {error}=await db.from('zarn_client_receipts').insert({lead_id:lead,direction,title,amount:Math.round(amount*100)/100,currency,paid_on,invoice_id,note:s('note'),...f,created_by:me.user_id});
   if(error)throw new Error();
   return Response.json({ok:true});
  }catch{return fail('Could not save the receipt.',502);}
 }
 if(kind==='delivery'){
  const delId=s('deliverable_id'),delivered_on=s('delivered_on');
  if(!uuid.test(delId))return fail('Not found.',404);
  if(!day.test(delivered_on))return fail('Pick the delivery date.');
  const {data:d}=await db.from('zarn_client_deliverables').select('*').eq('id',delId).maybeSingle();
  if(!d||!(await clientAccess(me,d.lead_id)).allowed)return fail('Not found.',404);
  try{
   const f=await store(d.lead_id);
   const {error}=await db.from('zarn_deliverable_log').insert({deliverable_id:d.id,lead_id:d.lead_id,due_on:d.next_on,delivered_on,note:s('note'),...f,delivered_by:me.user_id});
   if(error)throw new Error();
   // Delivered: a one-off is finished, a repeating one moves to its next date after this cycle.
   if(d.next_on){
    const from=d.next_on>delivered_on?d.next_on:delivered_on;
    const next=d.repeat==='none'||!d.start_on?null:nextFrom(d.start_on,d.repeat as Repeat,d.every_n,from,true);
    await db.from('zarn_client_deliverables').update({next_on:next}).eq('id',d.id);
   }
   return Response.json({ok:true});
  }catch{return fail('Could not log the delivery.',502);}
 }
 return fail('Unknown upload.');
}
export async function GET(request:Request){
 const me=await zarnMember();if(!me||me.account_type==='guest')return new Response('Sign in first.',{status:401});
 const q=new URL(request.url).searchParams,id=q.get('id')??'',kind=q.get('kind');
 if(!uuid.test(id)||(kind!=='receipt'&&kind!=='delivery'))return new Response('Not found',{status:404});
 if(kind==='receipt'&&!isStudioAdmin(me))return new Response('Not found',{status:404});
 const db=serviceClient();
 const {data:row}=await db.from(kind==='receipt'?'zarn_client_receipts':'zarn_deliverable_log').select('lead_id,file_key,file_name,file_type').eq('id',id).maybeSingle();
 if(!row?.file_key||!(await clientAccess(me,row.lead_id)).allowed)return new Response('Not found',{status:404});
 try{
  const f=await getPrivate(row.file_key),show=inline.has(row.file_type);
  return new Response(f.body,{headers:{'Content-Type':show?row.file_type:'application/octet-stream','Content-Disposition':`${show?'inline':'attachment'}; filename="${row.file_name.replace(/["\\\r\n]/g,'')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('Not found',{status:404});}
}
