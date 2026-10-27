'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {CheckCircle2} from 'lucide-react';
import type {ZMessage} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {Modal} from './Dialogs';
import AssigneePicker from './AssigneePicker';
import Dropdown from '@/components/ui/Dropdown';
import {plain,timeOf} from './format';

type Priority='low'|'medium'|'high';
const priorities:{key:Priority;label:string}[]=[{key:'low',label:'Low'},{key:'medium',label:'Medium'},{key:'high',label:'High'}];

// Turn a chat message into a task. Project chats file it under that project, client chats under that client,
// anything else lets you pick a project (or keep it personal). You review it and choose its column before saving.
export default function AddToTask({m,onClose}:{m:ZMessage;onClose:()=>void}){
 const {db,me,people,members,channels,projects,taskStatuses,title:channelName,refreshDue}=useZarn();
 const ch=channels.find(c=>c.id===m.channel_id);
 const fixedProject=ch?.kind==='project'?ch.project_id??null:null,leadId=ch?.kind==='client'?ch.lead_id:null;
 const text=plain(m.body,people).trim(),author=m.user_id?people[m.user_id]?.display_name??m.author_name??'Someone':m.author_name??'Someone';
 // Voice notes, files and CRM cards have no text to name the task after, so describe what was sent.
 const att=m.attachments[0],what=m.kind==='crm'?'CRM update':att?att.type.startsWith('audio/')?'voice note':att.name:'message';
 const firstLine=text.split('\n').find(l=>l.trim())?.trim()||`Follow up on ${what} from ${author}`;
 const [name,setName]=useState(firstLine.length>120?`${firstLine.slice(0,117)}…`:firstLine);
 const [description,setDescription]=useState(`${text||(att?m.attachments.map(a=>a.name).join(', '):'')}\n\nFrom ${author} in ${ch?channelName(ch):'chat'}, ${new Date(m.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} ${timeOf(m.created_at)}`.trim());
 const [status,setStatus]=useState('todo'),[priority,setPriority]=useState<Priority>('medium'),[due,setDue]=useState('');
 const [projectId,setProjectId]=useState(fixedProject??''),[assignees,setAssignees]=useState<string[]>([me.user_id]);
 const [scoped,setScoped]=useState<{key:string;ids:string[]}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);

 // Who can be assigned: the client's team, the project's members, or the whole team for a personal task.
 const everyone=members.filter(x=>!x.deactivated_at&&x.account_type==='member').map(x=>x.user_id);
 const scopeKey=leadId?`c:${m.channel_id}`:projectId?`p:${projectId}`:'';
 const candidates=!scopeKey?everyone:scoped?.key===scopeKey?scoped.ids.filter(id=>everyone.includes(id)):[];
 useEffect(()=>{
  if(!scopeKey)return;
  let live=true;
  const q=leadId?db.from('zarn_channel_members').select('user_id').eq('channel_id',m.channel_id):db.from('zarn_project_members').select('user_id').eq('project_id',projectId);
  void q.then(({data}:{data:{user_id:string}[]|null})=>{if(!live)return;const ids=(data??[]).map(r=>r.user_id);setScoped({key:scopeKey,ids});setAssignees(a=>a.filter(x=>ids.includes(x)));});
  return()=>{live=false;};
 },[db,scopeKey,leadId,projectId,m.channel_id]);

 async function save(e:React.FormEvent){
  e.preventDefault();
  if(!name.trim()){setError('Give the task a name.');return;}
  setBusy(true);setError('');
  try{
   const pid=projectId||null;
   const {data,error:err}=await db.from('zarn_tasks').insert({title:name.trim(),description:description.slice(0,4000),status,priority,due_at:due||null,project_id:pid,lead_id:leadId,created_by:me.user_id,position:Date.now()/1000}).select('id').single();
   if(err||!data)throw err;
   if(assignees.length){const {error:e2}=await db.from('zarn_task_assignees').insert(assignees.map(u=>({task_id:(data as {id:string}).id,user_id:u,project_id:pid})));if(e2)throw e2;}
   void refreshDue();setDone(true);
  }catch{setError('Could not create that task. Try again.');setBusy(false);}
 }

 const where=leadId?`/zarn/clients/${leadId}`:projectId?`/zarn/projects/${projectId}`:'/zarn/todos';
 const statusLabel=taskStatuses.find(s=>s.key===status)?.label??'To-do';
 if(done)return <Modal title="Added to tasks" onClose={onClose}><div className="zn-modal-body">
  <p className="zn-task-done"><CheckCircle2 size={18}/>“{name.trim()}” is in {statusLabel}.</p>
  <div className="zn-modal-foot"><Link href={where} className="zn-btn" onClick={onClose}>Open tasks</Link><button type="button" className="zn-btn is-primary" onClick={onClose}>Done</button></div>
 </div></Modal>;

 return <Modal title="Add to task" onClose={onClose} wide><form className="zn-modal-body" onSubmit={save}>
  <label className="zn-label">Task name<input className="zn-input" autoFocus maxLength={200} value={name} onChange={e=>setName(e.target.value)} placeholder="What needs doing?"/></label>
  <label className="zn-label">Details<textarea className="zn-input" rows={4} maxLength={4000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
  <div className="zn-label">Add to<div className="zn-status-pick" role="radiogroup" aria-label="Status">{taskStatuses.map(s=><button key={s.key} type="button" role="radio" aria-checked={status===s.key} className={status===s.key?'is-on':''} style={status===s.key?{background:s.color,borderColor:s.color}:undefined} onClick={()=>setStatus(s.key)}><i style={{background:s.color}}/>{s.label}</button>)}</div></div>
  {!fixedProject&&!leadId&&<div className="zn-label">Project<Dropdown label="Project" value={projectId} onChange={setProjectId} options={[{value:'',label:'No project (personal)'},...(projects??[]).map(p=>({value:p.id,label:p.name}))]}/></div>}
  <div className="zn-form-row">
   <div className="zn-label">Priority<Dropdown label="Priority" value={priority} onChange={v=>setPriority(v as Priority)} options={priorities.map(p=>({value:p.key,label:p.label}))}/></div>
   <label className="zn-label">Due date<input type="date" className="zn-input" value={due} onChange={e=>setDue(e.target.value)}/></label>
  </div>
  <div className="zn-label">Assign to<AssigneePicker candidates={candidates} value={assignees} onToggle={u=>setAssignees(a=>a.includes(u)?a.filter(x=>x!==u):[...a,u])}/></div>
  {error&&<p className="zn-error" role="alert">{error}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy}>{busy?'Adding…':'Add task'}</button></div>
 </form></Modal>;
}
