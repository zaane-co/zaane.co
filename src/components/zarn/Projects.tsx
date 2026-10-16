'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {FolderKanban,Plus} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {Modal} from './Dialogs';
import Dropdown from '@/components/ui/Dropdown';

const colors=['#c40a3a','#2563eb','#16a34a','#7c3aed','#ea580c','#0891b2','#db2777','#52525b'];

export function NewProject({onClose,onCreated,clientId}:{onClose:()=>void;onCreated?:(id:string)=>void;clientId?:string}){
 const {db,me,reloadProjects,channels,title}=useZarn(),router=useRouter();
 const clients=channels.filter(c=>c.kind==='client'&&c.lead_id&&!c.archived_at);
 const [client,setClient]=useState(clientId??''),[brief,setBrief]=useState('');
 const [name,setName]=useState(''),[description,setDescription]=useState(''),[color,setColor]=useState(colors[0]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function create(e:React.FormEvent){
  e.preventDefault();if(!name.trim())return;setBusy(true);setError('');
  const {data,error:err}=await db.from('zarn_projects').insert({name:name.trim(),description:description.trim(),color,lead_id:client||null,brief:brief.trim(),created_by:me.user_id}).select('id').single();
  if(err||!data){setError('Could not create the project.');setBusy(false);return;}
  await reloadProjects();onClose();
  const newId=(data as {id:string}).id;if(onCreated)onCreated(newId);else router.push(`/zarn/projects/${newId}`);
 }
 return <Modal title="New project" onClose={onClose}><form className="zn-modal-body" onSubmit={create}>
  <label className="zn-label">Name<input className="zn-input" autoFocus required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Website revamp"/></label>
  <label className="zn-label">Description (optional)<input className="zn-input" maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label>
  <label className="zn-label">Brief (optional)<textarea className="zn-input" rows={4} maxLength={20000} value={brief} onChange={e=>setBrief(e.target.value)} placeholder="What is this project about? Goals, scope, deliverables, deadlines…"/></label>
  {clients.length>0&&<div className="zn-label">Client (optional)<Dropdown label="Client" value={client} onChange={setClient} placeholder="Not linked to a client" options={[{value:'',label:'Not linked to a client'},...clients.map(c=>({value:c.lead_id!,label:title(c)}))]}/></div>}
  <div className="zn-label">Colour<div className="zp-colors">{colors.map(c=><button key={c} type="button" aria-label={c} aria-pressed={color===c} className={color===c?'is-on':''} style={{background:c}} onClick={()=>setColor(c)}/>)}</div></div>
  {error&&<p className="zn-error" role="alert">{error}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy||!name.trim()}>{busy?'Creating…':'Create project'}</button></div>
 </form></Modal>;
}

// /zarn/projects: every project you're in.
export default function Projects(){
 const {projects}=useZarn();
 const [creating,setCreating]=useState(false);
 return <div className="zn-page">
  <header className="zn-page-head"><div><h1><FolderKanban size={20}/>Projects</h1><p>Shared task boards for the team. Assign work and track it as a list, board or timeline.</p></div>
   <button type="button" className="zn-btn is-primary" onClick={()=>setCreating(true)}><Plus size={15}/>New project</button></header>
  <div className="zn-crm-list" data-lenis-prevent>
   {projects===null?<p className="zn-loading">Loading…</p>:projects.length?<div className="zp-project-grid">{projects.map(p=><Link key={p.id} href={`/zarn/projects/${p.id}`} className="zp-project-card"><span className="zp-badge" style={{background:p.color}}>{p.name.slice(0,1).toUpperCase()}</span><div><b>{p.name}</b><small>{p.description||'No description'}</small></div></Link>)}</div>
   :<div className="zn-empty-state"><h2>No projects yet</h2><p>Create one to start planning work with the team.</p><button type="button" className="zn-btn is-primary" onClick={()=>setCreating(true)}><Plus size={15}/>New project</button></div>}
  </div>
  {creating&&<NewProject onClose={()=>setCreating(false)}/>}
 </div>;
}
