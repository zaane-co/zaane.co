'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowLeft} from 'lucide-react';
import Flash from './Flash';
import RichEmailEditor from './RichEmailEditor';
import {campaignEmail,isHtmlBody,legacyToEditorHtml} from '@/lib/newsletter';

// Admin > Newsletter > Templates > edit: a name and a body, shown live inside the shared email frame.
export default function TemplateEditor({template}:{template?:{id:string;name:string;body:string}}){
 const router=useRouter();
 const [name,setName]=useState(template?.name??''),[body,setBody]=useState(()=>{const b=template?.body??'';return isHtmlBody(b)?b:legacyToEditorHtml(b);});
 const [busy,setBusy]=useState(false),[msg,setMsg]=useState<{text:string;tone:'success'|'error'}|null>(null);
 async function save(){
  setBusy(true);setMsg(null);
  try{
   const r=await fetch('/api/admin/newsletter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'template_save',id:template?.id,name,body})});
   const out=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(out.error||'Something went wrong.');
   if(!template)router.replace(`/admin/newsletter/templates/${out.id}`);
   setMsg({text:'Template saved.',tone:'success'});router.refresh();
  }catch(e){setMsg({text:e instanceof Error?e.message:'Something went wrong.',tone:'error'});}finally{setBusy(false);}
 }
 return <div className="za-page">
  <div className="za-page-head"><div><Link href="/admin/newsletter/templates" className="za-cell-muted"><ArrowLeft size={13}/> Templates</Link><h1>{template?(name||'Untitled template'):'New template'}</h1><p>Campaigns started from this template begin with this content. You can change everything per campaign.</p></div></div>
  <div className="za-nl-grid"><section className="za-card za-nl-edit"><div className="za-set-fields">
   <div className="za-field za-set-field"><div className="za-field-label"><label htmlFor="tpl-name">Template name</label></div><input id="tpl-name" value={name} maxLength={120} onChange={e=>setName(e.target.value)} placeholder="e.g. Monthly update"/></div>
   <div className="za-field za-set-field"><div className="za-field-label"><label>Content</label></div><RichEmailEditor value={body} onChange={setBody}/></div>
   {msg&&<Flash tone={msg.tone}>{msg.text}</Flash>}
   <div className="za-toolbar-actions"><button type="button" className="za-btn za-btn-primary" disabled={busy||!name.trim()} onClick={()=>void save()}>{busy?'Saving…':'Save template'}</button>
    {template&&<Link className="za-btn za-btn-ghost" href={`/admin/newsletter/new?template=${template.id}`}>Use for a campaign</Link>}</div>
  </div></section>
  <aside className="za-card za-nl-preview"><div className="za-nl-preview-head"><strong>Preview</strong><small>{name||'Untitled template'}</small></div><iframe title="Template preview" sandbox="" srcDoc={campaignEmail(body||'Your content appears here as you type.','00000000-0000-0000-0000-000000000000').html}/></aside></div>
 </div>;
}
