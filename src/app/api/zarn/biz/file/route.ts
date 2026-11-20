import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {getPrivate,putPrivate,r2Configured} from '@/lib/r2';
import {nextBillDate,type BillRepeat} from '@/lib/biz';
// Adds a money entry (with an optional receipt file kept privately in R2), or pays a bill. Files are served only through here.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day=/^\d{4}-\d{2}-\d{2}$/;
const MAX=8*1024*1024;
const inline=new Set(['image/png','image/jpeg','image/webp','image/gif','application/pdf']);
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me||me.account_type==='guest'||!me.zarnAdmin)return fail('Only admins can use Business.',403);
 const form=await request.formData(),s=(k:string,max=2000)=>String(form.get(k)??'').trim().slice(0,max);
 const file=form.get('file'),upload=file instanceof File&&file.size>0?file:null,db=serviceClient();
 if(upload&&upload.size>MAX)return fail('Files must be under 8 MB.');
 if(upload&&!r2Configured())return fail('File storage isn’t set up yet.',503);
 const amount=Number(s('amount')),paid_on=s('paid_on');
 if(!(amount>0)||amount>1e12)return fail('Enter the amount.');
 if(!day.test(paid_on))return fail('Pick the date.');
 const store=async()=>{
  if(!upload)return {file_key:'',file_name:'',file_size:0,file_type:''};
  const name=upload.name.replace(/[^\w.\- ]+/g,'').slice(-120)||'receipt';
  const key=await putPrivate(`zarn/business/${paid_on.slice(0,7)}/${crypto.randomUUID()}-${name}`,new Uint8Array(await upload.arrayBuffer()),upload.type||'application/octet-stream',name);
  return {file_key:key,file_name:name,file_size:upload.size,file_type:upload.type||''};
 };
 try{
  if(s('kind')==='pay_bill'){
   const billId=s('bill_id');if(!uuid.test(billId))return fail('Not found.',404);
   const {data:bill}=await db.from('zarn_bills').select('*').eq('id',billId).maybeSingle();if(!bill)return fail('That bill is gone.',404);
   const f=await store();
   const {error}=await db.from('zarn_client_receipts').insert({direction:'out',title:bill.title,vendor:bill.vendor,category:bill.category,amount:Math.round(amount*100)/100,currency:bill.currency,paid_on,lead_id:bill.lead_id,bill_id:bill.id,note:s('note'),...f,created_by:me.user_id});
   if(error)throw new Error(error.message);
   // A repeating bill moves to its next date; a one-off is done.
   const next=bill.due_on?nextBillDate(bill.due_on,bill.repeat as BillRepeat,bill.start_on):null;
   await db.from('zarn_bills').update({last_paid_on:paid_on,due_on:next,reminded_for:null}).eq('id',bill.id);
   return Response.json({ok:true,next});
  }
  const direction=s('direction'),title=s('title',160),lead=s('lead_id');
  if(direction!=='in'&&direction!=='out')return fail('Choose money in or money out.');
  if(!title)return fail('Say what it was for.');
  const f=await store();
  const {error}=await db.from('zarn_client_receipts').insert({direction,title,amount:Math.round(amount*100)/100,currency:s('currency',4)||'NGN',paid_on,category:s('category',60),vendor:s('vendor',160),note:s('note'),lead_id:uuid.test(lead)?lead:null,...f,created_by:me.user_id});
  if(error)throw new Error(error.message);
  return Response.json({ok:true});
 }catch{return fail('Could not save. Try again.',502);}
}
export async function GET(request:Request){
 const me=await zarnMember();if(!me||me.account_type==='guest'||!me.zarnAdmin)return new Response('Not found',{status:404});
 const rowId=new URL(request.url).searchParams.get('id')??'';if(!uuid.test(rowId))return new Response('Not found',{status:404});
 const {data:row}=await serviceClient().from('zarn_client_receipts').select('file_key,file_name,file_type').eq('id',rowId).maybeSingle();
 if(!row?.file_key)return new Response('Not found',{status:404});
 try{
  const f=await getPrivate(row.file_key),show=inline.has(row.file_type);
  return new Response(f.body,{headers:{'Content-Type':show?row.file_type:'application/octet-stream','Content-Disposition':`${show?'inline':'attachment'}; filename="${row.file_name.replace(/["\\\r\n]/g,'')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('Not found',{status:404});}
}
