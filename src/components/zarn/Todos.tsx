'use client';
import {useEffect,useMemo,useState} from 'react';
import {Bookmark,ChevronDown,Ellipsis,ListChecks,Plus,Search,Trash2} from 'lucide-react';
import {useZarn,type TodoPriority,type TodoStatus,type ZTodo} from './ZarnProvider';
import {Modal} from './Dialogs';
import {renderBody} from './format';
import type {ZMessage} from '@/lib/zarn';

const today=()=>new Date().toISOString().slice(0,10);
const fmt=(d:string)=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const groups:{key:TodoStatus;label:string;color:string}[]=[{key:'todo',label:'To-do',color:'#71717a'},{key:'in_progress',label:'In progress',color:'#2563eb'},{key:'done',label:'Done',color:'#16a34a'}];
const priorities:{key:TodoPriority;label:string;color:string}[]=[{key:'low',label:'Low',color:'#2563eb'},{key:'medium',label:'Medium',color:'#d97706'},{key:'high',label:'High',color:'#dc2626'}];
type Form={id?:string;body:string;description:string;status:TodoStatus;priority:TodoPriority;start_at:string;due_at:string;saved?:boolean};
const blank=(status:TodoStatus='todo'):Form=>({body:'',description:'',status,priority:'medium',start_at:'',due_at:''});

// Personal to-do list in the style of a project board: grouped by status, one row per task.
export default function Todos(){
 const {db,me,people,channels,title,todos,addTodo,updateTodo,removeTodo}=useZarn();
 const [q,setQ]=useState(''),[prio,setPrio]=useState<'all'|TodoPriority>('all'),[collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 const [form,setForm]=useState<Form|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [messages,setMessages]=useState<Record<string,ZMessage>>({});
 const ids=(todos??[]).map(t=>t.message_id).filter(Boolean).join(',');
 useEffect(()=>{const list=ids?ids.split(','):[];if(!list.length)return;let live=true;void (async()=>{
  const {data}=await db.from('zarn_messages').select('*').in('id',list);
  if(live)setMessages(Object.fromEntries(((data??[]) as ZMessage[]).map(m=>[m.id,m])));
 })();return()=>{live=false;};},[db,ids]);
 const visible=useMemo(()=>(todos??[]).filter(t=>{
  if(prio!=='all'&&t.priority!==prio)return false;
  const m=t.message_id?messages[t.message_id]:undefined;
  return `${t.body} ${t.description} ${m?.body??''}`.toLowerCase().includes(q.toLowerCase());
 }).sort((a,b)=>(a.due_at??'9999').localeCompare(b.due_at??'9999')||b.created_at.localeCompare(a.created_at)),[todos,messages,q,prio]);
 const edit=(t:ZTodo)=>{setError('');setForm({id:t.id,body:t.body,description:t.description,status:t.status,priority:t.priority,start_at:t.start_at??'',due_at:t.due_at??'',saved:!!t.message_id});};
 async function save(e:React.FormEvent){
  e.preventDefault();if(!form)return;
  if(!form.saved&&!form.body.trim()){setError('Give the task a name.');return;}
  if(form.start_at&&form.due_at&&form.start_at>form.due_at){setError('The start date can’t be after the due date.');return;}
  setBusy(true);setError('');
  try{
   const f={body:form.body,description:form.description,status:form.status,priority:form.priority,start_at:form.start_at||null,due_at:form.due_at||null};
   if(form.id)await updateTodo(form.id,f);else await addTodo(f);
   setForm(null);
  }catch(x){setError(x instanceof Error?x.message:'Could not save that.');}finally{setBusy(false);}
 }
 const name=(t:ZTodo)=>{
  if(!t.message_id)return <b>{t.body}</b>;
  const m=messages[t.message_id],c=channels.find(x=>x.id===t.channel_id);
  return <><b>{t.body||(m?(m.deleted_at?'Deleted message':renderBody(m.body||'Shared a file',people,me.user_id)):'Saved message')}</b><small className="zn-todo-from"><Bookmark size={11}/>{c?(c.kind==='dm'||c.kind==='client'?title(c):`#${c.name}`):'a conversation'}</small></>;
 };
 const isOpen=(k:string)=>!collapsed[k];
 return <div className="zn-page">
  <header className="zn-page-head"><div><h1><ListChecks size={20}/>To-dos</h1><p>Your own tasks, and messages you saved for later.</p></div>
   <div className="zn-head-actions">
    <label className="zn-tool-search"><Search size={15}/><input placeholder="Search" value={q} onChange={e=>setQ(e.target.value)} aria-label="Search to-dos"/></label>
    <select className="zn-input zn-filter" value={prio} onChange={e=>setPrio(e.target.value as 'all'|TodoPriority)} aria-label="Filter by priority"><option value="all">All priorities</option>{priorities.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select>
    <button type="button" className="zn-btn is-primary" onClick={()=>{setError('');setForm(blank());}}><Plus size={15}/>New task</button>
   </div></header>
  <div className="zn-board" data-lenis-prevent>
   {todos===null?<p className="zn-loading">Loading…</p>:groups.map(g=>{
    const rows=visible.filter(t=>t.status===g.key);
    return <section key={g.key} className="zn-tgroup">
     <div className="zn-tgroup-head"><button type="button" className="zn-tgroup-toggle" aria-expanded={isOpen(g.key)} onClick={()=>setCollapsed(c=>({...c,[g.key]:isOpen(g.key)}))}><ChevronDown size={15} style={{transform:isOpen(g.key)?undefined:'rotate(-90deg)'}}/><i style={{background:g.color}}/><b>{g.label}</b><span className="zn-tgroup-n">{rows.length}</span></button>
      <button type="button" className="zn-tgroup-add" aria-label={`Add to ${g.label}`} data-tip="Add task" onClick={()=>{setError('');setForm(blank(g.key));}}><Plus size={15}/></button></div>
     {isOpen(g.key)&&(rows.length?<div className="zn-table-wrap"><table className="zn-task-table">
      <thead><tr><th/><th>Task name</th><th className="zn-hide-sm">Description</th><th>Estimation</th><th className="zn-hide-sm">Type</th><th>Priority</th><th/></tr></thead>
      <tbody>{rows.map(t=>{const p=priorities.find(x=>x.key===t.priority)!,overdue=!!t.due_at&&t.status!=='done'&&t.due_at<today();return <tr key={t.id} className={t.status==='done'?'is-done':''} onClick={()=>edit(t)}>
       <td onClick={e=>e.stopPropagation()}><button type="button" className="zn-todo-check" aria-label={t.status==='done'?'Mark as not done':'Mark as done'} aria-pressed={t.status==='done'} onClick={()=>void updateTodo(t.id,{status:t.status==='done'?'todo':'done'})}>{t.status==='done'&&<span>✓</span>}</button></td>
       <td className="zn-task-name">{name(t)}</td>
       <td className="zn-hide-sm zn-task-desc">{t.description||'-'}</td>
       <td className={`zn-task-est${overdue?' is-overdue':''}`}>{t.start_at&&t.due_at?`${fmt(t.start_at)} - ${fmt(t.due_at)}`:t.due_at?`Due ${fmt(t.due_at)}`:t.start_at?`From ${fmt(t.start_at)}`:'-'}</td>
       <td className="zn-hide-sm"><span className={`zn-type ${t.message_id?'is-saved':'is-task'}`}>{t.message_id?'Saved message':'Task'}</span></td>
       <td><span className="zn-prio" style={{background:p.color}}>{p.label}</span></td>
       <td onClick={e=>e.stopPropagation()}><button type="button" className="zn-todo-del" aria-label="Edit task" data-tip="Edit" onClick={()=>edit(t)}><Ellipsis size={16}/></button></td>
      </tr>;})}</tbody></table></div>:<p className="zn-tgroup-empty">{q||prio!=='all'?'Nothing matches.':'No tasks here.'}</p>)}
    </section>;})}
  </div>
  {form&&<Modal title={form.id?'Edit task':'New task'} onClose={()=>setForm(null)}><form className="zn-modal-body" onSubmit={save}>
   <label className="zn-label">{form.saved?'Note (optional)':'Task name'}<input className="zn-input" autoFocus maxLength={500} value={form.body} onChange={e=>setForm(f=>f&&{...f,body:e.target.value})} placeholder={form.saved?'Why you saved this':'What needs doing?'}/></label>
   <label className="zn-label">Description (optional)<textarea className="zn-input" rows={3} maxLength={2000} value={form.description} onChange={e=>setForm(f=>f&&{...f,description:e.target.value})}/></label>
   <div className="zn-form-row">
    <label className="zn-label">Status<select className="zn-input" value={form.status} onChange={e=>setForm(f=>f&&{...f,status:e.target.value as TodoStatus})}>{groups.map(g=><option key={g.key} value={g.key}>{g.label}</option>)}</select></label>
    <label className="zn-label">Priority<select className="zn-input" value={form.priority} onChange={e=>setForm(f=>f&&{...f,priority:e.target.value as TodoPriority})}>{priorities.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
   </div>
   <div className="zn-form-row">
    <label className="zn-label">Start date<input type="date" className="zn-input" value={form.start_at} onChange={e=>setForm(f=>f&&{...f,start_at:e.target.value})}/></label>
    <label className="zn-label">Due date<input type="date" className="zn-input" value={form.due_at} onChange={e=>setForm(f=>f&&{...f,due_at:e.target.value})}/></label>
   </div>
   {error&&<p className="zn-error" role="alert">{error}</p>}
   <div className="zn-modal-foot">{form.id&&<button type="button" className="zn-btn is-danger zn-push" onClick={()=>{void removeTodo(form.id!);setForm(null);}}><Trash2 size={14}/>Delete</button>}<button type="button" className="zn-btn" onClick={()=>setForm(null)}>Cancel</button><button className="zn-btn is-primary" disabled={busy}>{busy?'Saving…':form.id?'Save':'Add task'}</button></div>
  </form></Modal>}
 </div>;
}
