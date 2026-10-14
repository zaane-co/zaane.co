import {z} from 'zod';
import {emailBase} from '@/lib/site';
import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import {settings} from '@/lib/content';
import {currencies,paymentMethods,invoiceTotals,money,fmtDate} from '@/lib/crm';
const id=z.uuid();
const date=z.iso.date();
const item=z.object({description:z.string().trim().min(1,'Every line needs a description.').max(500),qty:z.number().positive('Quantities must be above zero.').max(1e6),unit_price:z.number().min(0).max(1e12)});
const values=z.object({lead_id:id,currency:z.enum(currencies),issue_date:date,due_date:date,items:z.array(item).max(100),tax_rate:z.number().min(0).max(100),discount:z.number().min(0).max(1e12),notes:z.string().trim().max(5000)});
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),lead_id:id}),
 z.object({action:z.literal('create_with_client'),client:z.object({name:z.string().trim().min(1,'Enter the client’s name.').max(120),email:z.email('Enter a valid email.').max(254),company:z.string().trim().max(200),phone:z.string().trim().max(40)}),currency:z.enum(currencies)}),
 z.object({action:z.literal('save'),id,values}),
 z.object({action:z.literal('send'),id,message:z.string().trim().max(5000).optional()}),
 z.object({action:z.literal('mark_sent'),id}),
 z.object({action:z.literal('void'),id}),
 z.object({action:z.literal('reopen'),id}),
 z.object({action:z.literal('delete'),id}),
 z.object({action:z.literal('duplicate'),id}),
 z.object({action:z.literal('payment_add'),invoice_id:id,amount:z.number().positive('Enter an amount.').max(1e12),paid_on:date,method:z.enum(paymentMethods),note:z.string().trim().max(500).optional()}),
 z.object({action:z.literal('payment_delete'),id}),
]);
const fail=(error:string,status=400)=>Response.json({error},{status});
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const user=await staff();if(!user||!allowed('invoices',user.role))return fail('Access denied',403);
 const parsed=actions.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return fail(parsed.error.issues[0]?.message||'Invalid request');
 const b=parsed.data,db=await sessionClient();
 const load=async(invoiceId:string)=>(await db.from('invoices').select('*').eq('id',invoiceId).single()).data;
 switch(b.action){
  case 'create_with_client':{
   // Invoicing someone who isn't in the CRM yet: reuse a lead with the same email, otherwise save them as a won client.
   const email=b.client.email.toLowerCase();
   let {data:lead}=await db.from('leads').select('id').eq('email',email).order('created_at').limit(1).maybeSingle();
   if(!lead){
    const {data:won}=await db.from('pipeline_stages').select('key').eq('kind','won').order('position').limit(1).maybeSingle();
    const res=await db.from('leads').insert({...b.client,email,currency:b.currency,source:'other',status:won?.key??'new',owner_id:user.id,service_interested:'',message:''}).select('id').single();
    if(res.error){console.error('Invoice client insert failed:',res.error.code,res.error.message);return fail('Could not save the client.');}lead=res.data;
   }
   const items=[{description:'',qty:1,unit_price:0}];
   const {data,error}=await db.from('invoices').insert({lead_id:lead.id,currency:b.currency,items,created_by:user.id}).select('id').single();
   return error?fail('Could not create the invoice.'):Response.json({ok:true,id:data.id});
  }
  case 'create':{
   // New invoices start in the client's deal currency with one line for the project.
   const {data:lead}=await db.from('leads').select('currency,service_interested,deal_value').eq('id',b.lead_id).single();
   if(!lead)return fail('Client not found.',404);
   const items=[{description:lead.service_interested||'Project work',qty:1,unit_price:Number(lead.deal_value??0)}];
   const t=invoiceTotals(items,0,0);
   const {data,error}=await db.from('invoices').insert({lead_id:b.lead_id,currency:lead.currency,items,subtotal:t.subtotal,total:t.total,created_by:user.id}).select('id').single();
   return error?fail('Could not create the invoice.'):Response.json({ok:true,id:data.id});
  }
  case 'save':{
   const inv=await load(b.id);if(!inv)return fail('Invoice not found.',404);
   if(inv.status==='paid'||inv.status==='void')return fail('Paid and void invoices are locked. Reopen it to edit.');
   if(b.values.due_date<b.values.issue_date)return fail('The due date can’t be before the issue date.');
   const t=invoiceTotals(b.values.items,b.values.tax_rate,b.values.discount);
   if(t.total<Number(inv.amount_paid))return fail('The total can’t be less than what’s already been paid.');
   const {error}=await db.from('invoices').update({...b.values,subtotal:t.subtotal,total:t.total}).eq('id',b.id);
   return error?fail('Could not save the invoice.'):Response.json({ok:true});
  }
  case 'send':{
   const inv=await load(b.id);if(!inv)return fail('Invoice not found.',404);
   if(inv.status==='void'||inv.status==='paid')return fail('This invoice is closed.');
   if(!inv.items.length||Number(inv.total)<=0)return fail('Add at least one priced line before sending.');
   const {data:lead}=await db.from('leads').select('id,name,email').eq('id',inv.lead_id).single();
   if(!lead)return fail('Client not found.',404);
   if(!lead.email)return fail('This client has no email address. Add one on their lead page first.');
   const key=process.env.RESEND_API_KEY,inbox=process.env.CRM_FROM_EMAIL||process.env.LEAD_NOTIFICATION_EMAIL;
   if(!key||!inbox)return fail('Email isn’t configured. Set RESEND_API_KEY and LEAD_NOTIFICATION_EMAIL.',503);
   const link=`${emailBase()}/invoice/${inv.public_token}`;
   const total=money(Number(inv.total)-Number(inv.amount_paid),inv.currency),from=(await settings()).invoice_from?.split('\n')[0]||'Zaane';
   const intro=b.message||`Hi ${lead.name.split(' ')[0]},\n\nPlease find invoice ${inv.number} for ${total}, due ${fmtDate(inv.due_date)}.`;
   const rows=(inv.items as {description:string;qty:number;unit_price:number}[]).map(i=>`<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(i.description)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${i.qty} × ${esc(money(i.unit_price,inv.currency))}</td></tr>`).join('');
   const html=`<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:560px">${esc(intro).replace(/\n/g,'<br>')}<table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">${rows}<tr><td style="padding:12px 0;font-weight:700">Amount due</td><td style="padding:12px 0;text-align:right;font-weight:700">${esc(total)}</td></tr></table><p><a href="${link}" style="display:inline-block;background:#f10c45;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">View invoice ${esc(inv.number)}</a></p><p style="color:#666;font-size:13px">You can print or save it as a PDF from that page.</p></div>`;
   const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from:`${from} <${inbox}>`,to:[lead.email],bcc:[inbox],reply_to:inbox,subject:`Invoice ${inv.number} from ${from}`,text:`${intro}\n\nView invoice: ${link}`,html})});
   const sent=await r.json().catch(()=>({}));
   if(!r.ok)return fail(sent.message?`Email failed: ${sent.message}`:'Email failed to send.',502);
   await db.from('invoices').update({status:'sent',sent_at:new Date().toISOString()}).eq('id',inv.id);
   await db.from('lead_activities').insert({lead_id:lead.id,kind:'email',body:intro,meta:{subject:`Invoice ${inv.number}`,to:lead.email,invoice_id:inv.id,resend_id:String(sent.id??'')},author_id:user.id});
   return Response.json({ok:true});
  }
  case 'mark_sent':{
   const {data,error}=await db.from('invoices').update({status:'sent',sent_at:new Date().toISOString()}).eq('id',b.id).eq('status','draft').select('id');
   return error||!data?.length?fail('Only drafts can be marked as sent.'):Response.json({ok:true});
  }
  case 'void':{
   const {data,error}=await db.from('invoices').update({status:'void'}).eq('id',b.id).neq('status','paid').select('id');
   return error||!data?.length?fail('Paid invoices can’t be voided. Remove the payments first.'):Response.json({ok:true});
  }
  case 'reopen':{
   const inv=await load(b.id);if(!inv)return fail('Invoice not found.',404);
   // A fully paid invoice reopens as sent; to reopen it for editing, remove a payment first.
   if(inv.status==='paid')return fail('Remove a payment to reopen a paid invoice.');
   const {error}=await db.from('invoices').update({status:inv.sent_at?'sent':'draft'}).eq('id',b.id);
   return error?fail('Could not reopen the invoice.'):Response.json({ok:true});
  }
  case 'delete':{
   // Any invoice can be deleted; its payments go with it (cascade). The lead's timeline keeps a note.
   const inv=await load(b.id);if(!inv)return fail('Invoice not found.',404);
   const {error}=await db.from('invoices').delete().eq('id',b.id);
   if(error)return fail('Could not delete the invoice.');
   if(inv.status!=='draft')await db.from('lead_activities').insert({lead_id:inv.lead_id,kind:'note',body:`Invoice ${inv.number} (${money(Number(inv.total),inv.currency)}) was deleted.`,author_id:user.id});
   return Response.json({ok:true});
  }
  case 'duplicate':{
   const inv=await load(b.id);if(!inv)return fail('Invoice not found.',404);
   const {data,error}=await db.from('invoices').insert({lead_id:inv.lead_id,currency:inv.currency,items:inv.items,tax_rate:inv.tax_rate,discount:inv.discount,subtotal:inv.subtotal,total:inv.total,notes:inv.notes,created_by:user.id}).select('id').single();
   return error?fail('Could not duplicate the invoice.'):Response.json({ok:true,id:data.id});
  }
  case 'payment_add':{
   const inv=await load(b.invoice_id);if(!inv)return fail('Invoice not found.',404);
   if(inv.status==='void')return fail('This invoice is void.');
   if(Number(inv.total)<=0)return fail('Add a priced line and save before recording a payment.');
   // Recording a payment on a draft means it went out some other way, so it becomes sent.
   if(inv.status==='draft')await db.from('invoices').update({status:'sent',sent_at:new Date().toISOString()}).eq('id',inv.id);
   const owed=Math.round((Number(inv.total)-Number(inv.amount_paid))*100)/100;
   if(b.amount>owed)return fail(`That’s more than the ${money(owed,inv.currency)} still owed.`);
   const {error}=await db.from('invoice_payments').insert({invoice_id:inv.id,amount:b.amount,paid_on:b.paid_on,method:b.method,note:b.note??'',created_by:user.id});
   if(error)return fail('Could not record the payment.');
   await db.from('lead_activities').insert({lead_id:inv.lead_id,kind:'note',body:`Payment of ${money(b.amount,inv.currency)} received for invoice ${inv.number} (${b.method}).`,author_id:user.id});
   return Response.json({ok:true});
  }
  case 'payment_delete':{
   const {error}=await db.from('invoice_payments').delete().eq('id',b.id);
   return error?fail('Could not remove the payment.'):Response.json({ok:true});
  }
 }
}
