'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Settings2,Archive,ChevronRight,FolderInput,FolderKanban,FolderPlus,MoreHorizontal,Pencil,Plus,Trash2} from 'lucide-react';
import {AddExisting,GroupDialog,GroupField,ManageGroups,resolveGroup} from './ProjectExtras';
import {useConfirm} from './ConfirmProvider';
import {useZarn} from './ZarnProvider';
import {Modal} from './Dialogs';
import Dropdown from '@/components/ui/Dropdown';
import {applyTemplate,useTemplates} from './Templates';

const colors=['#c40a3a','#2563eb','#16a34a','#7c3aed','#ea580c','#0891b2','#db2777','#52525b'];

export function NewProject({onClose,onCreated,clientId,groupId}:{onClose:()=>void;onCreated?:(id:string)=>void;clientId?:string;groupId?:string}){
 const {db,me,reloadProjects,channels,title,projectGroups}=useZarn(),router=useRouter();
 const [group,setGroup]=useState(groupId??''),[groupName,setGroupName]=useState('');
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
 const [creating,setCreating]=useState<string|true|false>(false),[showArchived,setShowArchived]=useState(false),[editing,setEditing]=useState<{id:string;name:string;color:string}|'new'|null>(null),[adding,setAdding]=useState<{id:string;name:string}|null>(null),[groupMenu,setGroupMenu]=useState<string|null>(null),[managing,setManaging]=useState(false),[sheet,setSheet]=useState<string|'page'|null>(null);
 const inHouse=(projects??[]).filter(p=>!p.lead_id);
 const live=inHouse.filter(p=>!p.archived_at),archived=inHouse.filter(p=>p.archived_at);
 const groups=[...projectGroups.map(g=>({...g,list:live.filter(p=>p.group_id===g.id)})),{id:'',name:'No group',color:'#52525b',position:0,created_by:null,list:live.filter(p=>!p.group_id||!projectGroups.some(g=>g.id===p.group_id))}].filter(g=>g.id||g.list.length);
 const canEditGroup=(g:{created_by:string|null})=>g.created_by===me.user_id||me.zarnAdmin;
 async function deleteGroup(id:string,n:number){if(!await confirm({title:'Delete this group?',message:n?`Its ${n} project${n===1?'':'s'} stay, under “No group”.`:'The group is empty.',confirm:'Delete group',danger:true}))return;await db.from('zarn_project_groups').delete().eq('id',id);void reloadProjects();}
 const card=(p:typeof inHouse[number])=><Link key={p.id} href={`/zarn/projects/${p.id}`} className={`zp-project-card${p.archived_at?' is-archived':''}`}>
  <span className="zpc-top"><span className="zp-badge" style={{background:p.color}}>{p.name.slice(0,1).toUpperCase()}</span><b>{p.name}</b>{p.archived_at&&<em className="zpc-tag">Archived</em>}</span>
  <p className="zpc-desc">{p.description||'No description yet.'}</p>
  <ChevronRight className="zpc-chev" size={18} aria-hidden/>
 </Link>;
 const sheetGroup=sheet&&sheet!=='page'?groups.find(g=>g.id===sheet):null;
 return <div className="zn-page">
  <header className="zn-page-head zpg-head-bar"><div><h1><FolderKanban size={16}/>Projects</h1><p>Our in-house projects, by group. Each has its chat, board, docs, team and vault.</p></div>
   <span className="zpg-head-btns"><button type="button" className="zn-btn" onClick={()=>setManaging(true)}><Settings2 size={14}/>Manage groups</button>{me.zarnAdmin&&<button type="button" className="zn-btn" onClick={()=>setEditing('new')}><FolderPlus size={14}/>New group</button>}<button type="button" className="zn-btn is-primary" onClick={()=>setCreating(true)}><Plus size={14}/>New project</button></span>
   <button type="button" className="zpg-more is-head" aria-label="More" onClick={()=>setSheet('page')}><MoreHorizontal size={20}/></button></header>
  <div className="zn-crm-list zpg-list" data-lenis-prevent>
   {projects===null?<p className="zn-loading">Loading…</p>:inHouse.length||projectGroups.length?<>
    {groups.map(g=><section key={g.id||'none'} className="zpg-group">
     <header className="zpg-head"><i style={{background:g.color}}/>
      <h2>{g.name}</h2>
      <span className="zpg-count">{g.list.length}</span>
      {g.id&&<span className="zpg-actions">
       <span className="zpg-add"><button type="button" className="zpg-add-btn" onClick={()=>setGroupMenu(m=>m===g.id?null:g.id)}><Plus size={14}/>Add project</button>
        {groupMenu===g.id&&<div className="zn-menu zpg-pop" onMouseLeave={()=>setGroupMenu(null)}><button type="button" onClick={()=>{setGroupMenu(null);setCreating(g.id);}}><Plus size={15}/>New project in {g.name}</button><button type="button" onClick={()=>{setGroupMenu(null);setAdding(g);}}><FolderInput size={15}/>Add existing projects</button></div>}</span>
       {canEditGroup(g)&&<><button type="button" aria-label={`Edit ${g.name}`} data-tip="Edit group" onClick={()=>setEditing(g)}><Pencil size={14}/></button><button type="button" aria-label={`Delete ${g.name}`} data-tip="Delete group" onClick={()=>void deleteGroup(g.id,g.list.length)}><Trash2 size={14}/></button></>}
      </span>}
      {g.id&&<button type="button" className="zpg-more" aria-label={`${g.name} options`} onClick={()=>setSheet(g.id)}><MoreHorizontal size={18}/></button>}
     </header>
     {g.list.length?<div className="zp-project-grid">{g.list.map(card)}</div>:<p className="zn-nav-note">No projects in this group yet. Use Add project to make one or bring existing ones in.</p>}
    </section>)}
    {archived.length>0&&<section className="zpg-group"><button type="button" className="zpg-archived" onClick={()=>setShowArchived(v=>!v)}><Archive size={15}/>Archived · {archived.length}{showArchived?' (hide)':' (show)'}</button>
     {showArchived&&<div className="zp-project-grid">{archived.map(card)}</div>}</section>}
   </>
   :<div className="zn-empty-state"><h2>No projects yet</h2><p>Create a group (like “Products” or “Internal tools”), then add projects to it.</p><button type="button" className="zn-btn is-primary" onClick={()=>setCreating(true)}><Plus size={15}/>New project</button></div>}
  </div>
  <button type="button" className="zpg-fab" aria-label="New project" onClick={()=>setCreating(true)}><Plus size={26}/></button>
  {sheet&&<div className="zp-move-scrim" onClick={()=>setSheet(null)}><div className="zp-move" role="dialog" aria-label="Options" onClick={e=>e.stopPropagation()}>
   <div className="zp-move-list">{sheetGroup?<>
    <p className="zp-move-title"><small>Group</small><b>{sheetGroup.name}</b></p>
    <button type="button" onClick={()=>{setSheet(null);setCreating(sheetGroup.id);}}>New project here</button>
    <button type="button" onClick={()=>{setSheet(null);setAdding(sheetGroup);}}>Add existing projects</button>
    {canEditGroup(sheetGroup)&&<><button type="button" onClick={()=>{setSheet(null);setEditing(sheetGroup);}}>Edit group</button>
    <button type="button" className="is-danger" onClick={()=>{setSheet(null);void deleteGroup(sheetGroup.id,sheetGroup.list.length);}}>Delete group</button></>}
   </>:<>
    <p className="zp-move-title"><small>Projects</small></p>
    <button type="button" onClick={()=>{setSheet(null);setCreating(true);}}>New project</button>
    {me.zarnAdmin&&<button type="button" onClick={()=>{setSheet(null);setEditing('new');}}>New group</button>}
    <button type="button" onClick={()=>{setSheet(null);setManaging(true);}}>Manage groups</button>
   </>}</div>
   <button type="button" className="zp-move-cancel" onClick={()=>setSheet(null)}>Cancel</button>
  </div></div>}
  {creating&&<NewProject groupId={typeof creating==='string'?creating:undefined} onClose={()=>setCreating(false)}/>}
  {editing&&<GroupDialog group={editing==='new'?undefined:editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);void reloadProjects();}}/>}
  {managing&&<ManageGroups onClose={()=>setManaging(false)}/>}
  {adding&&<AddExisting group={adding} onClose={()=>setAdding(null)} onDone={()=>{setAdding(null);void reloadProjects();}}/>}
 </div>;
}
