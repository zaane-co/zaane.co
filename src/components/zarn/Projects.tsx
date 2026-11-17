'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Archive,FolderKanban,Pencil,Plus,Trash2} from 'lucide-react';
import {GroupField,resolveGroup} from './ProjectExtras';
import {useConfirm} from './ConfirmProvider';
import {useZarn} from './ZarnProvider';
import {Modal} from './Dialogs';
import Dropdown from '@/components/ui/Dropdown';
import {applyTemplate,useTemplates} from './Templates';

const colors=['#c40a3a','#2563eb','#16a34a','#7c3aed','#ea580c','#0891b2','#db2777','#52525b'];

export function NewProject({onClose,onCreated,clientId}:{onClose:()=>void;onCreated?:(id:string)=>void;clientId?:string}){
 const {db,me,reloadProjects,channels,title,projectGroups}=useZarn(),router=useRouter();
 const [group,setGroup]=useState(''),[groupName,setGroupName]=useState('');
 const clients=channels.filter(c=>c.kind==='client'&&c.lead_id&&!c.archived_at);
 const {all:templates}=useTemplates(),[template,setTemplate]=useState('');
 const [client,setClient]=useState(clientId??''),[brief,setBrief]=useState('');
 const [name,setName]=useState(''),[description,setDescription]=useState(''),[color,setColor]=useState(colors[0]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function create(e:React.FormEvent){
  e.preventDefault();if(!name.trim())return;setBusy(true);setError('');
  // In-house projects always sit in a group; a new group can be made right here.
  let group_id:string|null=null;
  if(!clientId){try{group_id=await resolveGroup(db,me.user_id,group,groupName,projectGroups.length>0);}catch(x){setError(x instanceof Error?x.message:'Choose a group.');setBusy(false);return;}}
  const {data,error:err}=await db.from('zarn_projects').insert({name:name.trim(),description:description.trim(),color,lead_id:client||null,brief:brief.trim(),created_by:me.user_id,group_id}).select('id').single();
  if(err||!data){setError('Could not create the project.');setBusy(false);return;}
  const newId=(data as {id:string}).id;
  // Starting from a template fills the new project's board in one go. The project exists either way, so a failure here still opens it.
  const chosen=templates.find(t=>t.id===template);
  if(chosen)try{await applyTemplate(db,me.user_id,chosen.items,{projectId:newId,leadId:client||null,assignees:[me.user_id]});}catch{/* the Templates button on the board can add them again */}
  await reloadProjects();onClose();if(onCreated)onCreated(newId);else router.push(`/zarn/projects/${newId}`);
 }
 return <Modal title="New project" onClose={onClose}><form className="zn-modal-body" onSubmit={create}>
  {!clientId&&<GroupField value={group} onChange={setGroup} newName={groupName} setNewName={setGroupName}/>}
  <label className="zn-label">Name<input className="zn-input" autoFocus required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Website revamp"/></label>
  <label className="zn-label">Description (optional)<input className="zn-input" maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label>
  {templates.length>0&&<div className="zn-label">Start from a template (optional)<Dropdown label="Template" value={template} onChange={setTemplate} placeholder="Empty project" options={[{value:'',label:'Empty project'},...templates.map(t=>({value:t.id,label:`${t.name} (${t.items.length} tasks)`}))]}/></div>}
  <label className="zn-label">Brief (optional)<textarea className="zn-input" rows={4} maxLength={20000} value={brief} onChange={e=>setBrief(e.target.value)} placeholder="What is this project about? Goals, scope, deliverables, deadlines…"/></label>
  {clientId&&clients.length>0&&<div className="zn-label">Client (optional)<Dropdown label="Client" value={client} onChange={setClient} placeholder="Not linked to a client" options={[{value:'',label:'Not linked to a client'},...clients.map(c=>({value:c.lead_id!,label:title(c)}))]}/></div>}
  <div className="zn-label">Colour<div className="zp-colors">{colors.map(c=><button key={c} type="button" aria-label={c} aria-pressed={color===c} className={color===c?'is-on':''} style={{background:c}} onClick={()=>setColor(c)}/>)}</div></div>
  {error&&<p className="zn-error" role="alert">{error}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy||!name.trim()}>{busy?'Creating…':'Create project'}</button></div>
 </form></Modal>;
}

// /zarn/projects: in-house projects you're in, by group. Archived ones are tucked away at the bottom.
export default function Projects(){
 const {db,me,projects,projectGroups,reloadProjects}=useZarn(),confirm=useConfirm();
 const [creating,setCreating]=useState(false),[showArchived,setShowArchived]=useState(false),[renaming,setRenaming]=useState<string|null>(null);
 const inHouse=(projects??[]).filter(p=>!p.lead_id);
 const live=inHouse.filter(p=>!p.archived_at),archived=inHouse.filter(p=>p.archived_at);
 const groups=[...projectGroups.map(g=>({...g,list:live.filter(p=>p.group_id===g.id)})),{id:'',name:'No group',color:'#52525b',position:0,created_by:null,list:live.filter(p=>!p.group_id||!projectGroups.some(g=>g.id===p.group_id))}].filter(g=>g.id||g.list.length);
 const canEditGroup=(g:{created_by:string|null})=>g.created_by===me.user_id||me.zarnAdmin;
 async function renameGroup(id:string,name:string){setRenaming(null);const n=name.trim();if(n)await db.from('zarn_project_groups').update({name:n.slice(0,60)}).eq('id',id);void reloadProjects();}
 async function deleteGroup(id:string,n:number){if(!await confirm({title:'Delete this group?',message:n?`Its ${n} project${n===1?'':'s'} stay, under “No group”.`:'The group is empty.',confirm:'Delete group',danger:true}))return;await db.from('zarn_project_groups').delete().eq('id',id);void reloadProjects();}
 const card=(p:typeof inHouse[number])=><Link key={p.id} href={`/zarn/projects/${p.id}`} className={`zp-project-card${p.archived_at?' is-archived':''}`}>
  <span className="zpc-top"><span className="zp-badge" style={{background:p.color}}>{p.name.slice(0,1).toUpperCase()}</span><b>{p.name}</b>{p.archived_at&&<em className="zpc-tag">Archived</em>}</span>
  <p className="zpc-desc">{p.description||'No description yet.'}</p>
 </Link>;
 return <div className="zn-page">
  <header className="zn-page-head"><div><h1><FolderKanban size={20}/>Projects</h1><p>Our in-house projects, by group. Each has its chat, board, docs, team and vault.</p></div>
   <button type="button" className="zn-btn is-primary" onClick={()=>setCreating(true)}><Plus size={15}/>New project</button></header>
  <div className="zn-crm-list zpg-list" data-lenis-prevent>
   {projects===null?<p className="zn-loading">Loading…</p>:inHouse.length||projectGroups.length?<>
    {groups.map(g=><section key={g.id||'none'} className="zpg-group">
     <header className="zpg-head"><i style={{background:g.color}}/>
      {renaming===g.id?<input className="zn-input zpg-rename" autoFocus defaultValue={g.name} maxLength={60} onBlur={e=>void renameGroup(g.id,e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter')void renameGroup(g.id,e.currentTarget.value);else if(e.key==='Escape')setRenaming(null);}}/>:<h2>{g.name}</h2>}
      <span className="zpg-count">{g.list.length}</span>
      {g.id&&canEditGroup(g)&&<span className="zpg-actions"><button type="button" aria-label={`Rename ${g.name}`} data-tip="Rename" onClick={()=>setRenaming(g.id)}><Pencil size={14}/></button><button type="button" aria-label={`Delete ${g.name}`} data-tip="Delete group" onClick={()=>void deleteGroup(g.id,g.list.length)}><Trash2 size={14}/></button></span>}
     </header>
     {g.list.length?<div className="zp-project-grid">{g.list.map(card)}</div>:<p className="zn-nav-note">No projects in this group yet.</p>}
    </section>)}
    {archived.length>0&&<section className="zpg-group"><button type="button" className="zpg-archived" onClick={()=>setShowArchived(v=>!v)}><Archive size={15}/>Archived · {archived.length}{showArchived?' (hide)':' (show)'}</button>
     {showArchived&&<div className="zp-project-grid">{archived.map(card)}</div>}</section>}
   </>
   :<div className="zn-empty-state"><h2>No projects yet</h2><p>Create a group (like “Products” or “Internal tools”), then add projects to it.</p><button type="button" className="zn-btn is-primary" onClick={()=>setCreating(true)}><Plus size={15}/>New project</button></div>}
  </div>
  {creating&&<NewProject onClose={()=>setCreating(false)}/>}
 </div>;
}
