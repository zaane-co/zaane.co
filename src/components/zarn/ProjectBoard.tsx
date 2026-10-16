'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {FolderKanban,FileText,Bookmark,CalendarDays,ChartGantt,ChevronDown,Ellipsis,Kanban,List,ListChecks,ListFilter,Plus,Search,Send,Trash2,UserPlus,X} from 'lucide-react';
import {useZarn,type ZProject} from './ZarnProvider';
import {Modal,PeoplePicker} from './Dialogs';
import AddStatusDialog from './AddStatusDialog';
import ProjectBrief from './ProjectBrief';
import AssigneePicker from './AssigneePicker';
import {NewProject} from './Projects';
import {Avatar,dayOf,timeOf} from './format';
import SavedMessages from './SavedMessages';
import Dropdown from '@/components/ui/Dropdown';
import {useConfirm} from './ConfirmProvider';

export type TaskStatus=string;
type Priority='low'|'medium'|'high';
type Task={id:string;project_id:string|null;title:string;description:string;status:TaskStatus;type:string;priority:Priority;start_at:string|null;due_at:string|null;position:number;created_by:string|null;created_at:string};
type Comment={id:string;task_id:string;user_id:string|null;body:string;created_at:string};
type View='kanban'|'timeline'|'list'|'saved'|'brief';
type Form={title:string;description:string;status:TaskStatus;type:string;priority:Priority;start_at:string;due_at:string;project_id:string;assignees:string[]};

const BASE_STATUSES:{key:TaskStatus;label:string;color:string}[]=[{key:'todo',label:'To-do',color:'#71717a'},{key:'in_progress',label:'On progress',color:'#2563eb'},{key:'in_review',label:'In review',color:'#d97706'},{key:'done',label:'Done',color:'#16a34a'}];
const priorities:{key:Priority;label:string;color:string}[]=[{key:'low',label:'Low',color:'#2563eb'},{key:'medium',label:'Medium',color:'#d97706'},{key:'high',label:'High',color:'#dc2626'}];
const typePalette=['#7c3aed','#ea580c','#0891b2','#db2777','#16a34a','#2563eb'];
const typeColor=(t:string)=>typePalette[[...t].reduce((a,c)=>a+c.charCodeAt(0),0)%typePalette.length];
const typeSuggestions=['Design','Development','Marketing','Research','Content','Admin'];
const DAY=86400000;
const iso=(d:Date)=>d.toISOString().slice(0,10);
const day=(s:string)=>new Date(s+'T00:00:00Z').getTime();
const fmt=(s:string)=>new Date(s+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const blank=(status:TaskStatus,me:string,project_id=''):Form=>({title:'',description:'',status,type:'',priority:'medium',start_at:'',due_at:'',project_id,assignees:[me]});
const estimate=(t:Task)=>t.start_at&&t.due_at?`${fmt(t.start_at)} - ${fmt(t.due_at)}`:t.due_at?`Due ${fmt(t.due_at)}`:t.start_at?`From ${fmt(t.start_at)}`:'-';

function Stack({ids,max=3}:{ids:string[];max?:number}){
 const {people}=useZarn();
 if(!ids.length)return <span className="zp-muted">-</span>;
 return <span className="zp-stack">{ids.slice(0,max).map(id=><Avatar key={id} m={people[id]} size={24}/>)}{ids.length>max&&<em>+{ids.length-max}</em>}</span>;
}

// Tasks as a list, kanban or timeline. With an id it is one project; without one it is "My tasks":
// everything you created or were assigned, across projects and on its own.
export default function ProjectBoard({id,leadId}:{id?:string;leadId?:string}){
 const z=useZarn(),{db,me,people,members:team,projects,reloadProjects,refreshDue,reloadStatuses}=z,router=useRouter(),confirm=useConfirm();
 const statuses=z.taskStatuses.length?z.taskStatuses.map(x=>({key:x.key,label:x.label,color:x.color,builtin:x.builtin,created_by:x.created_by})):BASE_STATUSES.map(x=>({...x,builtin:true,created_by:null as string|null}));
 const [addingStatus,setAddingStatus]=useState<{then?:(key:string)=>void}|null>(null),[newProject,setNewProject]=useState<{then?:(id:string)=>void}|null>(null);
 // multi: tasks from several projects (my tasks, or one client's projects). mine: my own tasks across everything.
 const multi=!id,mine=!id&&!leadId;
 const clientProjects=useMemo(()=>leadId?(projects??[]).filter(p=>p.lead_id===leadId):[],[projects,leadId]);
 const clientKey=clientProjects.map(p=>p.id).join(',');
 const [project,setProject]=useState<ZProject|null|undefined>(multi?null:undefined),[members,setMembers]=useState<string[]>([]),[tasks,setTasks]=useState<Task[]>([]),[assign,setAssign]=useState<Record<string,string[]>>({}),[loaded,setLoaded]=useState(false);
 const [view,setView]=useState<View>('list'),[q,setQ]=useState(''),[prio,setPrio]=useState<'all'|Priority>('all'),[who,setWho]=useState('all'),[collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 const [form,setForm]=useState<Form|null>(null),[open,setOpen]=useState<string|null>(null),[inviting,setInviting]=useState(false),[showMembers,setShowMembers]=useState(false),[menu,setMenu]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[dragging,setDragging]=useState<string|null>(null);
 const [formMembers,setFormMembers]=useState<string[]|null>(null);

 useEffect(()=>{const v=new URLSearchParams(window.location.search).get('view');if(v==='kanban'||v==='timeline'||v==='list'||(mine&&v==='saved')||(!multi&&v==='brief'))setView(v);},[mine,multi]);
 const pick=(v:View)=>{setView(v);window.history.replaceState(null,'',`?view=${v}`);};
 const everyone=useMemo(()=>team.filter(m=>!m.deactivated_at&&m.joined_at&&m.account_type==='member').map(m=>m.user_id),[team]);

 const load=useCallback(async()=>{
  let taskRows:Task[]=[];
  if(id){
   const [{data:pr},{data:pm},{data:tk}]=await Promise.all([
    db.from('zarn_projects').select('id,name,description,color,lead_id,brief,created_by,created_at').eq('id',id).maybeSingle(),
    db.from('zarn_project_members').select('user_id').eq('project_id',id),
    db.from('zarn_tasks').select('*').eq('project_id',id).order('position'),
   ]);
   setProject((pr as ZProject|null)??null);setMembers(((pm??[]) as {user_id:string}[]).map(x=>x.user_id));taskRows=(tk??[]) as Task[];
  }else if(leadId){
   const pids=clientKey?clientKey.split(','):[];
   if(pids.length){const {data}=await db.from('zarn_tasks').select('*').in('project_id',pids).order('position');taskRows=(data??[]) as Task[];}
  }else{
   const [{data:a},{data:c}]=await Promise.all([db.from('zarn_task_assignees').select('task_id').eq('user_id',me.user_id),db.from('zarn_tasks').select('id').eq('created_by',me.user_id)]);
   const ids=[...new Set([...((a??[]) as {task_id:string}[]).map(x=>x.task_id),...((c??[]) as {id:string}[]).map(x=>x.id)])];
   for(let i=0;i<ids.length;i+=100){const {data}=await db.from('zarn_tasks').select('*').in('id',ids.slice(i,i+100));taskRows.push(...((data??[]) as Task[]));}
   taskRows.sort((x,y)=>x.position-y.position);
  }
  setTasks(taskRows);
  const map:Record<string,string[]>={};
  for(let i=0;i<taskRows.length;i+=100){const {data}=await db.from('zarn_task_assignees').select('task_id,user_id').in('task_id',taskRows.slice(i,i+100).map(t=>t.id));for(const r of (data??[]) as {task_id:string;user_id:string}[])(map[r.task_id]??=[]).push(r.user_id);}
  setAssign(map);setLoaded(true);
 },[db,id,leadId,clientKey,me.user_id]);
 useEffect(()=>{void load();},[load]);

 // Who can be assigned: the project's members, or the whole team for a task with no project.
 const chipMembersFor=useCallback(async(projectId:string|null):Promise<string[]>=>{
  if(!projectId)return everyone;
  if(projectId===id)return members;
  const {data}=await db.from('zarn_project_members').select('user_id').eq('project_id',projectId);
  return ((data??[]) as {user_id:string}[]).map(x=>x.user_id);
 },[db,everyone,id,members]);
 useEffect(()=>{if(!form){setFormMembers(null);return;}let live=true;void chipMembersFor(form.project_id||null).then(m=>{if(live)setFormMembers(m);});return()=>{live=false;};},[form?.project_id,!!form,chipMembersFor]); // eslint-disable-line react-hooks/exhaustive-deps

 const canManage=!multi&&!!project&&(project.created_by===me.user_id||me.staffRole==='super_admin'||me.staffRole==='admin');
 const projectName=(pid:string|null)=>pid?(projects??[]).find(p=>p.id===pid)?.name??'Project':'';
 const shown=useMemo(()=>tasks.filter(t=>(prio==='all'||t.priority===prio)&&(who==='all'||(who==='me'?(assign[t.id]??[]).includes(me.user_id):(assign[t.id]??[]).includes(who)))&&`${t.title} ${t.description} ${t.type} ${projectName(t.project_id)}`.toLowerCase().includes(q.toLowerCase())),[tasks,assign,q,prio,who,me.user_id,projects]); // eslint-disable-line react-hooks/exhaustive-deps
 const typeOptions=useMemo(()=>[...new Set([...typeSuggestions,...tasks.map(t=>t.type).filter(Boolean)])],[tasks]);
 const filterPeople=multi?everyone.filter(m=>m!==me.user_id):members.filter(m=>m!==me.user_id);

 async function create(e:React.FormEvent){
  e.preventDefault();if(!form)return;
  if(!form.title.trim()){setError('Give the task a name.');return;}
  if(leadId&&!form.project_id){setError('Choose which of this client’s projects the task belongs to.');return;}
  if(form.start_at&&form.due_at&&form.start_at>form.due_at){setError('The start date can’t be after the due date.');return;}
  setBusy(true);setError('');
  try{
   const projectId=id??(form.project_id||null);
   const {data,error:err}=await db.from('zarn_tasks').insert({title:form.title.trim(),description:form.description,status:form.status,type:form.type.trim(),priority:form.priority,start_at:form.start_at||null,due_at:form.due_at||null,project_id:projectId,created_by:me.user_id,position:Date.now()/1000}).select('*').single();
   if(err||!data)throw err;
   const t=data as Task;
   if(form.assignees.length){const {error:e2}=await db.from('zarn_task_assignees').insert(form.assignees.map(u=>({task_id:t.id,user_id:u,project_id:projectId})));if(e2)throw e2;}
   setTasks(ts=>[...ts,t]);setAssign(a=>({...a,[t.id]:form.assignees}));setForm(null);void refreshDue();
  }catch{setError('Could not create that task. Try again.');}finally{setBusy(false);}
 }
 async function patch(taskId:string,values:Partial<Pick<Task,'title'|'description'|'status'|'type'|'priority'|'start_at'|'due_at'>>){
  const before=tasks.find(t=>t.id===taskId);if(!before)return;
  const extra=values.status?{position:Date.now()/1000}:{};
  setTasks(ts=>ts.map(t=>t.id===taskId?{...t,...values,...extra}:t));
  const {error:err}=await db.from('zarn_tasks').update({...values,...extra,updated_at:new Date().toISOString()}).eq('id',taskId);
  if(err){setTasks(ts=>ts.map(t=>t.id===taskId?before:t));return false;}
  void refreshDue();return true;
 }
 async function toggleAssignee(t:Task,userId:string){
  const has=(assign[t.id]??[]).includes(userId);
  setAssign(a=>({...a,[t.id]:has?(a[t.id]??[]).filter(x=>x!==userId):[...(a[t.id]??[]),userId]}));
  const {error:err}=has?await db.from('zarn_task_assignees').delete().eq('task_id',t.id).eq('user_id',userId):await db.from('zarn_task_assignees').insert({task_id:t.id,user_id:userId,project_id:t.project_id});
  if(err)setAssign(a=>({...a,[t.id]:has?[...(a[t.id]??[]),userId]:(a[t.id]??[]).filter(x=>x!==userId)}));
  void refreshDue();
 }
 async function remove(taskId:string){setTasks(ts=>ts.filter(t=>t.id!==taskId));setOpen(null);await db.from('zarn_tasks').delete().eq('id',taskId);void refreshDue();}
 async function invite(ids:string[]){
  const {error:err}=await db.from('zarn_project_members').insert(ids.map(u=>({project_id:id!,user_id:u,added_by:me.user_id})));
  if(err)throw new Error('Could not add them.');
  setMembers(m=>[...m,...ids]);setInviting(false);
 }
 async function removeMember(userId:string){
  const self=userId===me.user_id,name=people[userId]?.display_name??'this person';
  if(!await confirm({title:self?'Leave this project?':`Remove ${name}?`,message:self?`You will no longer see “${project?.name}” or its tasks.`:`${name} will lose access to “${project?.name}” and be taken off its tasks.`,confirm:self?'Leave':'Remove',danger:true}))return;
  const {error:err}=await db.from('zarn_project_members').delete().eq('project_id',id!).eq('user_id',userId);
  if(err){setError('Could not remove them.');return;}
  await db.from('zarn_task_assignees').delete().eq('project_id',id!).eq('user_id',userId);
  setMembers(m=>m.filter(x=>x!==userId));setAssign(a=>Object.fromEntries(Object.entries(a).map(([k,v])=>[k,v.filter(x=>x!==userId)])));
  void refreshDue();
  if(self){await reloadProjects();router.push('/zarn/projects');}
 }
 async function deleteProject(){
  if(!await confirm({title:'Delete this project?',message:`“${project?.name}” and all its tasks will be deleted. This can’t be undone.`,confirm:'Delete project',danger:true}))return;
  await db.from('zarn_projects').delete().eq('id',id!);await reloadProjects();router.push('/zarn/projects');
 }
 const add=(s:TaskStatus='todo')=>{setError('');setForm(blank(s,me.user_id,id??clientProjects[0]?.id??''));};
 const pill=(p:Priority)=>{const x=priorities.find(i=>i.key===p)!;return <span className="zp-pill" style={{background:x.color}}>{x.label}</span>;};
 const typePill=(t:string)=>t?<span className="zp-pill" style={{background:typeColor(t)}}>{t}</span>:<span className="zp-muted">-</span>;
 const projectPill=(pid:string|null)=>pid?<Link href={`/zarn/projects/${pid}`} className="zp-proj" onClick={e=>e.stopPropagation()}>{projectName(pid)}</Link>:<span className="zp-muted">Personal</span>;
 const isOpen=(k:string)=>!collapsed[k];
 const today=iso(new Date());
 const overdue=(t:Task)=>!!t.due_at&&t.status!=='done'&&t.due_at<today;

 if(project===undefined)return <div className="zn-page"><p className="zn-loading">Loading…</p></div>;
 if(project===null&&!multi)return <div className="zn-page"><div className="zn-empty-state"><h2>Project not found</h2><p>It may have been deleted, or you haven’t been added to it.</p></div></div>;
 // A client with no projects yet: tasks live inside projects, so start one first.
 if(leadId&&loaded&&!clientProjects.length)return <div className="zn-pane"><div className="zn-empty-state"><FolderKanban size={26}/><h2>No projects for this client yet</h2><p>Tasks live inside projects. Start a project for this client, then add its tasks here as a list, board or timeline.</p><button type="button" className="zn-btn is-primary" onClick={()=>setNewProject({})}><Plus size={14}/>New project</button></div>{newProject&&<NewProject clientId={leadId} onClose={()=>setNewProject(null)} onCreated={()=>setNewProject(null)}/>}</div>;

 const empty=!loaded?<p className="zn-loading">Loading…</p>:null;
 const listView=<div className="zp-list">{statuses.map(g=>{const rows=shown.filter(t=>t.status===g.key);return <section key={g.key} className="zp-group">
  <div className="zp-group-head"><button type="button" className="zp-group-toggle" aria-expanded={isOpen(g.key)} onClick={()=>setCollapsed(c=>({...c,[g.key]:isOpen(g.key)}))}><ChevronDown size={15} style={{transform:isOpen(g.key)?undefined:'rotate(-90deg)'}}/><i style={{background:g.color}}/><b>{g.label}</b><span className="zp-count">{rows.length}</span></button>
   <button type="button" className="zp-icon-btn" aria-label={`Add task to ${g.label}`} data-tip="Add task" onClick={()=>add(g.key)}><Plus size={15}/></button></div>
  {isOpen(g.key)&&(rows.length?<div className="zp-table-wrap"><table className="zp-table"><thead><tr><th/><th>Task name</th><th className="zp-hide-sm">Description</th><th>Estimation</th><th className="zp-hide-sm">{mine?'Project':'Type'}</th><th>People</th><th>Priority</th><th/></tr></thead>
   <tbody>{rows.map(t=><tr key={t.id} className={t.status==='done'?'is-done':''} onClick={()=>setOpen(t.id)}>
    <td onClick={e=>e.stopPropagation()}><button type="button" className="zp-check" aria-pressed={t.status==='done'} aria-label={t.status==='done'?'Mark as not done':'Mark as done'} onClick={()=>void patch(t.id,{status:t.status==='done'?'todo':'done'})}>{t.status==='done'&&'✓'}</button></td>
    <td className="zp-name">{t.title}</td><td className="zp-hide-sm zp-desc">{t.description||'-'}</td>
    <td className={`zp-est${overdue(t)?' is-overdue':''}`}>{estimate(t)}</td>
    <td className="zp-hide-sm">{multi?projectPill(t.project_id):typePill(t.type)}</td><td><Stack ids={assign[t.id]??[]}/></td><td>{pill(t.priority)}</td>
    <td onClick={e=>e.stopPropagation()}><button type="button" className="zp-icon-btn" aria-label="Open details" data-tip="Open details" onClick={()=>setOpen(t.id)}><Ellipsis size={16}/></button></td>
   </tr>)}</tbody></table></div>:<p className="zp-empty-row">{q||prio!=='all'||who!=='all'?'Nothing matches.':'No tasks here.'}</p>)}
 </section>;})}</div>;

 const deleteStatus=async(g:{key:string;label:string})=>{
  if(!await confirm({title:`Delete “${g.label}”?`,message:'Tasks in this status move back to To-do. This can’t be undone.',confirm:'Delete status',danger:true}))return;
  const r=await fetch('/api/zarn/statuses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',key:g.key})});
  const d=await r.json().catch(()=>({}));if(!r.ok){setError(d.error||'Could not delete the status.');return;}
  setTasks(ts=>ts.map(t=>t.status===g.key?{...t,status:'todo'}:t));await reloadStatuses();
 };
 const kanbanView=<div className="zp-kanban" style={{gridTemplateColumns:`repeat(${statuses.length},minmax(250px,1fr)) 190px`,minWidth:statuses.length*264+204}}>{statuses.map(g=>{const rows=shown.filter(t=>t.status===g.key).sort((a,b)=>a.position-b.position);return <section key={g.key} className="zp-col" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const tid=e.dataTransfer.getData('text/plain');setDragging(null);if(tid)void patch(tid,{status:g.key});}}>
  <header><i style={{background:g.color}}/><b>{g.label}</b><span className="zp-count">{rows.length}</span>{!g.builtin&&(g.created_by===me.user_id||me.staffRole==='super_admin'||me.staffRole==='admin')&&<button type="button" className="zp-icon-btn zp-del-status" aria-label={`Delete status ${g.label}`} data-tip="Delete status" onClick={()=>void deleteStatus(g)}><Trash2 size={13}/></button>}<button type="button" className="zp-icon-btn" aria-label={`Add task to ${g.label}`} data-tip="Add task" onClick={()=>add(g.key)}><Plus size={15}/></button></header>
  <div className="zp-cards">{rows.map(t=><article key={t.id} className={`zp-card${t.status==='done'?' is-done':''}${dragging===t.id?' is-dragging':''}`} draggable onDragStart={e=>{e.dataTransfer.setData('text/plain',t.id);setDragging(t.id);}} onDragEnd={()=>setDragging(null)} onClick={()=>setOpen(t.id)}>
   <div className="zp-card-top">{multi&&t.project_id&&projectPill(t.project_id)}{typePill(t.type)}{pill(t.priority)}</div>
   <b>{t.title}</b>{t.description&&<p>{t.description}</p>}
   <footer><span className={`zp-est${overdue(t)?' is-overdue':''}`}><CalendarDays size={13}/>{estimate(t)}</span><Stack ids={assign[t.id]??[]}/></footer>
  </article>)}{!rows.length&&<p className="zp-empty-row">Drop tasks here</p>}</div>
 </section>;})}<button type="button" className="zp-addcol" onClick={()=>setAddingStatus({})}><Plus size={16}/>Add status</button></div>;

 const timelineView=(()=>{
  const dated=shown.filter(t=>t.start_at||t.due_at),undated=shown.filter(t=>!t.start_at&&!t.due_at);
  if(!dated.length)return <div className="zn-empty-state"><h2>No dates to plot</h2><p>Give tasks a start and due date and they appear on the timeline.</p></div>;
  const spans=dated.map(t=>({t,s:day((t.start_at??t.due_at)!),e:day((t.due_at??t.start_at)!)}));
  const min=Math.min(...spans.map(x=>x.s),day(today))-3*DAY,days=Math.max(28,Math.ceil((Math.max(...spans.map(x=>x.e),day(today))+8*DAY-min)/DAY)),W=34;
  const cols=Array.from({length:days},(_,i)=>new Date(min+i*DAY));
  const months:{label:string;n:number}[]=[];for(const d of cols){const l=d.toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'});if(months.at(-1)?.label===l)months.at(-1)!.n++;else months.push({label:l,n:1});}
  const todayX=((day(today)-min)/DAY)*W+W/2;
  return <div className="zp-timeline"><div className="zp-tl-scroll"><div className="zp-tl" style={{width:220+days*W}}>
   <div className="zp-tl-head"><div className="zp-tl-label"/><div className="zp-tl-cols" style={{width:days*W}}>
    <div className="zp-tl-months">{months.map(m=><span key={m.label} style={{width:m.n*W}}>{m.label}</span>)}</div>
    <div className="zp-tl-days">{cols.map((d,i)=><span key={i} className={iso(d)===today?'is-today':d.getUTCDay()%6===0?'is-weekend':''} style={{width:W}}>{d.getUTCDate()}</span>)}</div></div></div>
   <div className="zp-tl-body">
    <div className="zp-tl-today" style={{left:220+todayX}}/>
    {spans.map(({t,s,e})=>{const g=statuses.find(x=>x.key===t.status)??statuses[0]!;return <div key={t.id} className="zp-tl-row" onClick={()=>setOpen(t.id)}>
     <div className="zp-tl-label"><span>{t.title}</span><Stack ids={assign[t.id]??[]} max={2}/></div>
     <div className="zp-tl-track" style={{width:days*W,backgroundSize:`${W}px 100%`}}><div className="zp-tl-bar" style={{left:((s-min)/DAY)*W+3,width:Math.max(W-6,((e-s)/DAY+1)*W-6),background:g.color}} title={`${t.title} · ${estimate(t)}`}><span>{t.title}</span></div></div>
    </div>;})}
   </div></div></div>
   {undated.length>0&&<p className="zp-tl-note">No dates yet: {undated.map(t=>t.title).join(', ')}</p>}</div>;
 })();

 const openTask=tasks.find(t=>t.id===open);
 const views:[View,string,React.ReactNode][]=[['list','List',<List key="l" size={15}/>],['kanban','Kanban',<Kanban key="k" size={15}/>],['timeline','Timeline',<ChartGantt key="t" size={15}/>],...(leadId?[]:mine?[['saved','Saved',<Bookmark key="s" size={15}/>] as [View,string,React.ReactNode]]:[['brief','Brief',<FileText key="b" size={15}/>] as [View,string,React.ReactNode]])];
 return <div className="zn-page zp-page">
  {!leadId&&<header className="zp-head">
   {mine?<div className="zp-title"><span className="zp-badge is-ink"><ListChecks size={22}/></span><div><h1>To-dos</h1><p>Tasks you created or were assigned, across every project.</p></div></div>
    :<div className="zp-title"><span className="zp-badge" style={{background:project!.color}}>{project!.name.slice(0,1).toUpperCase()}</span><div><h1>{project!.name}</h1>{project!.description&&<p>{project!.description}</p>}{project!.lead_id&&(()=>{const c=z.channels.find(x=>x.kind==='client'&&x.lead_id===project!.lead_id);return c?<p><Link href={`/zarn/clients/${project!.lead_id}`} className="zp-client-link">Client: {z.title(c)}</Link></p>:null;})()}</div></div>}
   {!mine&&<div className="zp-head-right">
    <button type="button" className="zp-members" aria-label="Project members" data-tip="Members" onClick={()=>setShowMembers(true)}><Stack ids={members} max={4}/></button>
    <button type="button" className="zp-btn" onClick={()=>setInviting(true)}><UserPlus size={15}/>Invite</button>
    {canManage&&<div className="zp-menu"><button type="button" className="zp-icon-btn" aria-label="Project menu" onClick={()=>setMenu(v=>!v)}><Ellipsis size={17}/></button>{menu&&<div className="zp-menu-pop"><button type="button" onClick={()=>{setMenu(false);void deleteProject();}}><Trash2 size={14}/>Delete project</button></div>}</div>}
   </div>}
  </header>}
  <div className="zp-bar">
   <div className="zp-tabs" role="tablist" aria-label="View">{views.map(([k,l,i])=><button key={k} type="button" role="tab" aria-selected={view===k} className={view===k?'is-on':''} onClick={()=>pick(k)}>{i}{l}</button>)}</div>
   {view!=='saved'&&<div className="zp-tools">
    <label className="zp-search"><Search size={14}/><input placeholder="Search" value={q} onChange={e=>setQ(e.target.value)} aria-label="Search tasks"/></label>
    <Dropdown variant="toolbar" label="Priority" icon={<ListFilter size={14}/>} value={prio} onChange={v=>setPrio(v as 'all'|Priority)} options={[{value:'all',label:'All priorities'},...priorities.map(p=>({value:p.key,label:p.label}))]}/>
    <Dropdown variant="toolbar" label="Assignee" value={who} onChange={setWho} options={[{value:'all',label:'Everyone'},{value:'me',label:'Assigned to me'},...filterPeople.map(m=>({value:m,label:people[m]?.display_name??'Member'}))]}/>
    <button type="button" className="zp-btn is-dark" onClick={()=>add()}><Plus size={15}/>New Task</button>
   </div>}
  </div>
  <div className="zp-body" data-lenis-prevent>{view==='saved'?<SavedMessages/>:view==='brief'&&project?<ProjectBrief project={project} canEdit={canManage} onSaved={b=>setProject(p=>p&&{...p,brief:b})} clientName={project.lead_id?(()=>{const c=z.channels.find(x=>x.kind==='client'&&x.lead_id===project.lead_id);return c?z.title(c):'';})():''}/>:empty??(view==='list'?listView:view==='kanban'?kanbanView:timelineView)}</div>

  {form&&<Modal title="New task" onClose={()=>setForm(null)} wide><form className="zn-modal-body" onSubmit={create}>
   <label className="zn-label">Task name<input className="zn-input" autoFocus maxLength={200} value={form.title} onChange={e=>setForm(f=>f&&{...f,title:e.target.value})} placeholder="What needs doing?"/></label>
   <label className="zn-label">Description (optional)<textarea className="zn-input" rows={3} maxLength={4000} value={form.description} onChange={e=>setForm(f=>f&&{...f,description:e.target.value})}/></label>
   {multi&&<div className="zn-label">Project<Dropdown label="Project" value={form.project_id} onChange={v=>{if(v==='__new'){setNewProject({then:pid=>setForm(f=>f&&{...f,project_id:pid,assignees:[me.user_id]})});return;}setForm(f=>f&&{...f,project_id:v,assignees:[me.user_id]});}} options={[{value:'',label:'No project (personal)'},...(leadId?clientProjects:(projects??[])).map(p=>({value:p.id,label:p.name})),{value:'__new',label:'+ Create a new project…',group:' '}]}/></div>}
   <div className="zn-form-row">
    <div className="zn-label">Status<Dropdown label="Status" value={form.status} onChange={v=>{if(v==='__new'){setAddingStatus({then:k=>setForm(f=>f&&{...f,status:k})});return;}setForm(f=>f&&{...f,status:v});}} options={[...statuses.map(g=>({value:g.key,label:g.label,color:g.color})),{value:'__new',label:'+ Add a status…',group:' '}]}/></div>
    <div className="zn-label">Priority<Dropdown label="Priority" value={form.priority} onChange={v=>setForm(f=>f&&{...f,priority:v as Priority})} options={priorities.map(p=>({value:p.key,label:p.label}))}/></div>
   </div>
   <div className="zn-form-row">
    <label className="zn-label">Start date<input type="date" className="zn-input" value={form.start_at} onChange={e=>setForm(f=>f&&{...f,start_at:e.target.value})}/></label>
    <label className="zn-label">Due date<input type="date" className="zn-input" value={form.due_at} onChange={e=>setForm(f=>f&&{...f,due_at:e.target.value})}/></label>
   </div>
   <label className="zn-label">Type<input className="zn-input" list="zp-types" maxLength={40} value={form.type} onChange={e=>setForm(f=>f&&{...f,type:e.target.value})} placeholder="e.g. Design"/><datalist id="zp-types">{typeOptions.map(t=><option key={t} value={t}/>)}</datalist></label>
   <div className="zn-label">Assign to<AssigneePicker candidates={formMembers??[]} value={form.assignees} onToggle={m=>setForm(f=>f&&{...f,assignees:f.assignees.includes(m)?f.assignees.filter(x=>x!==m):[...f.assignees,m]})}/></div>
   {error&&<p className="zn-error" role="alert">{error}</p>}
   <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={()=>setForm(null)}>Cancel</button><button className="zn-btn is-primary" disabled={busy}>{busy?'Creating…':'Add task'}</button></div>
  </form></Modal>}
  {openTask&&<TaskDrawer key={openTask.id} task={openTask} assignees={assign[openTask.id]??[]} typeOptions={typeOptions} projectLabel={openTask.project_id?projectName(openTask.project_id):'Personal'}
   loadMembers={()=>chipMembersFor(openTask.project_id)} onClose={()=>setOpen(null)} onPatch={v=>patch(openTask.id,v)} onToggle={u=>toggleAssignee(openTask,u)} onAddStatus={then=>setAddingStatus({then})} onDelete={()=>void remove(openTask.id)}/>}
  {showMembers&&<Modal title={`Members · ${members.length}`} onClose={()=>setShowMembers(false)}><ul className="zn-list zn-list-scroll zn-member-list">{members.map(u=>{const owner=project?.created_by===u,self=u===me.user_id;return <li key={u}><div className="zn-person"><Avatar m={people[u]} size={32}/><span><b>{people[u]?.display_name??'Member'}{self&&' (you)'}</b><small>{owner?'Owner':people[u]?.title||people[u]?.email||''}</small></span>{!owner&&(canManage||self)&&<button type="button" className="zn-remove" onClick={()=>void removeMember(u)}>{self?'Leave':'Remove'}</button>}</div></li>;})}</ul><div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={()=>{setShowMembers(false);setInviting(true);}}><UserPlus size={14}/>Invite</button><button type="button" className="zn-btn is-primary" onClick={()=>setShowMembers(false)}>Done</button></div></Modal>}
  {addingStatus&&<AddStatusDialog onClose={()=>setAddingStatus(null)} onAdded={k=>addingStatus.then?.(k)}/>}
  {newProject&&<NewProject clientId={leadId} onClose={()=>setNewProject(null)} onCreated={pid=>newProject.then?.(pid)}/>}
  {inviting&&<PeoplePicker title="Invite to project" confirm="Invite" exclude={members} onClose={()=>setInviting(false)} onPick={invite}/>}
 </div>;
}

// Details panel: edit everything about a task in place and talk about it in comments.
function TaskDrawer({task,assignees,typeOptions,projectLabel,loadMembers,onClose,onPatch,onToggle,onDelete,onAddStatus}:{onAddStatus:(then:(key:string)=>void)=>void;task:Task;assignees:string[];typeOptions:string[];projectLabel:string;loadMembers:()=>Promise<string[]>;onClose:()=>void;onPatch:(v:Partial<Pick<Task,'title'|'description'|'status'|'type'|'priority'|'start_at'|'due_at'>>)=>Promise<boolean|undefined>;onToggle:(u:string)=>void;onDelete:()=>void}){
 const {db,me,people,taskStatuses}=useZarn(),confirm=useConfirm();
 const statuses=taskStatuses.length?taskStatuses.map(x=>({key:x.key,label:x.label,color:x.color})):BASE_STATUSES;
 const [title,setTitle]=useState(task.title),[desc,setDesc]=useState(task.description),[type,setType]=useState(task.type),[options,setOptions]=useState<string[]>([]),[comments,setComments]=useState<Comment[]>([]),[text,setText]=useState(''),[sending,setSending]=useState(false),[err,setErr]=useState('');
 useEffect(()=>{let live=true;void loadMembers().then(m=>{if(live)setOptions(m);});return()=>{live=false;};},[]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{let live=true;void (async()=>{const {data}=await db.from('zarn_task_comments').select('*').eq('task_id',task.id).order('created_at');if(live)setComments((data??[]) as Comment[]);})();return()=>{live=false;};},[db,task.id]);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose]);
 const save=async(v:Parameters<typeof onPatch>[0])=>{setErr('');if(await onPatch(v)===false)setErr('Could not save that change.');};
 async function send(e:React.FormEvent){
  e.preventDefault();const body=text.trim();if(!body)return;setSending(true);
  const {data,error}=await db.from('zarn_task_comments').insert({task_id:task.id,user_id:me.user_id,body}).select('*').single();
  setSending(false);if(error||!data){setErr('Could not post that comment.');return;}
  setComments(c=>[...c,data as Comment]);setText('');
 }
 const creator=task.created_by?people[task.created_by]?.display_name??'Someone':'Someone';
 const overdue=!!task.due_at&&task.status!=='done'&&task.due_at<iso(new Date());
 return <><button type="button" className="zp-scrim" aria-label="Close details" onClick={onClose}/>
  <aside className="zp-drawer" role="dialog" aria-label="Task details">
   <header><Dropdown variant="pill" label="Status" value={task.status} onChange={v=>{if(v==='__new'){onAddStatus((k)=>void save({status:k}));return;}void save({status:v});}} options={[...statuses.map(s=>({value:s.key,label:s.label,color:s.color})),{value:'__new',label:'+ Add a status…',group:' '}]}/>
    <div className="zp-drawer-actions"><button type="button" className="zp-icon-btn" aria-label="Delete task" data-tip="Delete" onClick={async()=>{if(await confirm({title:'Delete this task?',message:`“${task.title}” will be deleted for everyone. This can’t be undone.`,confirm:'Delete task',danger:true}))onDelete();}}><Trash2 size={16}/></button><button type="button" className="zp-icon-btn" aria-label="Close" onClick={onClose}><X size={17}/></button></div></header>
   <div className="zp-drawer-body" data-lenis-prevent>
    <input className="zp-title-input" value={title} maxLength={200} onChange={e=>setTitle(e.target.value)} onBlur={()=>{const t=title.trim();if(!t){setTitle(task.title);return;}if(t!==task.title)void save({title:t});}} aria-label="Task name"/>
    <dl className="zp-fields">
     <dt>Assignees</dt><dd><AssigneePicker candidates={options} value={assignees} onToggle={onToggle}/></dd>
     <dt>Due date</dt><dd><input type="date" className="zp-input" value={task.due_at??''} onChange={e=>{const v=e.target.value||null;if(v&&task.start_at&&task.start_at>v){setErr('The due date can’t be before the start date.');return;}void save({due_at:v});}}/>{overdue&&<span className="zp-overdue">Overdue</span>}</dd>
     <dt>Start date</dt><dd><input type="date" className="zp-input" value={task.start_at??''} onChange={e=>{const v=e.target.value||null;if(v&&task.due_at&&v>task.due_at){setErr('The start date can’t be after the due date.');return;}void save({start_at:v});}}/></dd>
     <dt>Priority</dt><dd><Dropdown label="Priority" value={task.priority} onChange={v=>void save({priority:v as Priority})} options={priorities.map(p=>({value:p.key,label:p.label}))}/></dd>
     <dt>Type</dt><dd><input className="zp-input" list="zp-drawer-types" maxLength={40} value={type} onChange={e=>setType(e.target.value)} onBlur={()=>{if(type.trim()!==task.type)void save({type:type.trim()});}} placeholder="e.g. Design"/><datalist id="zp-drawer-types">{typeOptions.map(t=><option key={t} value={t}/>)}</datalist></dd>
     <dt>Project</dt><dd>{task.project_id?<Link href={`/zarn/projects/${task.project_id}`} className="zp-proj">{projectLabel}</Link>:<span className="zp-muted">Personal, no project</span>}</dd>
    </dl>
    <label className="zp-block">Description<textarea className="zp-input" rows={5} maxLength={4000} value={desc} placeholder="Add more detail…" onChange={e=>setDesc(e.target.value)} onBlur={()=>{if(desc!==task.description)void save({description:desc});}}/></label>
    {err&&<p className="zn-error" role="alert">{err}</p>}
    <section className="zp-comments"><h3>Comments <span className="zp-count">{comments.length}</span></h3>
     {comments.map(c=><div key={c.id} className="zp-comment"><Avatar m={people[c.user_id??'']} size={28}/><div><p><b>{people[c.user_id??'']?.display_name??'Someone'}</b><time>{dayOf(c.created_at)} {timeOf(c.created_at)}</time></p><span>{c.body}</span></div></div>)}
     {!comments.length&&<p className="zp-muted">No comments yet.</p>}
     <form onSubmit={send} className="zp-comment-form"><input className="zp-input" value={text} maxLength={4000} placeholder="Write a comment…" onChange={e=>setText(e.target.value)} aria-label="Comment"/><button type="submit" className="zp-btn is-dark" disabled={sending||!text.trim()} aria-label="Post comment"><Send size={14}/></button></form>
    </section>
    <p className="zp-created">Created by {creator} · {dayOf(task.created_at)}</p>
   </div>
  </aside></>;
}
