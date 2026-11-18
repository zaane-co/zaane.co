'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowDown,ArrowUp,ChevronRight,FileSpreadsheet,FileText,Plus,Trash2,UserPlus} from 'lucide-react';
import {useConfirm} from './ConfirmProvider';
import {useZarn,type ZProject} from './ZarnProvider';
import {Modal} from './Dialogs';
import {Avatar,dayOf} from './format';
import Dropdown from '@/components/ui/Dropdown';

export const groupColors=['#52525b','#c40a3a','#2563eb','#16a34a','#7c3aed','#ea580c','#0891b2','#db2777'];

// Pick a group for a project, or make a new one right there. Returns the chosen group's id (creating it if needed).
export function GroupField({value,onChange,newName,setNewName}:{value:string;onChange:(v:string)=>void;newName:string;setNewName:(v:string)=>void}){
 const {projectGroups}=useZarn();
 const creating=value==='__new'||!projectGroups.length;
 return <div className="zn-label">Group
  {projectGroups.length>0&&<Dropdown label="Group" value={creating?'__new':value} onChange={onChange} placeholder="Choose a group" options={[...projectGroups.map(g=>({value:g.id,label:g.name,color:g.color})),{value:'__new',label:'+ Create a new group…',group:' '}]}/>}
  {creating&&<input className="zn-input" autoFocus={!projectGroups.length} maxLength={60} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="New group name, e.g. Products"/>}
 </div>;
}
export async function resolveGroup(db:ReturnType<typeof useZarn>['db'],me:string,value:string,newName:string,hasGroups:boolean){
 if(value&&value!=='__new'&&hasGroups)return value;
 const name=newName.trim();if(!name)throw new Error('Choose a group or name a new one.');
 const id=crypto.randomUUID();
 const {error}=await db.from('zarn_project_groups').insert({id,name:name.slice(0,60),color:groupColors[Math.floor(Math.random()*groupColors.length)],created_by:me});
 if(error)throw new Error('Could not create the group.');
 return id;
}

// Move a project into another group (or a new one).
export function MoveToGroup({project,onClose,onMoved}:{project:ZProject;onClose:()=>void;onMoved:()=>void}){
 const {db,me,projectGroups}=useZarn();
 const [value,setValue]=useState(project.group_id??''),[newName,setNewName]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 async function go(e:React.FormEvent){e.preventDefault();setBusy(true);setErr('');
  try{const gid=await resolveGroup(db,me.user_id,value,newName,projectGroups.length>0);
   const {error}=await db.from('zarn_projects').update({group_id:gid}).eq('id',project.id);if(error)throw new Error('Could not move the project.');onMoved();}
  catch(x){setErr(x instanceof Error?x.message:'Could not move the project.');setBusy(false);}}
 return <Modal title={`Move “${project.name}”`} onClose={onClose}><form className="zn-modal-body" onSubmit={go}>
  <GroupField value={value} onChange={setValue} newName={newName} setNewName={setNewName}/>
  {err&&<p className="zn-error" role="alert">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy}>Move</button></div>
 </form></Modal>;
}

// Team tab: who is on the project, with invite and remove.
export function ProjectTeam({project,members,canManage,onInvite,onRemove}:{project:ZProject;members:string[];canManage:boolean;onInvite:()=>void;onRemove:(u:string)=>void}){
 const {people,me}=useZarn();
 return <div className="zpx-wrap">
  <div className="zpx-head"><h2>Team · {members.length}</h2><button type="button" className="zp-btn is-dark" onClick={onInvite}><UserPlus size={15}/>Invite</button></div>
  <div className="zpx-team">{members.map(u=>{const p=people[u],owner=project.created_by===u,self=u===me.user_id;return <div key={u} className="zpx-person">
   <Avatar m={p} size={44}/><div><b>{p?.display_name??'Member'}{self&&' (you)'}</b><small>{owner?'Project owner':p?.title||p?.email||'Member'}</small></div>
   {!owner&&(canManage||self)&&<button type="button" className="zn-btn" onClick={()=>onRemove(u)}>{self?'Leave':'Remove'}</button>}
  </div>;})}</div>
 </div>;
}

type DocRow={id:string;title:string;kind:string;owner_id:string;updated_at:string};
// Documentation tab: docs and sheets that belong to this project. Everyone on the project can open and edit them.
export function ProjectDocs({projectId}:{projectId:string}){
 const {db,me,people}=useZarn(),router=useRouter();
 const [rows,setRows]=useState<DocRow[]|null>(null),[err,setErr]=useState('');
 const load=useCallback(async()=>{const {data}=await db.from('zarn_docs').select('id,title,kind,owner_id,updated_at').eq('project_id',projectId).is('trashed_at',null).order('updated_at',{ascending:false});setRows((data??[]) as DocRow[]);},[db,projectId]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves, not synchronously
 useEffect(()=>{void load();},[load]);
 async function create(sheet:boolean){
  setErr('');const id=crypto.randomUUID();
  const {error}=await db.from('zarn_docs').insert({id,owner_id:me.user_id,project_id:projectId,title:sheet?'Untitled sheet':'Untitled',...(sheet?{kind:'sheet',content:JSON.stringify({tabs:[{id:'s1',name:'Sheet1',cells:{}}]})}:{})});
  if(error){setErr('Could not create it.');return;}
  router.push(sheet?`/zarn/sheets/${id}`:`/zarn/docs/${id}`);
 }
 return <div className="zpx-wrap">
  <div className="zpx-head is-docs"><h2>Documentation</h2><span className="zpx-actions"><button type="button" className="zp-btn" onClick={()=>void create(true)}><FileSpreadsheet size={15}/>New sheet</button><button type="button" className="zp-btn is-dark" onClick={()=>void create(false)}><Plus size={15}/>New doc</button></span></div>
  {err&&<p className="zn-error" role="alert">{err}</p>}
  {rows===null?<p className="zn-loading">Loading…</p>:rows.length?<div className="zpx-docs">{rows.map(d=><Link key={d.id} href={d.kind==='sheet'?`/zarn/sheets/${d.id}`:`/zarn/docs/${d.id}`} className="zpx-doc">
   {d.kind==='sheet'?<FileSpreadsheet size={20} className="zdr-ic is-sheet"/>:<FileText size={20} className="zdr-ic is-doc"/>}
   <span><b>{d.title||'Untitled'}</b><small>{d.owner_id===me.user_id?'You':people[d.owner_id]?.display_name??'Someone'} · {dayOf(d.updated_at)}</small></span>
   <ChevronRight size={18} className="zpx-chev" aria-hidden/>
  </Link>)}</div>
  :<div className="zn-empty-state"><h2>No documentation yet</h2><p>Write specs, notes, how-tos and decisions here. Everyone on the project can open and edit them.</p></div>}
 </div>;
}

// Create or edit a group: name and colour. Groups can exist empty; projects are added to them later.
export function GroupDialog({group,onClose,onSaved}:{group?:{id:string;name:string;color:string};onClose:()=>void;onSaved:()=>void}){
 const {db,me}=useZarn();
 const [name,setName]=useState(group?.name??''),[color,setColor]=useState(group?.color??groupColors[1]),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 async function go(e:React.FormEvent){e.preventDefault();const n=name.trim();if(!n)return;setBusy(true);setErr('');
  const {error}=group?await db.from('zarn_project_groups').update({name:n.slice(0,60),color}).eq('id',group.id)
   :await db.from('zarn_project_groups').insert({id:crypto.randomUUID(),name:n.slice(0,60),color,created_by:me.user_id});
  if(error){setErr(group?'Could not save the group.':'Could not create the group.');setBusy(false);return;}
  onSaved();}
 return <Modal title={group?'Edit group':'New group'} onClose={onClose}><form className="zn-modal-body" onSubmit={go}>
  <label className="zn-label">Name<input className="zn-input" autoFocus maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Products, Internal tools"/></label>
  <div className="zn-label">Colour<div className="zp-colors">{groupColors.map(c=><button key={c} type="button" aria-label={c} aria-pressed={color===c} className={color===c?'is-on':''} style={{background:c}} onClick={()=>setColor(c)}/>)}</div></div>
  {err&&<p className="zn-error" role="alert">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy||!name.trim()}>{group?'Save':'Create group'}</button></div>
 </form></Modal>;
}

// Put projects that are already made into a group.
export function AddExisting({group,onClose,onDone}:{group:{id:string;name:string};onClose:()=>void;onDone:()=>void}){
 const {db,projects}=useZarn();
 const options=(projects??[]).filter(p=>!p.lead_id&&p.group_id!==group.id);
 const [picked,setPicked]=useState<string[]>([]),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 async function go(){setBusy(true);setErr('');const {error}=await db.from('zarn_projects').update({group_id:group.id}).in('id',picked);if(error){setErr('Some projects could not be moved. Only a project’s owner or an admin can move it.');setBusy(false);return;}onDone();}
 return <Modal title={`Add projects to ${group.name}`} onClose={onClose}><div className="zn-modal-body">
  {options.length?<ul className="zpx-pick">{options.map(p=><li key={p.id}><label><input type="checkbox" checked={picked.includes(p.id)} onChange={e=>setPicked(x=>e.target.checked?[...x,p.id]:x.filter(i=>i!==p.id))}/><span className="zp-badge" style={{background:p.color,width:24,height:24,fontSize:12,borderRadius:7}}>{p.name.slice(0,1).toUpperCase()}</span><b>{p.name}</b>{p.archived_at&&<em className="zpc-tag">Archived</em>}</label></li>)}</ul>
   :<p className="zn-nav-note">Every project is already in this group.</p>}
  {err&&<p className="zn-error" role="alert">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="button" className="zn-btn is-primary" disabled={busy||!picked.length} onClick={()=>void go()}>Add {picked.length||''}</button></div>
 </div></Modal>;
}

// All groups in one place: rename, recolour, reorder, delete, or add a new one.
export function ManageGroups({onClose}:{onClose:()=>void}){
 const {db,me,projectGroups,projects,reloadProjects}=useZarn(),confirm=useConfirm();
 const rows=projectGroups,[drafts,setDrafts]=useState<Record<string,string>>({});
 const [newName,setNewName]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const count=(id:string)=>(projects??[]).filter(p=>p.group_id===id&&!p.lead_id).length;
 const canEdit=(g:{created_by:string|null})=>g.created_by===me.user_id||me.zarnAdmin;
 async function save(id:string,patch:{name?:string;color?:string;position?:number}){setErr('');const {error}=await db.from('zarn_project_groups').update(patch).eq('id',id);if(error)setErr('Could not save that change.');await reloadProjects();}
 async function add(e:React.FormEvent){e.preventDefault();const n=newName.trim();if(!n)return;setBusy(true);setErr('');
  const last=rows.at(-1)?.position??0;
  const {error}=await db.from('zarn_project_groups').insert({id:crypto.randomUUID(),name:n.slice(0,60),color:groupColors[(rows.length+1)%groupColors.length],position:last+1,created_by:me.user_id});
  setBusy(false);if(error){setErr('Could not create the group.');return;}setNewName('');await reloadProjects();}
 async function move(i:number,d:-1|1){const a=rows[i],b=rows[i+d];if(!a||!b)return;await Promise.all([db.from('zarn_project_groups').update({position:b.position}).eq('id',a.id),db.from('zarn_project_groups').update({position:a.position}).eq('id',b.id)]);await reloadProjects();}
 async function remove(g:{id:string;name:string}){const n=count(g.id);if(!await confirm({title:`Delete the “${g.name}” group?`,message:n?`Its ${n} project${n===1?'':'s'} stay, under “No group”.`:'The group is empty.',confirm:'Delete group',danger:true}))return;await db.from('zarn_project_groups').delete().eq('id',g.id);await reloadProjects();}
 return <Modal title="Manage groups" onClose={onClose} wide><div className="zn-modal-body">
  {rows.length?<ul className="zmg-list">{rows.map((g,i)=><li key={g.id}>
   <span className="zmg-order"><button type="button" aria-label="Move up" disabled={i===0||!canEdit(g)} onClick={()=>void move(i,-1)}><ArrowUp size={14}/></button><button type="button" aria-label="Move down" disabled={i===rows.length-1||!canEdit(g)} onClick={()=>void move(i,1)}><ArrowDown size={14}/></button></span>
   <input className="zn-input" value={drafts[g.id]??g.name} maxLength={60} disabled={!canEdit(g)} aria-label="Group name" onChange={e=>setDrafts(d=>({...d,[g.id]:e.target.value}))} onBlur={e=>{const v=e.target.value.trim();if(v&&v!==g.name)void save(g.id,{name:v});}}/>
   <span className="zmg-colors">{groupColors.map(c=><button key={c} type="button" aria-label={`Colour ${c}`} disabled={!canEdit(g)} className={g.color===c?'is-on':''} style={{background:c}} onClick={()=>void save(g.id,{color:c})}/>)}</span>
   <small>{count(g.id)} project{count(g.id)===1?'':'s'}</small>
   <button type="button" className="zmg-del" aria-label={`Delete ${g.name}`} disabled={!canEdit(g)} onClick={()=>void remove(g)}><Trash2 size={15}/></button>
  </li>)}</ul>:<p className="zn-nav-note">No groups yet. Add your first one below.</p>}
  <form className="zmg-new" onSubmit={add}><input className="zn-input" value={newName} maxLength={60} onChange={e=>setNewName(e.target.value)} placeholder="New group name, e.g. Products"/><button className="zn-btn is-primary" disabled={busy||!newName.trim()}><Plus size={14}/>Add group</button></form>
  {err&&<p className="zn-error" role="alert">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn is-primary" onClick={onClose}>Done</button></div>
 </div></Modal>;
}
