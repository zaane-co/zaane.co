import {z} from 'zod';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {deleteFile} from '@/lib/r2';
import {emailBase} from '@/lib/site';
import {settings} from '@/lib/content';
import {billRepeats,contactSources} from '@/lib/biz';
import {currencies,paymentMethods,invoiceTotals,money,fmtDate} from '@/lib/crm';
import {bankColumns,pickAccount,type BankAccount} from '@/lib/bank';
// ZARN Business: its own contacts, invoices, money book and bills, separate from Clients. Admin-only.
// Files (receipts) are added through /api/zarn/biz/file.
const id=z.uuid(),day=z.iso.date(),cur=z.string().trim().min(3).max(4);
const contact={name:z.string().trim().min(1,'Enter a name.').max(160),email:z.union([z.literal(''),z.email('Enter a valid email.').max(254)]).default(''),company:z.string().trim().max(200).default(''),phone:z.string().trim().max(40).default(''),stage:z.enum(['new','contacted','proposal','won','lost']).default('new'),source:z.enum(contactSources).default('manual'),value:z.number().min(0).max(1e12).nullable().default(null),currency:cur.default('NGN'),note:z.string().trim().max(5000).default('')};
const item=z.object({description:z.string().trim().min(1,'Every line needs a description.').max(500),qty:z.number().positive('Quantities must be above zero.').max(1e6),unit_price:z.number().min(0).max(1e12)});
const invoice={contact_id:id,currency:z.enum(currencies),issue_date:day,due_date:day,items:z.array(item).max(100),tax_rate:z.number().min(0).max(100),discount:z.number().min(0).max(1e12),notes:z.string().trim().max(5000),bank_account_id:id.nullable()};
const bill={title:z.string().trim().min(1,'Name the bill.').max(160),vendor:z.string().trim().max(160).default(''),amount:z.number().positive('Enter the amount.').max(1e12),currency:cur,category:z.string().trim().max(60).default(''),due_on:day.nullable(),repeat:z.enum(billRepeats),note:z.string().trim().max(2000).default('')};
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('contacts')}),
 z.object({action:z.literal('contact_save'),id:id.optional(),...contact}),
 z.object({action:z.literal('contact_stage'),id,stage:contact.stage}),
 z.object({action:z.literal('contact_delete'),id}),
 z.object({action:z.literal('invoice_save'),id:id.optional(),...invoice}),
 z.object({action:z.literal('invoice_status'),id,to:z.enum(['sent','void','reopen'])}),
 z.object({action:z.literal('invoice_send'),id,message:z.string().trim().max(5000).optional()}),
 z.object({action:z.literal('invoice_duplicate'),id}),
 z.object({action:z.literal('invoice_delete'),id}),
 z.object({action:z.literal('payment_add'),invoice_id:id,amount:z.number().positive('Enter an amount.').max(1e12),paid_on:day,method:z.enum(paymentMethods),note:z.string().trim().max(500).optional()}),
 z.object({action:z.literal('payment_delete'),id}),
 z.object({action:z.literal('money'),from:day}),
 z.object({action:z.literal('entry_update'),id,title:z.string().trim().min(1).max(160),amount:z.number().positive().max(1e12),currency:cur,paid_on:day,category:z.string().trim().max(60),vendor:z.string().trim().max(160),note:z.string().trim().max(2000)}),
 z.object({action:z.literal('entry_delete'),id}),
 z.object({action:z.literal('bills')}),
 z.object({action:z.literal('bill_save'),id:id.optional(),...bill}),
 z.object({action:z.literal('bill_delete'),id}),
]);
const fail=(error:string,status=400)=>Response.json({error},{status});
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const ENTRY='id,direction,title,amount,currency,paid_on,category,vendor,note,contact_id,bill_id,file_name,file_size,file_type,created_at';
type Db=ReturnType<typeof serviceClient>;
// Paid amount and status always come from the payments, never from the editor.
async function settle(db:Db,inv:string){
 const [{data:i},{data:p}]=await Promise.all([db.from('zarn_biz_invoices').select('status,total,paid_at').eq('id',inv).single(),db.from('zarn_biz_payments').select('amount').eq('invoice_id',inv)]);
 if(!i)return;const paid=(p??[]).reduce((t,x)=>t+Number(x.amount),0),full=paid>=Number(i.total)&&Number(i.total)>0;
 await db.from('zarn_biz_invoices').update({amount_paid:paid,status:i.status==='void'?'void':full?'paid':i.status==='paid'?'sent':i.status,paid_at:full?i.paid_at??new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',inv);
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me)return fail('Sign in first.',401);
 if(me.account_type==='guest'||!me.zarnAdmin)return fail('Only admins can use Business.',403);
 const parsed=actions.safeParse(await request.json().catch(()=>null));if(!parsed.success)return fail(parsed.error.issues[0]?.message||'Invalid request');
 const b=parsed.data,db=serviceClient(),now=new Date().toISOString();
 const loadInv=async(i:string)=>(await db.from('zarn_biz_invoices').select('*').eq('id',i).maybeSingle()).data;
 switch(b.action){
  case 'contacts':{
   const {data,error}=await db.from('zarn_biz_contacts').select('*').order('created_at',{ascending:false}).limit(2000);
   if(error)return fail('Business isn’t set up yet. The database update still needs to be applied.',503);
   return Response.json({contacts:data});
  }
  case 'contact_save':{
   const {id:rowId,...v}=b;const row={...v,email:v.email.toLowerCase()};
   const res=rowId?await db.from('zarn_biz_contacts').update({...row,updated_at:now}).eq('id',rowId).select('id').single():await db.from('zarn_biz_contacts').insert({...row,created_by:me.user_id}).select('id').single();
   return res.error?fail('Could not save the contact.'):Response.json({ok:true,id:res.data.id});
  }
  case 'contact_stage':{
   const {error}=await db.from('zarn_biz_contacts').update({stage:b.stage,updated_at:now}).eq('id',b.id);
   return error?fail('Could not move the contact.'):Response.json({ok:true});
  }
  case 'contact_delete':{
   const {count}=await db.from('zarn_biz_invoices').select('id',{count:'exact',head:true}).eq('contact_id',b.id);
   if(count)return fail('This contact has invoices. Delete or reassign those first.',409);
   await db.from('zarn_biz_contacts').delete().eq('id',b.id);
   return Response.json({ok:true});
  }
  case 'invoice_save':{
   const {id:rowId,...v}=b;
   if(v.due_date<v.issue_date)return fail('The due date can’t be before the issue date.');
   const t=invoiceTotals(v.items,v.tax_rate,v.discount),row={...v,subtotal:t.subtotal,total:t.total};
   if(rowId){
    const cur=await loadInv(rowId);if(!cur)return fail('Invoice not found.',404);
    if(cur.status==='paid'||cur.status==='void')return fail('This invoice is closed. Reopen it to edit.');
    const {error}=await db.from('zarn_biz_invoices').update({...row,updated_at:now}).eq('id',rowId);if(error)return fail('Could not save the invoice.');
    await settle(db,rowId);return Response.json({ok:true,id:rowId});
   }
   const {data,error}=await db.from('zarn_biz_invoices').insert({...row,created_by:me.user_id}).select('id').single();
   return error?fail('Could not create the invoice.'):Response.json({ok:true,id:data.id});
  }
  case 'invoice_status':{
   const cur=await loadInv(b.id);if(!cur)return fail('Invoice not found.',404);
   const upd=b.to==='sent'?{status:'sent',sent_at:cur.sent_at??now}:b.to==='void'?{status:'void'}:{status:cur.sent_at?'sent':'draft'};
   await db.from('zarn_biz_invoices').update({...upd,updated_at:now}).eq('id',b.id);
   if(b.to==='reopen')await settle(db,b.id);
   return Response.json({ok:true});
  }
  case 'invoice_send':{
   const inv=await loadInv(b.id);if(!inv)return fail('Invoice not found.',404);
   if(inv.status==='void'||inv.status==='paid')return fail('This invoice is closed.');
   if(!inv.items.length||Number(inv.total)<=0)return fail('Add at least one priced line before sending.');
   const {data:c}=await db.from('zarn_biz_contacts').select('name,email').eq('id',inv.contact_id).single();
   if(!c?.email)return fail('This contact has no email address. Add one under Leads first.');
   const key=process.env.RESEND_API_KEY,inbox=process.env.CRM_FROM_EMAIL||process.env.LEAD_NOTIFICATION_EMAIL;
   if(!key||!inbox)return fail('Email isn’t set up. Set RESEND_API_KEY and LEAD_NOTIFICATION_EMAIL.',503);
   const link=`${emailBase()}/invoice/b/${inv.public_token}`,cfg=await settings(),from=cfg.invoice_from?.split('\n')[0]||'Zaane';
   const owed=money(Number(inv.total)-Number(inv.amount_paid),inv.currency);
   const {data:bank}=await db.from('bank_accounts').select(bankColumns);
   const acct=pickAccount((bank??[]) as BankAccount[],inv.currency,inv.bank_account_id);
   const lines=acct?([['Bank',acct.bank],['Account name',acct.account_name],['Account number',acct.account_number],['Other',acct.extra]].filter(([,v])=>v) as [string,string][]):[];
   const intro=b.message||`Hi ${c.name.split(' ')[0]},\n\nPlease find invoice ${inv.number} for ${owed}, due ${fmtDate(inv.due_date)}.`;
   const rows=(inv.items as {description:string;qty:number;unit_price:number}[]).map(i=>`<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(i.description)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${i.qty} × ${esc(money(i.unit_price,inv.currency))}</td></tr>`).join('');
   const bankHtml=lines.length?`<div style="background:#f4f4f5;border-radius:10px;padding:14px 16px;margin:0 0 20px;font-size:14px"><p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;color:#71717a">Pay to</p>${lines.map(([k,v])=>`<div><span style="color:#71717a">${esc(k)}:</span> <b>${esc(v)}</b></div>`).join('')}<div><span style="color:#71717a">Reference:</span> <b>${esc(inv.number)}</b></div></div>`:'';
   const html=`<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:560px">${esc(intro).replace(/\n/g,'<br>')}<table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">${rows}<tr><td style="padding:12px 0;font-weight:700">Amount due</td><td style="padding:12px 0;text-align:right;font-weight:700">${esc(owed)}</td></tr></table>${bankHtml}<a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">View invoice</a></div>`;
   const text=`${intro}${lines.length?`\n\nPay to:\n${lines.map(([k,v])=>`${k}: ${v}`).join('\n')}\nReference: ${inv.number}`:''}\n\nView invoice: ${link}`;
   const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from:`${from} <${inbox}>`,to:[c.email],bcc:[inbox],reply_to:inbox,subject:`Invoice ${inv.number} from ${from}`,text,html})});
   const sent=await r.json().catch(()=>({}));
   if(!r.ok)return fail(sent.message?`Email failed: ${sent.message}`:'Email failed to send.',502);
   await db.from('zarn_biz_invoices').update({status:'sent',sent_at:now,updated_at:now}).eq('id',inv.id);
   return Response.json({ok:true,to:c.email});
  }
  case 'invoice_duplicate':{
   const inv=await loadInv(b.id);if(!inv)return fail('Invoice not found.',404);
   const {data,error}=await db.from('zarn_biz_invoices').insert({contact_id:inv.contact_id,currency:inv.currency,items:inv.items,tax_rate:inv.tax_rate,discount:inv.discount,subtotal:inv.subtotal,total:inv.total,notes:inv.notes,bank_account_id:inv.bank_account_id,created_by:me.user_id}).select('id').single();
   return error?fail('Could not duplicate.'):Response.json({ok:true,id:data.id});
  }
  case 'invoice_delete':{
   const inv=await loadInv(b.id);if(!inv)return fail('Invoice not found.',404);
   if(inv.status!=='draft'&&inv.status!=='void')return fail('Only drafts and void invoices can be deleted.');
   await db.from('zarn_biz_invoices').delete().eq('id',b.id);
   return Response.json({ok:true});
  }
  case 'payment_add':{
   const inv=await loadInv(b.invoice_id);if(!inv)return fail('Invoice not found.',404);
   if(inv.status!=='sent')return fail('Payments can only be added to a sent invoice.');
   const {error}=await db.from('zarn_biz_payments').insert({invoice_id:inv.id,amount:Math.round(b.amount*100)/100,paid_on:b.paid_on,method:b.method,note:b.note??'',created_by:me.user_id});
   if(error)return fail('Could not record the payment.');
   await settle(db,inv.id);return Response.json({ok:true});
  }
  case 'payment_delete':{
   const {data:p}=await db.from('zarn_biz_payments').select('invoice_id').eq('id',b.id).maybeSingle();if(!p)return fail('Not found.',404);
   await db.from('zarn_biz_payments').delete().eq('id',b.id);await settle(db,p.invoice_id);
   return Response.json({ok:true});
  }
  case 'money':{
   // Our own entries plus payments recorded on Business invoices.
   const [{data:rows,error},{data:pays},{data:people}]=await Promise.all([
    db.from('zarn_biz_entries').select(ENTRY).gte('paid_on',b.from).order('paid_on',{ascending:false}).limit(5000),
    db.from('zarn_biz_payments').select('id,amount,paid_on,method,note,created_at,invoice_id,zarn_biz_invoices(number,currency,contact_id)').gte('paid_on',b.from).order('paid_on',{ascending:false}).limit(5000),
    db.from('zarn_biz_contacts').select('id,name,company').order('name'),
   ]);
   if(error)return fail('Business isn’t set up yet. The database update still needs to be applied.',503);
   const who=new Map((people??[]).map(c=>[c.id,c.company||c.name]));
   const entries=(rows??[]).map(r=>({...r,invoice_id:null,source:'entry',contact:r.contact_id?who.get(r.contact_id)??'':''}));
   const fromInvoices=(pays??[]).map(p=>{const inv=p.zarn_biz_invoices as unknown as {number:string;currency:string;contact_id:string}|null;
    return {id:p.id,direction:'in',title:`Invoice ${inv?.number??''}`.trim(),amount:Number(p.amount),currency:inv?.currency??'NGN',paid_on:p.paid_on,category:'Customer payment',vendor:'',note:[p.method,p.note].filter(Boolean).join(' · '),contact_id:inv?.contact_id??null,invoice_id:p.invoice_id,bill_id:null,file_name:'',file_size:0,file_type:'',created_at:p.created_at,source:'invoice',contact:inv?.contact_id?who.get(inv.contact_id)??'':''};});
   return Response.json({entries:[...entries,...fromInvoices].sort((x,y)=>y.paid_on.localeCompare(x.paid_on)||y.created_at.localeCompare(x.created_at)),contacts:(people??[]).map(c=>({id:c.id,name:c.company||c.name}))});
  }
  case 'entry_update':{
   const {id:rowId,...v}=b;
   const {error}=await db.from('zarn_biz_entries').update({...v,amount:Math.round(v.amount*100)/100}).eq('id',rowId);
   return error?fail('Could not save.'):Response.json({ok:true});
  }
  case 'entry_delete':{
   const {data:row}=await db.from('zarn_biz_entries').select('file_key').eq('id',b.id).maybeSingle();if(!row)return fail('Not found.',404);
   if(row.file_key)await deleteFile(row.file_key).catch(()=>{});
   await db.from('zarn_biz_entries').delete().eq('id',b.id);
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
 }
}
