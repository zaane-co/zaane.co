import {after} from 'next/server';
import {staff,sessionClient,serviceClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import {campaignEmail,unsubscribeUrl} from '@/lib/newsletter';
import {revalidatePath} from 'next/cache';
export const maxDuration=300;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(error:string,status=400)=>Response.json({error},{status});
type Mail={from:string;to:string[];reply_to?:string;subject:string;html:string;text:string;headers:Record<string,string>};
const headersFor=(url:string)=>({'List-Unsubscribe':`<${url}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'});

export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const user=await staff();if(!user||!allowed('newsletter',user.role))return fail('Access denied',403);
 const b=await request.json().catch(()=>null);
 if(!b||!['save','delete','test','send','template_save','template_delete','template_duplicate'].includes(b.action)||(b.id&&!uuid.test(b.id)))return fail('Invalid request');
 const db=await sessionClient();
 const subject=String(b.subject??'').trim().slice(0,200),body=String(b.body??'').slice(0,50000);

 if(b.action.startsWith('template_')){
  const name=String(b.name??'').trim().slice(0,120);
  if(b.action==='template_delete'){
   if(!b.id)return fail('Invalid request');
   const {error}=await db.from('newsletter_templates').delete().eq('id',b.id);
   if(error)return fail('Could not delete this template.');
   revalidatePath('/admin/newsletter/templates');return Response.json({ok:true});
  }
  if(b.action==='template_duplicate'){
   if(!b.id)return fail('Invalid request');
   const {data:src}=await db.from('newsletter_templates').select('name,body').eq('id',b.id).single();
   if(!src)return fail('Template not found.',404);
   const {data,error}=await db.from('newsletter_templates').insert({name:`${src.name} copy`.slice(0,120),body:src.body,created_by:user.id}).select('id').single();
   if(error)return fail('Could not duplicate this template.');
   revalidatePath('/admin/newsletter/templates');return Response.json({ok:true,id:data.id});
  }
  if(!name)return fail('Give the template a name.');
  if(b.id){
   const {data,error}=await db.from('newsletter_templates').update({name,body,updated_at:new Date().toISOString()}).eq('id',b.id).select('id').maybeSingle();
   if(error||!data)return fail('Could not save this template.');
   revalidatePath('/admin/newsletter/templates');return Response.json({ok:true,id:data.id});
  }
  const {data,error}=await db.from('newsletter_templates').insert({name,body,created_by:user.id}).select('id').single();
  if(error)return fail('Could not save this template.');
  revalidatePath('/admin/newsletter/templates');return Response.json({ok:true,id:data.id});
 }

 if(b.action==='save'){
  if(b.id){
   const {data,error}=await db.from('newsletter_campaigns').update({subject,body,updated_at:new Date().toISOString()}).eq('id',b.id).eq('status','draft').select('id').maybeSingle();
   if(error||!data)return fail('Could not save. Sent campaigns can’t be edited.');
   return Response.json({ok:true,id:data.id});
  }
  const {data,error}=await db.from('newsletter_campaigns').insert({subject,body,created_by:user.id}).select('id').single();
  if(error)return fail('Could not save this campaign.');
  revalidatePath('/admin/newsletter');return Response.json({ok:true,id:data.id});
 }
 if(!b.id)return fail('Save the campaign first.');
 if(b.action==='delete'){
  const {error}=await db.from('newsletter_campaigns').delete().eq('id',b.id).eq('status','draft');
  if(error)return fail('Could not delete this campaign.');
  revalidatePath('/admin/newsletter');return Response.json({ok:true});
 }

 const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM,replyTo=process.env.LEAD_NOTIFICATION_EMAIL;
 if(!key||!from)return fail('Email isn’t configured. Set RESEND_API_KEY and RESEND_FROM.',503);
 const {data:c}=await db.from('newsletter_campaigns').select('id,subject,body,status').eq('id',b.id).single();
 if(!c)return fail('Campaign not found.',404);
 if(c.status!=='draft')return fail('This campaign was already sent.');
 if(!c.subject.trim()||!c.body.trim())return fail('Add a subject and a message first. Save the draft, then try again.');

 if(b.action==='test'){
  const e=campaignEmail(c.body,'00000000-0000-0000-0000-000000000000');
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[user.email],reply_to:replyTo,subject:`[Test] ${c.subject}`,html:e.html,text:e.text})});
  const out=await r.json().catch(()=>({}));
  if(!r.ok)return fail(out.message?`Test failed: ${out.message}`:'Test email failed to send.',502);
  return Response.json({ok:true,to:user.email});
 }

 // send: claim the draft first so a double click can't send twice.
 const svc=serviceClient();
 const {count}=await svc.from('subscribers').select('id',{count:'exact',head:true}).is('unsubscribed_at',null);
 if(!count)return fail('There are no active subscribers to send to yet.');
 const {data:claimed}=await svc.from('newsletter_campaigns').update({status:'sending',recipient_count:count,sent_count:0,failed_count:0}).eq('id',c.id).eq('status','draft').select('id').maybeSingle();
 if(!claimed)return fail('This campaign is already sending.');
 after(async()=>{
  let sent=0,failed=0;
  try{
   for(let offset=0;;offset+=1000){
    const {data:subs,error}=await svc.from('subscribers').select('email,unsubscribe_token').is('unsubscribed_at',null).order('created_at').range(offset,offset+999);
    if(error)throw error;if(!subs?.length)break;
    for(let i=0;i<subs.length;i+=100){
     const chunk=subs.slice(i,i+100);
     const mails:Mail[]=chunk.map(s=>{const e=campaignEmail(c.body,s.unsubscribe_token);return {from,to:[s.email],reply_to:replyTo,subject:c.subject,html:e.html,text:e.text,headers:headersFor(unsubscribeUrl(s.unsubscribe_token))};});
     try{const r=await fetch('https://api.resend.com/emails/batch',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(mails)});if(r.ok)sent+=chunk.length;else failed+=chunk.length;}catch{failed+=chunk.length;}
     await svc.from('newsletter_campaigns').update({sent_count:sent,failed_count:failed}).eq('id',c.id);
    }
    if(subs.length<1000)break;
   }
  }catch(e){console.error('Newsletter send aborted:',e);}
  await svc.from('newsletter_campaigns').update({status:'sent',sent_count:sent,failed_count:failed,sent_at:new Date().toISOString()}).eq('id',c.id);
 });
 revalidatePath('/admin/newsletter');
 return Response.json({ok:true,recipients:count});
}
