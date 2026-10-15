'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Copy,FilePlus2,LayoutTemplate,Pencil,Plus,Trash2} from 'lucide-react';
import Flash from './Flash';
import {when} from './ui';
import {bodyToText,campaignEmail} from '@/lib/newsletter';

export type Template={id:string;name:string;body:string;updated_at:string};
// Admin > Newsletter > Templates: saved email bodies to start campaigns from.
export default function TemplateList({templates}:{templates:Template[]}){
 const router=useRouter();
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[removing,setRemoving]=useState<Template|null>(null);
 async function act(action:'template_duplicate'|'template_delete',id:string){
  setBusy(id);setError('');
  try{
   const r=await fetch('/api/admin/newsletter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id})});
   const out=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(out.error||'Something went wrong.');
   setRemoving(null);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Something went wrong.');}finally{setBusy('');}
 }
 return <div className="za-page">
  <div className="za-page-head"><div><h1>Templates</h1><p>Saved email bodies. Start a campaign from one, or build a new one.</p></div>
   <div className="za-toolbar-actions"><Link className="za-btn za-btn-primary" href="/admin/newsletter/templates/new"><Plus size={15}/>New template</Link></div></div>
  {error&&<Flash tone="error">{error}</Flash>}
  {templates.length?<div className="za-nl-tpl-grid">{templates.map(t=><article key={t.id} className="za-card za-nl-tpl">
   <Link href={`/admin/newsletter/templates/${t.id}`} className="za-nl-tpl-thumb" aria-label={`Edit ${t.name}`}><iframe title={`${t.name} preview`} sandbox="" tabIndex={-1} srcDoc={campaignEmail(t.body||'Empty template','00000000-0000-0000-0000-000000000000').html}/></Link>
   <div className="za-nl-tpl-meta"><b>{t.name}</b><small>{bodyToText(t.body).replace(/\s+/g,' ').slice(0,90)||'Empty'} · Updated {when(t.updated_at)}</small></div>
   <div className="za-nl-tpl-actions">
    <Link className="za-btn za-btn-primary" href={`/admin/newsletter/new?template=${t.id}`}><FilePlus2 size={14}/>Use</Link>
    <Link className="za-btn za-btn-ghost" href={`/admin/newsletter/templates/${t.id}`}><Pencil size={14}/>Edit</Link>
    <button type="button" className="za-btn za-btn-ghost" disabled={busy===t.id} onClick={()=>void act('template_duplicate',t.id)}><Copy size={14}/>Duplicate</button>
    <button type="button" className="za-btn za-btn-ghost" aria-label={`Delete ${t.name}`} disabled={busy===t.id} onClick={()=>setRemoving(t)}><Trash2 size={14}/></button>
   </div></article>)}</div>
  :<section className="za-card"><div className="za-empty za-empty-lg"><LayoutTemplate size={28}/><h3>No templates yet</h3><p>Create one, or save any campaign as a template.</p></div></section>}
  {removing&&<div className="za-modal-scrim" onClick={()=>setRemoving(null)}><div className="za-modal" role="alertdialog" aria-label="Delete template" onClick={e=>e.stopPropagation()}>
   <div className="za-modal-head"><span className="za-modal-icon"><Trash2 size={18}/></span><div><strong>Delete {removing.name}?</strong><small>Campaigns already made from it aren’t affected.</small></div></div>
   <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setRemoving(null)}>Cancel</button><button type="button" className="za-btn za-btn-danger" disabled={!!busy} onClick={()=>void act('template_delete',removing.id)}>Delete</button></div>
  </div></div>}
 </div>;
}
