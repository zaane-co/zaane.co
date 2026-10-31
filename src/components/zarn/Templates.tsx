'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Check,LayoutTemplate,Pencil,Plus,Trash2} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {Modal} from './Dialogs';
import AssigneePicker from './AssigneePicker';
import {useConfirm} from './ConfirmProvider';
import {BUILTIN_TEMPLATES,LIMITS,parseOutline,phasesOf,toOutline,type Template,type TemplateItem} from '@/lib/zarn-templates';

type Db=ReturnType<typeof useZarn>['db'];
type Target={projectId:string|null;leadId?:string|null;assignees:string[]};

// Saved templates come from the database; the built-in ones ship with the app, so they work even before anything is saved.
export function useTemplates(){
 const {db}=useZarn();
 const [saved,setSaved]=useState<Template[]|null>(null),[ready,setReady]=useState(true);
 const reload=useCallback(async()=>{
  const {data,error}=await db.from('zarn_task_templates').select('id,name,description,items,created_by').order('name');
  if(error){setReady(false);setSaved([]);return;}
  setReady(true);setSaved((data??[]) as Template[]);
 },[db]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves, not synchronously
 useEffect(()=>{void reload();},[reload]);
 const all=useMemo(()=>[...BUILTIN_TEMPLATES,...(saved??[])],[saved]);
 return {all,saved,ready,reload};
}

// Creates one task per item (in order) and assigns each to the chosen people.
export async function applyTemplate(db:Db,userId:string,items:TemplateItem[],target:Target){
 const base=Date.now()/1000;
 const rows=items.map((it,n)=>({id:crypto.randomUUID(),title:it.title,description:it.description??'',status:'todo',type:(it.phase??'').slice(0,LIMITS.phase),priority:it.priority??'medium',project_id:target.projectId,lead_id:target.leadId??null,created_by:userId,position:base+n*0.001}));
 for(let i=0;i<rows.length;i+=100){
  const {error}=await db.from('zarn_tasks').insert(rows.slice(i,i+100));
  if(error)throw new Error(i?`Added ${i} of ${rows.length} tasks, then something went wrong. Check the list before trying again.`:'Could not add the tasks. You may not be able to add tasks here.');
 }
 const links=rows.flatMap(r=>target.assignees.map(u=>({task_id:r.id,user_id:u,project_id:target.projectId})));
 for(let i=0;i<links.length;i+=200){
  const {error}=await db.from('zarn_task_assignees').insert(links.slice(i,i+200));
  if(error)throw new Error('The tasks were added, but some people couldn’t be assigned (they may not be in that project).');
 }
 return rows.length;
}

const countLabel=(t:Template)=>`${t.items.length} task${t.items.length===1?'':'s'}${phasesOf(t.items).filter(Boolean).length?` · ${phasesOf(t.items).filter(Boolean).length} phases`:''}`;

type View={k:'list'}|{k:'preview';t:Template}|{k:'edit';id?:string;name:string;description:string;text:string};

// Pick a template, untick what you don't need, choose who gets the tasks, and add them all at once. Also where templates are made.
export default function TemplateDialog({target,candidates,start,onClose,onApplied}:{target:Omit<Target,'assignees'>;candidates:string[];start?:{name:string;items:TemplateItem[]};onClose:()=>void;onApplied:(n:number)=>void}){
 const {db,me}=useZarn(),confirm=useConfirm(),{all,ready,reload}=useTemplates();
 const [view,setView]=useState<View>(start?{k:'edit',name:start.name,description:'',text:toOutline(start.items)}:{k:'list'});
 const isAdmin=me.staffRole==='super_admin'||me.staffRole==='admin';
 const title=view.k==='list'?'Templates':view.k==='preview'?view.t.name:view.id?'Edit template':'New template';
 return <Modal title={title} onClose={onClose} wide>
  {view.k==='list'&&<List all={all} onPick={t=>setView({k:'preview',t})} onNew={()=>setView({k:'edit',name:'',description:'',text:''})}/>}
  {view.k==='preview'&&<Preview key={view.t.id} t={view.t} candidates={candidates} canEdit={!view.t.builtin&&(view.t.created_by===me.user_id||isAdmin)}
   onBack={()=>setView({k:'list'})} onEdit={()=>setView({k:'edit',id:view.t.id,name:view.t.name,description:view.t.description,text:toOutline(view.t.items)})}
   onDelete={async()=>{if(!await confirm({title:'Delete this template?',message:`“${view.t.name}” will be removed for everyone. Tasks already made from it stay.`,confirm:'Delete',danger:true}))return;await db.from('zarn_task_templates').delete().eq('id',view.t.id);await reload();setView({k:'list'});}}
   onApply={async(items,assignees)=>{const n=await applyTemplate(db,me.user_id,items,{...target,assignees});onApplied(n);onClose();}}/>}
  {view.k==='edit'&&<Editor key={view.id??'new'} v={view} ready={ready} onBack={()=>setView({k:'list'})}
   onSaved={async()=>{await reload();setView({k:'list'});}}/>}
 </Modal>;
}

function List({all,onPick,onNew}:{all:Template[];onPick:(t:Template)=>void;onNew:()=>void}){
 return <><div className="zt-scroll"><ul className="zt-list">{all.map(t=><li key={t.id}><button type="button" onClick={()=>onPick(t)}>
  <span className="zt-icon"><LayoutTemplate size={18}/></span><span className="zt-main"><b>{t.name}</b>{t.description&&<small>{t.description}</small>}<em>{countLabel(t)}{t.builtin?' · Built in':''}</em></span></button></li>)}</ul></div>
  <div className="zn-modal-foot"><button type="button" className="zn-btn is-primary" onClick={onNew}><Plus size={14}/>New template</button></div></>;
}

function Preview({t,candidates,canEdit,onBack,onEdit,onDelete,onApply}:{t:Template;candidates:string[];canEdit:boolean;onBack:()=>void;onEdit:()=>void;onDelete:()=>void;onApply:(items:TemplateItem[],assignees:string[])=>Promise<void>}){
 const {me}=useZarn();
 const [off,setOff]=useState<Set<number>>(new Set()),[who,setWho]=useState<string[]>([me.user_id]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const phases=phasesOf(t.items),chosen=t.items.filter((_,i)=>!off.has(i));
 const flip=(idx:number[],on:boolean)=>setOff(s=>{const n=new Set(s);for(const i of idx){if(on)n.delete(i);else n.add(i);}return n;});
 async function go(){
  if(!chosen.length||busy)return;setBusy(true);setError('');
  try{await onApply(chosen,who);}catch(e){setError(e instanceof Error?e.message:'Could not add the tasks.');setBusy(false);}
 }
 return <><div className="zt-scroll">
  <button type="button" className="zt-back" onClick={onBack}><ArrowLeft size={14}/>All templates</button>
  {t.description&&<p className="zp-muted">{t.description}</p>}
  {phases.map(p=>{const idx=t.items.map((it,i)=>(it.phase??'')===p?i:-1).filter(i=>i>=0),all=idx.every(i=>!off.has(i));return <section key={p||'_'} className="zt-phase">
   <label className="zt-phase-head"><input type="checkbox" checked={all} onChange={e=>flip(idx,e.target.checked)}/><b>{p||'Tasks'}</b><span className="zp-count">{idx.filter(i=>!off.has(i)).length}/{idx.length}</span></label>
   <ul>{idx.map(i=>{const it=t.items[i]!;return <li key={i}><label><input type="checkbox" checked={!off.has(i)} onChange={e=>flip([i],e.target.checked)}/><span><b>{it.title}{it.priority==='high'&&<i className="zt-high">High</i>}</b>{it.description&&<small>{it.description}</small>}</span></label></li>;})}</ul>
  </section>;})}
  <div className="zn-label">Assign to<AssigneePicker candidates={candidates} value={who} onToggle={m=>setWho(w=>w.includes(m)?w.filter(x=>x!==m):[...w,m])}/></div>
  {error&&<p className="zn-error" role="alert">{error}</p>}
 </div>
 <div className="zn-modal-foot">
  {canEdit&&<><button type="button" className="zn-btn" onClick={onEdit}><Pencil size={14}/>Edit</button><button type="button" className="zn-btn" onClick={onDelete}><Trash2 size={14}/>Delete</button></>}
  <button type="button" className="zn-btn is-primary" disabled={busy||!chosen.length} onClick={()=>void go()}><Check size={14}/>{busy?'Adding…':`Add ${chosen.length} task${chosen.length===1?'':'s'}`}</button>
 </div></>;
}

function Editor({v,ready,onBack,onSaved}:{v:Extract<View,{k:'edit'}>;ready:boolean;onBack:()=>void;onSaved:()=>Promise<void>}){
 const {db,me}=useZarn();
 const [name,setName]=useState(v.name),[description,setDescription]=useState(v.description),[text,setText]=useState(v.text),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const items=useMemo(()=>parseOutline(text),[text]),phases=phasesOf(items).filter(Boolean).length;
 async function save(e:React.FormEvent){
  e.preventDefault();if(!name.trim()||!items.length)return;setBusy(true);setError('');
  const row={name:name.trim().slice(0,80),description:description.trim().slice(0,300),items,updated_at:new Date().toISOString()};
  const {error:err}=v.id?await db.from('zarn_task_templates').update(row).eq('id',v.id):await db.from('zarn_task_templates').insert({...row,created_by:me.user_id});
  if(err){setError('Could not save the template. Try again.');setBusy(false);return;}
  await onSaved();
 }
 return <form className="zt-form" onSubmit={save}><div className="zt-scroll">
  <button type="button" className="zt-back" onClick={onBack}><ArrowLeft size={14}/>All templates</button>
  <label className="zn-label">Name<input className="zn-input" autoFocus maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Website launch"/></label>
  <label className="zn-label">Description (optional)<input className="zn-input" maxLength={300} value={description} onChange={e=>setDescription(e.target.value)} placeholder="When to use it"/></label>
  <label className="zn-label">Tasks<textarea className="zn-input zt-outline" rows={14} value={text} onChange={e=>setText(e.target.value)} spellCheck={false} placeholder={'## Phase one\n- First task\n- Second task | with a bit of detail\n- !Urgent task'}/></label>
  <p className="zp-muted zt-help">One task per line. Start a line with <code>##</code> for a phase, <code>-</code> or a number for a task, <code>| detail</code> after the title for a description, and <code>!</code> before the title for high priority. You can paste a checklist or a whole guide here.</p>
  <p className="zt-count">{items.length?`${items.length} task${items.length===1?'':'s'}${phases?` in ${phases} phase${phases===1?'':'s'}`:''}`:'No tasks yet'}{items.length>=LIMITS.items?` (limit ${LIMITS.items})`:''}</p>
  {!ready&&<p className="zn-error" role="alert">Saving templates isn’t switched on yet. An admin needs to apply the latest database update.</p>}
  {error&&<p className="zn-error" role="alert">{error}</p>}
 </div>
 <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onBack}>Cancel</button><button className="zn-btn is-primary" disabled={busy||!ready||!name.trim()||!items.length}>{busy?'Saving…':'Save template'}</button></div></form>;
}
