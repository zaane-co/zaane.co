'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Download,ExternalLink,Link2,ListPlus,Paperclip,Plus,Trash2} from 'lucide-react';
import {crmApi,materialPresets,fmtDate,type Material} from '@/lib/crm';

// Checklist of what the client still owes us. Items tick off when marked received or when a file is attached.
export default function MaterialsPanel({leadId,materials}:{leadId:string;materials:Material[]}){
 const router=useRouter(),[,start]=useTransition();
 const [title,setTitle]=useState(''),[busy,setBusy]=useState<string|null>(null),[flash,setFlash]=useState(''),[linkFor,setLinkFor]=useState<string|null>(null),[link,setLink]=useState('');
 const done=materials.filter(m=>m.received_at).length,missing=materialPresets.filter(p=>!materials.some(m=>m.title===p));
 async function run(key:string,body:object,msg?:string){
  setBusy(key);setFlash('');
  try{await crmApi(body);if(msg)setFlash(msg);start(()=>router.refresh());return true;}
  catch(e){setFlash(e instanceof Error?e.message:'Something went wrong.');return false;}finally{setBusy(null);}
 }
 async function upload(m:Material,file?:File){
  if(!file)return;setBusy(m.id);setFlash('');
  try{const form=new FormData();form.set('id',m.id);form.set('file',file);const r=await fetch('/api/admin/crm/material-file',{method:'POST',body:form});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Upload failed.');setFlash(`${file.name} attached.`);start(()=>router.refresh());}
  catch(e){setFlash(e instanceof Error?e.message:'Upload failed.');}finally{setBusy(null);}
 }
 return <section className="za-card">
  <div className="za-card-head"><h2>Materials from the client</h2><small className="za-date">{done} of {materials.length} received</small></div>
  {materials.length>0&&<div className="za-progress" aria-hidden><span style={{width:`${materials.length?done/materials.length*100:0}%`}}/></div>}
  <div className="za-card-pad">
   {materials.length?<ul className="za-tasks">{materials.map(m=><li key={m.id} className={`za-task za-material${m.received_at?' is-done':''}`}>
    <input type="checkbox" checked={!!m.received_at} disabled={busy===m.id} onChange={e=>void run(m.id,{action:'material_update',id:m.id,received:e.target.checked})} aria-label={m.received_at?`Mark ${m.title} as missing`:`Mark ${m.title} as received`}/>
    <div>
     <span>{m.title}</span>
     {m.received_at&&<small className="za-due za-due-done-ok">Received {fmtDate(m.received_at)}</small>}
     {(m.link||m.file_key)&&<div className="za-material-links">
      {m.link&&<a href={m.link} target="_blank" rel="noopener noreferrer"><ExternalLink size={12}/>{m.link.replace(/^https?:\/\/(www\.)?/,'').split('/')[0]}</a>}
      {m.file_key&&<a href={`/api/admin/crm/material-file?id=${m.id}`}><Download size={12}/>{m.file_name||'Download file'}</a>}
     </div>}
     {linkFor===m.id&&<form className="za-inline-create" onSubmit={async e=>{e.preventDefault();if(await run(m.id,{action:'material_update',id:m.id,link,received:true},'Link saved.'))setLinkFor(null);}}><input autoFocus type="url" placeholder="https://drive.google.com/…" value={link} onChange={e=>setLink(e.target.value)}/><button className="za-btn za-btn-primary" disabled={!link}>Save</button><button type="button" className="za-btn za-btn-ghost" onClick={()=>setLinkFor(null)}>Cancel</button></form>}
    </div>
    <div className="za-material-actions">
     <button type="button" aria-label="Add link" data-tip="Add a link" onClick={()=>{setLinkFor(m.id);setLink(m.link);}}><Link2 size={13}/></button>
     <label aria-label="Attach file" data-tip="Attach a file (4 MB max)"><Paperclip size={13}/><input type="file" hidden disabled={busy===m.id} onChange={e=>void upload(m,e.target.files?.[0])}/></label>
     <button type="button" className="za-row-danger" aria-label="Delete item" data-tip="Delete" disabled={busy===m.id} onClick={()=>void run(m.id,{action:'material_delete',id:m.id})}><Trash2 size={13}/></button>
    </div>
   </li>)}</ul>:<p className="za-muted-note">Track what the client needs to send: logos, copy, logins and so on.</p>}
   <form className="za-task-add" onSubmit={async e=>{e.preventDefault();if(await run('add',{action:'material_add',lead_id:leadId,titles:[title]}))setTitle('');}}>
    <div className="za-inline-create"><input placeholder="Add an item, e.g. Product photos" maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/><button className="za-btn za-btn-ghost" disabled={busy==='add'||!title.trim()}><Plus size={14}/>Add</button></div>
   </form>
   {missing.length>0&&<div className="za-presets"><span><ListPlus size={13}/>Common items</span><div className="za-chips">{missing.map(p=><button key={p} type="button" disabled={!!busy} onClick={()=>void run('add',{action:'material_add',lead_id:leadId,titles:[p]})}>+ {p}</button>)}{missing.length>1&&<button type="button" className="is-on" disabled={!!busy} onClick={()=>void run('add',{action:'material_add',lead_id:leadId,titles:missing},'Checklist added.')}>Add all</button>}</div></div>}
   {flash&&<p role="status" className="za-flash" style={{marginTop:12}}>{flash}</p>}
  </div>
 </section>;
}
