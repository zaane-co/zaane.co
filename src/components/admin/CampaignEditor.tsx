'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Send,Trash2} from 'lucide-react';
import Flash from './Flash';
import {Status} from './ui';
import {campaignEmail} from '@/lib/newsletter';

export type Campaign={id:string;subject:string;body:string;status:string;recipient_count:number;sent_count:number;failed_count:number;sent_at:string|null};
// Admin > Newsletter > Campaigns: write a plain-text email, send yourself a test, then send it to every active subscriber.
export default function CampaignEditor({campaign,audience}:{campaign?:Campaign;audience:number}){
 const router=useRouter();
 const [id,setId]=useState(campaign?.id),[subject,setSubject]=useState(campaign?.subject??''),[body,setBody]=useState(campaign?.body??'');
 const [busy,setBusy]=useState(''),[msg,setMsg]=useState<{text:string;tone:'success'|'error'}|null>(null),[confirm,setConfirm]=useState(false);
 const locked=!!campaign&&campaign.status!=='draft';
 async function call(action:string,extra:Record<string,unknown>={}){
  const r=await fetch('/api/admin/newsletter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id,subject,body,...extra})});
  const out=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(out.error||'Something went wrong.');
  return out as {id?:string;to?:string;recipients?:number};
 }
 async function run(action:'save'|'test'|'send'|'delete'){
  setBusy(action);setMsg(null);
  try{
   let cid=id;
   if(action!=='delete'){const saved=await call('save');cid=saved.id??id;if(cid&&cid!==id){setId(cid);window.history.replaceState(null,'',`/admin/newsletter/${cid}`);}}
   if(action==='save'){setMsg({text:'Draft saved.',tone:'success'});router.refresh();}
   else if(action==='test'){const o=await call('test',{id:cid});setMsg({text:`Test sent to ${o.to}.`,tone:'success'});}
   else if(action==='send'){await call('send',{id:cid});router.push('/admin/newsletter');router.refresh();}
   else{await call('delete');router.push('/admin/newsletter');router.refresh();}
  }catch(e){setMsg({text:e instanceof Error?e.message:'Something went wrong.',tone:'error'});}
  finally{setBusy('');setConfirm(false);}
 }
 return <div className="za-page">
  <div className="za-page-head"><div><Link href="/admin/newsletter" className="za-cell-muted"><ArrowLeft size={13}/> Campaigns</Link><h1>{campaign?(subject||'Untitled draft'):'New campaign'}</h1>
   <p>{locked?<>Sent to {campaign.sent_count} of {campaign.recipient_count} subscribers{campaign.failed_count?`, ${campaign.failed_count} failed`:''}.</>:<>Goes to the {audience} {audience===1?'person':'people'} still subscribed. Everyone gets their own unsubscribe link.</>}</p></div>
   {campaign&&<Status value={campaign.status==='sending'?'in_progress':campaign.status}/>}</div>
  <div className="za-nl-grid"><section className="za-card za-nl-edit"><div className="za-set-fields">
   <div className="za-field za-set-field"><div className="za-field-label"><label htmlFor="nl-subject">Subject</label></div><input id="nl-subject" value={subject} maxLength={200} disabled={locked} onChange={e=>setSubject(e.target.value)} placeholder="What’s new at Zaane"/></div>
   <div className="za-field za-set-field"><div className="za-field-label"><label htmlFor="nl-body">Message</label></div><textarea id="nl-body" rows={18} value={body} disabled={locked} onChange={e=>setBody(e.target.value)} placeholder={'# A headline\n\nWrite your email. Leave a blank line between paragraphs.\n\n- Bullet points start with a dash\n\nbutton: Read more | https://zaane.co'}/><small className="za-nl-hint">Formatting: <code># Heading</code> · <code>**bold**</code> · <code>- list</code> · <code>button: Label | https://link</code> · links become clickable.</small></div>
   {msg&&<Flash tone={msg.tone}>{msg.text}</Flash>}
   {!locked&&<div className="za-toolbar-actions">
    <button type="button" className="za-btn za-btn-ghost" disabled={!!busy} onClick={()=>void run('save')}>{busy==='save'?'Saving…':'Save draft'}</button>
    <button type="button" className="za-btn za-btn-ghost" disabled={!!busy||!subject.trim()||!body.trim()} onClick={()=>void run('test')}>{busy==='test'?'Sending…':'Send test to me'}</button>
    <button type="button" className="za-btn za-btn-primary" disabled={!!busy||!subject.trim()||!body.trim()||!audience} onClick={()=>setConfirm(true)}><Send size={14}/>Send to {audience}</button>
    {id&&<button type="button" className="za-btn za-btn-ghost" disabled={!!busy} onClick={()=>void run('delete')}><Trash2 size={14}/>Delete draft</button>}
   </div>}
  </div></section>
  <aside className="za-card za-nl-preview"><div className="za-nl-preview-head"><strong>Preview</strong><small>{subject||'No subject yet'}</small></div><iframe title="Email preview" sandbox="" srcDoc={campaignEmail(body||'Your message appears here as you type.','00000000-0000-0000-0000-000000000000').html}/></aside></div>
  {confirm&&<div className="za-modal-scrim" onClick={()=>setConfirm(false)}><div className="za-modal" role="alertdialog" aria-label="Send campaign" onClick={e=>e.stopPropagation()}>
   <div className="za-modal-head"><span className="za-modal-icon"><Send size={18}/></span><div><strong>Send to {audience} {audience===1?'subscriber':'subscribers'}?</strong><small>{subject}</small></div></div>
   <p>This can’t be undone or edited once it starts sending. Send yourself a test first if you haven’t.</p>
   <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setConfirm(false)}>Cancel</button><button type="button" className="za-btn za-btn-primary" disabled={!!busy} onClick={()=>void run('send')}>{busy==='send'?'Sending…':'Send now'}</button></div>
  </div></div>}
 </div>;
}
