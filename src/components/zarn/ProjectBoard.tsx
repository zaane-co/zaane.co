'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {CalendarDays,ChartGantt,ChevronDown,Ellipsis,Kanban,List,ListFilter,Plus,Search,Trash2,UserPlus} from 'lucide-react';
import {useZarn,type ZProject} from './ZarnProvider';
import {Modal,PeoplePicker} from './Dialogs';
import {Avatar} from './format';

export type TaskStatus='todo'|'in_progress'|'in_review'|'done';
type Priority='low'|'medium'|'high';
type Task={id:string;project_id:string;title:string;description:string;status:TaskStatus;type:string;priority:Priority;start_at:string|null;due_at:string|null;position:number;created_at:string};
type View='kanban'|'timeline'|'list';
type Form={id?:string;title:string;description:string;status:TaskStatus;type:string;priority:Priority;start_at:string;due_at:string;assignees:string[]};

export const statuses:{key:TaskStatus;label:string;color:string}[]=[{key:'todo',label:'To-do',color:'#71717a'},{key:'in_progress',label:'On progress',color:'#2563eb'},{key:'in_review',label:'In review',color:'#d97706'},{key:'done',label:'Done',color:'#16a34a'}];
const priorities:{key:Priority;label:string;color:string}[]=[{key:'low',label:'Low',color:'#2563eb'},{key:'medium',label:'Medium',color:'#d97706'},{key:'high',label:'High',color:'#dc2626'}];
const typePalette=['#7c3aed','#ea580c','#0891b2','#db2777','#16a34a','#2563eb'];
const typeColor=(t:string)=>typePalette[[...t].reduce((a,c)=>a+c.charCodeAt(0),0)%typePalette.length];
const typeSuggestions=['Design','Development','Marketing','Research','Content','Admin'];
const DAY=86400000;
const iso=(d:Date)=>d.toISOString().slice(0,10);
const day=(s:string)=>new Date(s+'T00:00:00Z').getTime();
const fmt=(s:string)=>new Date(s+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const blank=(status:TaskStatus='todo',me?:string):Form=>({title:'',description:'',status,type:'',priority:'medium',start_at:'',due_at:'',assignees:me?[me]:[]});
const estimate=(t:Task)=>t.start_at&&t.due_at?`${fmt(t.start_at)} - ${fmt(t.due_at)}`:t.due_at?`Due ${fmt(t.due_at)}`:t.start_at?`From ${fmt(t.start_at)}`:'-';

function Stack({ids,max=3}:{ids:string[];max?:number}){
 const {people}=useZarn();
 if(!ids.length)return <span className="zp-muted">-</span>;
 return <span className="zp-stack">{ids.slice(0,max).map(id=><Avatar key={id} m={people[id]} size={24}/>)}{ids.length>max&&<em>+{ids.length-max}</em>}</span>;
}

// One project: a task board shown as a list, kanban or timeline, with assignees.
export default function ProjectBoard({id}:{id:string}){
 const z=useZarn(),{db,me,people,reloadProjects}=z,router=useRouter();
 const [project,setProject]=useState<ZProject|null|undefined>(undefined),[members,setMembers]=useState<string[]>([]),[tasks,setTasks]=useState<Task[]>([]),[assign,setAssign]=useState<Record<string,string[]>>({});
 const [view,setView]=useState<View>('list'),[q,setQ]=useState(''),[prio,setPrio]=useState<'all'|Priority>('all'),[who,setWho]=useState('all'),[collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 const [form,setForm]=useState<Form|null>(null),[inviting,setInviting]=useState(false),[menu,setMenu]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[dragging,setDragging]=useState<string|null>(null);

 useEffect(()=>{const v=new URLSearchParams(window.location.search).get('view');if(v==='kanban'||v==='timeline'||v==='list')setView(v);},[]);
 const pick=(v:View)=>{setView(v);window.history.replaceState(null,'',`?view=${v}`);};
 const load=useCallback(async()=>{
  const [{data:pr},{data:pm},{data:tk},{data:as}]=await Promise.all([
   db.from('zarn_projects').select('id,name,description,color,created_by,created_at').eq('id',id).maybeSingle(),
   db.from('zarn_project_members').select('user_id').eq('project_id',id),
   db.from('zarn_tasks').select('*').eq('project_id',id).order('position'),
   db.from('zarn_task_assignees').select('task_id,user_id').eq('project_id',id),
  ]);
  setProject((pr as ZProject|null)??null);setMembers(((pm??[]) as {user_id:string}[]).map(x=>x.user_id));setTasks((tk??[]) as Task[]);
  const map:Record<string,string[]>={};for(const a of (as??[]) as {task_id:string;user_id:string}[])(map[a.task_id]??=[]).push(a.user_id);setAssign(map);
 },[db,id]);
 useEffect(()=>{void load();},[load]);

 const canManage=!!project&&(project.created_by===me.user_id||me.staffRole==='super_admin'||me.staffRole==='admin');
 const shown=useMemo(()=>tasks.filter(t=>(prio==='all'||t.priority===prio)&&(who==='all'||(who==='me'?(assign[t.id]??[]).includes(me.user_id):(assign[t.id]??[]).includes(who)))&&`${t.title} ${t.description} ${t.type}`.toLowerCase().includes(q.toLowerCase())),[tasks,assign,q,prio,who,me.user_id]);
 const typeOptions=useMemo(()=>[...new Set([...typeSuggestions,...tasks.map(t=>t.type).filter(Boolean)])],[tasks]);

 async function save(e:React.FormEvent){
  e.preventDefault();if(!form)return;
  if(!form.title.trim()){setError('Give the task a name.');return;}
  if(form.start_at&&form.due_at&&form.start_at>form.due_at){setError('The start date can’t be after the due date.');return;}
  setBusy(true);setError('');
  try{
   const values={title:form.title.trim(),description:form.description,status:form.status,type:form.type.trim(),priority:form.priority,start_at:form.start_at||null,due_at:form.due_at||null};
   let taskId=form.id;
   if(taskId){
    const {error:err}=await db.from('zarn_tasks').update({...values,updated_at:new Date().toISOString()}).eq('id',taskId);if(err)throw err;
    setTasks(ts=>ts.map(t=>t.id===taskId?{...t,...values}:t));
   }else{
    const {data,error:err}=await db.from('zarn_tasks').insert({...values,project_id:id,created_by:me.user_id,position:Date.now()/1000}).select('*').single();if(err||!data)throw err;
    taskId=(data as Task).id;setTasks(ts=>[...ts,data as Task]);
   }
   const before=assign[taskId!]??[],add=form.assignees.filter(u=>!before.includes(u)),del=before.filter(u=>!form.assignees.includes(u));
   if(del.length){const {error:err}=await db.from('zarn_task_assignees').delete().eq('task_id',taskId!).in('user_id',del);if(err)throw err;}
   if(add.length){const {error:err}=await db.from('zarn_task_assignees').insert(add.map(u=>({task_id:taskId!,user_id:u,project_id:id})));if(err)throw err;}
   setAssign(a=>({...a,[taskId!]:form.assignees}));setForm(null);
  }catch{setError('Could not save that task. Try again.');}finally{setBusy(false);}
 }
 async function move(taskId:string,status:TaskStatus){
  const t=tasks.find(x=>x.id===taskId);if(!t||t.status===status)return;
  const position=Date.now()/1000;setTasks(ts=>ts.map(x=>x.id===taskId?{...x,status,position}:x));
  const {error:err}=await db.from('zarn_tasks').update({status,position,updated_at:new Date().toISOString()}).eq('id',taskId);
  if(err)setTasks(ts=>ts.map(x=>x.id===taskId?t:x));
 }
 async function remove(taskId:string){setTasks(ts=>ts.filter(t=>t.id!==taskId));await db.from('zarn_tasks').delete().eq('id',taskId);}
 async function invite(ids:string[]){
  const {error:err}=await db.from('zarn_project_members').insert(ids.map(u=>({project_id:id,user_id:u,added_by:me.user_id})));
  if(err)throw new Error('Could not add them.');
  setMembers(m=>[...m,...ids]);setInviting(false);
 }
 async function deleteProject(){
  if(!window.confirm(`Delete “${project?.name}” and all its tasks? This can’t be undone.`))return;
  await db.from('zarn_projects').delete().eq('id',id);await reloadProjects();router.push('/zarn/projects');
 }
 const edit=(t:Task)=>{setError('');setForm({id:t.id,title:t.title,description:t.description,status:t.status,type:t.type,priority:t.priority,start_at:t.start_at??'',due_at:t.due_at??'',assignees:assign[t.id]??[]});};
 const add=(s:TaskStatus='todo')=>{setError('');setForm(blank(s,me.user_id));};
 const pill=(p:Priority)=>{const x=priorities.find(i=>i.key===p)!;return <span className="zp-pill" style={{background:x.color}}>{x.label}</span>;};
 const typePill=(t:string)=>t?<span className="zp-pill" style={{background:typeColor(t)}}>{t}</span>:<span className="zp-muted">-</span>;
 const isOpen=(k:string)=>!collapsed[k];
 const today=iso(new Date());

 if(project===undefined)return <div className="zn-page"><p className="zn-loading">Loading…</p></div>;
 if(project===null)return <div className="zn-page"><div className="zn-empty-state"><h2>Project not found</h2><p>It may have been deleted, or you haven’t been added to it.</p></div></div>;

 const listView=<div className="zp-list">{statuses.map(g=>{const rows=shown.filter(t=>t.status===g.key);return <section key={g.key} className="zp-group">
  <div className="zp-group-head"><button type="button" className="zp-group-toggle" aria-expanded={isOpen(g.key)} onClick={()=>setCollapsed(c=>({...c,[g.key]:isOpen(g.key)}))}><ChevronDown size={15} style={{transform:isOpen(g.key)?undefined:'rotate(-90deg)'}}/><i style={{background:g.color}}/><b>{g.label}</b><span className="zp-count">{rows.length}</span></button>
   <button type="button" className="zp-icon-btn" aria-label={`Add task to ${g.label}`} data-tip="Add task" onClick={()=>add(g.key)}><Plus size={15}/></button></div>
  {isOpen(g.key)&&(rows.length?<div className="zp-table-wrap"><table className="zp-table"><thead><tr><th/><th>Task name</th><th className="zp-hide-sm">Description</th><th>Estimation</th><th className="zp-hide-sm">Type</th><th>People</th><th>Priority</th><th/></tr></thead>
   <tbody>{rows.map(t=><tr key={t.id} className={t.status==='done'?'is-done':''} onClick={()=>edit(t)}>
    <td onClick={e=>e.stopPropagation()}><button type="button" className="zp-check" aria-pressed={t.status==='done'} aria-label={t.status==='done'?'Mark as not done':'Mark as done'} onClick={()=>void move(t.id,t.status==='done'?'todo':'done')}>{t.status==='done'&&'✓'}</button></td>
    <td className="zp-name">{t.title}</td><td className="zp-hide-sm zp-desc">{t.description||'-'}</td>
    <td className={`zp-est${t.due_at&&t.status!=='done'&&t.due_at<today?' is-overdue':''}`}>{estimate(t)}</td>
    <td className="zp-hide-sm">{typePill(t.type)}</td><td><Stack ids={assign[t.id]??[]}/></td><td>{pill(t.priority)}</td>
    <td onClick={e=>e.stopPropagation()}><button type="button" className="zp-icon-btn" aria-label="Edit task" data-tip="Edit" onClick={()=>edit(t)}><Ellipsis size={16}/></button></td>
   </tr>)}</tbody></table></div>:<p className="zp-empty-row">{q||prio!=='all'||who!=='all'?'Nothing matches.':'No tasks here.'}</p>)}
 </section>;})}</div>;

 const kanbanView=<div className="zp-kanban">{statuses.map(g=>{const rows=shown.filter(t=>t.status===g.key).sort((a,b)=>a.position-b.position);return <section key={g.key} className={`zp-col${dragging?' is-target':''}`} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const tid=e.dataTransfer.getData('text/plain');setDragging(null);if(tid)void move(tid,g.key);}}>
  <header><i style={{background:g.color}}/><b>{g.label}</b><span className="zp-count">{rows.length}</span><button type="button" className="zp-icon-btn" aria-label={`Add task to ${g.label}`} data-tip="Add task" onClick={()=>add(g.key)}><Plus size={15}/></button></header>
  <div className="zp-cards">{rows.map(t=><article key={t.id} className={`zp-card${t.status==='done'?' is-done':''}`} draggable onDragStart={e=>{e.dataTransfer.setData('text/plain',t.id);setDragging(t.id);}} onDragEnd={()=>setDragging(null)} onClick={()=>edit(t)}>
   <div className="zp-card-top">{typePill(t.type)}{pill(t.priority)}</div>
   <b>{t.title}</b>{t.description&&<p>{t.description}</p>}
   <footer><span className={`zp-est${t.due_at&&t.status!=='done'&&t.due_at<today?' is-overdue':''}`}><CalendarDays size={13}/>{estimate(t)}</span><Stack ids={assign[t.id]??[]}/></footer>
  </article>)}{!rows.length&&<p className="zp-empty-row">Drop tasks here</p>}</div>
 </section>;})}</div>;

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
    {spans.map(({t,s,e})=>{const g=statuses.find(x=>x.key===t.status)!;return <div key={t.id} className="zp-tl-row" onClick={()=>edit(t)}>
     <div className="zp-tl-label"><span>{t.title}</span><Stack ids={assign[t.id]??[]} max={2}/></div>
     <div className="zp-tl-track" style={{width:days*W,backgroundSize:`${W}px 100%`}}><div className="zp-tl-bar" style={{left:((s-min)/DAY)*W+3,width:Math.max(W-6,((e-s)/DAY+1)*W-6),background:g.color}} title={`${t.title} · ${estimate(t)}`}><span>{t.title}</span></div></div>
    </div>;})}
   </div></div></div>
   {undated.length>0&&<p className="zp-tl-note">No dates yet: {undated.map(t=>t.title).join(', ')}</p>}</div>;
 })();

 return <div className="zn-page zp-page">
  <header className="zp-head">
   <div className="zp-title"><span className="zp-badge" style={{background:project.color}}>{project.name.slice(0,1).toUpperCase()}</span><div><h1>{project.name}</h1>{project.description&&<p>{project.description}</p>}</div></div>
   <div className="zp-head-right">
    <span className="zp-members" data-tip={members.map(m=>people[m]?.display_name).filter(Boolean).join(', ')}><Stack ids={members} max={4}/></span>
    <button type="button" className="zp-btn" onClick={()=>setInviting(true)}><UserPlus size={15}/>Invite</button>
    {canManage&&<div className="zp-menu"><button type="button" className="zp-icon-btn" aria-label="Project menu" onClick={()=>setMenu(v=>!v)}><Ellipsis size={17}/></button>{menu&&<div className="zp-menu-pop"><button type="button" onClick={()=>{setMenu(false);void deleteProject();}}><Trash2 size={14}/>Delete project</button></div>}</div>}
   </div>
  </header>
  <div className="zp-bar">
   <div className="zp-tabs" role="tablist" aria-label="View">{([['kanban','Kanban',<Kanban key="k" size={15}/>],['timeline','Timeline',<ChartGantt key="t" size={15}/>],['list','List',<List key="l" size={15}/>]] as [View,string,React.ReactNode][]).map(([k,l,i])=><button key={k} type="button" role="tab" aria-selected={view===k} className={view===k?'is-on':''} onClick={()=>pick(k)}>{i}{l}</button>)}</div>
   <div className="zp-tools">
    <label className="zp-search"><Search size={14}/><input placeholder="Search" value={q} onChange={e=>setQ(e.target.value)} aria-label="Search tasks"/></label>
    <label className="zp-filter"><ListFilter size={14}/><select value={prio} onChange={e=>setPrio(e.target.value as 'all'|Priority)} aria-label="Priority"><option value="all">All priorities</option>{priorities.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
    <label className="zp-filter"><select value={who} onChange={e=>setWho(e.target.value)} aria-label="Assignee"><option value="all">Everyone</option><option value="me">Assigned to me</option>{members.filter(m=>m!==me.user_id).map(m=><option key={m} value={m}>{people[m]?.display_name??'Member'}</option>)}</select></label>
    <button type="button" className="zp-btn is-dark" onClick={()=>add()}><Plus size={15}/>New Task</button>
   </div>
  </div>
  <div className="zp-body" data-lenis-prevent>{view==='list'?listView:view==='kanban'?kanbanView:timelineView}</div>

  {form&&<Modal title={form.id?'Edit task':'New task'} onClose={()=>setForm(null)} wide><form className="zn-modal-body" onSubmit={save}>
   <label className="zn-label">Task name<input className="zn-input" autoFocus maxLength={200} value={form.title} onChange={e=>setForm(f=>f&&{...f,title:e.target.value})} placeholder="What needs doing?"/></label>
   <label className="zn-label">Description (optional)<textarea className="zn-input" rows={3} maxLength={4000} value={form.description} onChange={e=>setForm(f=>f&&{...f,description:e.target.value})}/></label>
   <div className="zn-form-row">
    <label className="zn-label">Status<select className="zn-input" value={form.status} onChange={e=>setForm(f=>f&&{...f,status:e.target.value as TaskStatus})}>{statuses.map(g=><option key={g.key} value={g.key}>{g.label}</option>)}</select></label>
    <label className="zn-label">Priority<select className="zn-input" value={form.priority} onChange={e=>setForm(f=>f&&{...f,priority:e.target.value as Priority})}>{priorities.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
   </div>
   <div className="zn-form-row">
    <label className="zn-label">Start date<input type="date" className="zn-input" value={form.start_at} onChange={e=>setForm(f=>f&&{...f,start_at:e.target.value})}/></label>
    <label className="zn-label">Due date<input type="date" className="zn-input" value={form.due_at} onChange={e=>setForm(f=>f&&{...f,due_at:e.target.value})}/></label>
   </div>
   <label className="zn-label">Type<input className="zn-input" list="zp-types" maxLength={40} value={form.type} onChange={e=>setForm(f=>f&&{...f,type:e.target.value})} placeholder="e.g. Design"/><datalist id="zp-types">{typeOptions.map(t=><option key={t} value={t}/>)}</datalist></label>
   <div className="zn-label">Assign to<div className="zp-assign">{members.map(m=>{const on=form.assignees.includes(m);return <button key={m} type="button" role="checkbox" aria-checked={on} className={on?'is-on':''} onClick={()=>setForm(f=>f&&{...f,assignees:on?f.assignees.filter(x=>x!==m):[...f.assignees,m]})}><Avatar m={people[m]} size={20}/>{people[m]?.display_name??'Member'}</button>;})}</div></div>
   {error&&<p className="zn-error" role="alert">{error}</p>}
   <div className="zn-modal-foot">{form.id&&<button type="button" className="zn-btn is-danger zn-push" onClick={()=>{void remove(form.id!);setForm(null);}}><Trash2 size={14}/>Delete</button>}<button type="button" className="zn-btn" onClick={()=>setForm(null)}>Cancel</button><button className="zn-btn is-primary" disabled={busy}>{busy?'Saving…':form.id?'Save':'Add task'}</button></div>
  </form></Modal>}
  {inviting&&<PeoplePicker title="Invite to project" confirm="Invite" exclude={members} onClose={()=>setInviting(false)} onPick={invite}/>}
 </div>;
}
