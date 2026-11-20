import {z} from 'zod';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {deleteFile} from '@/lib/r2';
import {billRepeats} from '@/lib/biz';
// ZARN Business: the money book, receipts and bills. Money is admin-only in ZARN, so every action checks that first.
// Files are added through /api/zarn/biz/file.
const id=z.uuid(),day=z.iso.date();
const bill={title:z.string().trim().min(1,'Name the bill.').max(160),vendor:z.string().trim().max(160).default(''),amount:z.number().positive('Enter the amount.').max(1e12),currency:z.string().trim().min(3).max(4),category:z.string().trim().max(60).default(''),due_on:day.nullable(),repeat:z.enum(billRepeats),note:z.string().trim().max(2000).default('')};
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('money'),from:day}),
 z.object({action:z.literal('entry_update'),id,title:z.string().trim().min(1).max(160),amount:z.number().positive().max(1e12),currency:z.string().trim().min(3).max(4),paid_on:day,category:z.string().trim().max(60),vendor:z.string().trim().max(160),note:z.string().trim().max(2000)}),
 z.object({action:z.literal('entry_delete'),id}),
 z.object({action:z.literal('bills')}),
 z.object({action:z.literal('bill_save'),id:id.optional(),...bill}),
 z.object({action:z.literal('bill_delete'),id}),
 z.object({action:z.literal('leads')}),
]);
const fail=(error:string,status=400)=>Response.json({error},{status});
const ENTRY='id,direction,title,amount,currency,paid_on,category,vendor,note,lead_id,invoice_id,bill_id,file_name,file_size,file_type,created_at';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me)return fail('Sign in first.',401);
 if(me.account_type==='guest'||!me.zarnAdmin)return fail('Only admins can use Business.',403);
 const parsed=actions.safeParse(await request.json().catch(()=>null));if(!parsed.success)return fail(parsed.error.issues[0]?.message||'Invalid request');
 const b=parsed.data,db=serviceClient();
 switch(b.action){
  case 'money':{
   // Everything that moved since `from`: our own entries plus payments recorded on invoices.
   const [{data:rows,error},{data:pays},{data:leads}]=await Promise.all([
    db.from('zarn_client_receipts').select(ENTRY).gte('paid_on',b.from).order('paid_on',{ascending:false}).limit(5000),
    db.from('invoice_payments').select('id,amount,paid_on,method,note,created_at,invoice_id,invoices(number,currency,lead_id)').gte('paid_on',b.from).order('paid_on',{ascending:false}).limit(5000),
    db.from('leads').select('id,name,company'),
   ]);
   if(error)return fail('Business isn’t set up yet. The database update still needs to be applied.',503);
   const who=new Map((leads??[]).map(l=>[l.id,l.company||l.name]));
   const paidInvoices=new Set((pays??[]).map(p=>p.invoice_id));
   const entries=(rows??[]).map(r=>({...r,source:'entry',client:r.lead_id?who.get(r.lead_id)??'':'',counted:!(r.invoice_id&&paidInvoices.has(r.invoice_id))}));
   const fromInvoices=(pays??[]).map(p=>{const inv=p.invoices as unknown as {number:string;currency:string;lead_id:string}|null;
    return {id:p.id,direction:'in',title:`Invoice ${inv?.number??''}`.trim(),amount:Number(p.amount),currency:inv?.currency??'NGN',paid_on:p.paid_on,category:'Client payment',vendor:'',note:[p.method,p.note].filter(Boolean).join(' · '),lead_id:inv?.lead_id??null,invoice_id:p.invoice_id,bill_id:null,file_name:'',file_size:0,file_type:'',created_at:p.created_at,source:'invoice',client:inv?.lead_id?who.get(inv.lead_id)??'':'',counted:true};});
   return Response.json({entries:[...entries,...fromInvoices].sort((x,y)=>y.paid_on.localeCompare(x.paid_on)||y.created_at.localeCompare(x.created_at)),clients:(leads??[]).map(l=>({id:l.id,name:l.company||l.name}))});
  }
  case 'entry_update':{
   const {id:rowId,...v}=b;
   const {error}=await db.from('zarn_client_receipts').update({...v,amount:Math.round(v.amount*100)/100}).eq('id',rowId);
   return error?fail('Could not save.'):Response.json({ok:true});
  }
  case 'entry_delete':{
   const {data:cur}=await db.from('zarn_client_receipts').select('file_key').eq('id',b.id).maybeSingle();if(!cur)return fail('Not found.',404);
   if(cur.file_key)await deleteFile(cur.file_key).catch(()=>{});
   await db.from('zarn_client_receipts').delete().eq('id',b.id);
   return Response.json({ok:true});
  }
  case 'bills':{
   const {data,error}=await db.from('zarn_bills').select('*').order('due_on',{nullsFirst:false});
   if(error)return fail('Bills aren’t set up yet. The database update still needs to be applied.',503);
   return Response.json({bills:data});
  }
  case 'bill_save':{
   const {id:rowId,...v}=b;
   const row={...v,amount:Math.round(v.amount*100)/100,start_on:v.repeat==='none'?null:v.due_on};
   const {error}=rowId?await db.from('zarn_bills').update({...row,reminded_for:null}).eq('id',rowId):await db.from('zarn_bills').insert({...row,created_by:me.user_id});
   return error?fail('Could not save the bill.'):Response.json({ok:true});
  }
  case 'bill_delete':{
   await db.from('zarn_bills').delete().eq('id',b.id);
   return Response.json({ok:true});
  }
  case 'leads':{
   const {data}=await db.from('leads').select('id,name,email,company,phone,source,status,message,service_interested,created_at').order('created_at',{ascending:false}).limit(200);
   return Response.json({leads:data??[]});
  }
 }
}
