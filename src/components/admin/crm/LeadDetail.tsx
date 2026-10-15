'use client';
import Flash from '../Flash';
import Dropdown from '@/components/ui/Dropdown';
import {useRef,useState,useTransition} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {AlarmClock,ArrowLeft,ArrowRight,Building2,Check,CheckSquare,Copy,FileText,Mail,MessageSquare,Phone,Send,Sparkles,StickyNote,Trash2,Users,X,type LucideIcon} from 'lucide-react';
import {stageMap,sources,currencies,callOutcomes,money,ago,dueState,dueLabel,initials,crmApi,type Activity,type Invoice,type Lead,type Material,type PipelineStage,type Stage,type Staff,type Task} from '@/lib/crm';
import {F} from './NewLead';
import ProjectPanel from './ProjectPanel';
import MaterialsPanel from './MaterialsPanel';
import InvoiceList from './InvoiceList';
import LeadFiles,{type LeadFile} from '@/components/files/LeadFiles';
import {MessagesSquare} from 'lucide-react';

type Tab='note'|'call'|'meeting'|'email';
const tabs:{key:Tab;label:string;icon:LucideIcon}[]=[{key:'note',label:'Note',icon:StickyNote},{key:'call',label:'Log call',icon:Phone},{key:'meeting',label:'Log meeting',icon:Users},{key:'email',label:'Email',icon:Mail}];
const kindIcon:Record<Activity['kind'],LucideIcon>={note:StickyNote,call:Phone,meeting:Users,email:Mail,stage:ArrowRight,task:CheckSquare};
const local=(d:Date)=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);

export default function LeadDetail({initialSection='activity',files,hasSpace,canInvoice,stages,categories,materials,invoices,lead,activities,tasks,team,me,emailReady}:{initialSection?:'activity'|'project'|'materials'|'invoices';files:LeadFile[];hasSpace:boolean;canInvoice:boolean;stages:PipelineStage[];categories:string[];materials:Material[];invoices:Invoice[];lead:Lead;activities:Activity[];tasks:Task[];team:Staff[];me:string;emailReady:boolean}){
 const router=useRouter(),[pending,start]=useTransition();
 const refresh=()=>start(()=>router.refresh());
 const [flash,setFlash]=useState(''),[busy,setBusy]=useState<string|null>(null);
 const people=Object.fromEntries(team.map(s=>[s.id,s]));
 const who=(id:string|null)=>id&&people[id]?(id===me?'You':people[id]!.name||people[id]!.email):'Someone';
 async function run(key:string,body:object,done?:string){
  setBusy(key);setFlash('');
  try{const r=await crmApi(body);if(done)setFlash(done);refresh();return r;}
  catch(e){setFlash(e instanceof Error?e.message:'Something went wrong.');return null;}
  finally{setBusy(null);}
 }

 // Stage: open stages then won along the bar, lost as a separate exit.
 const byKey=stageMap(stages),label=(k?:string)=>k?byKey[k]?.label??k:'';
 const path=stages.filter(s=>s.kind!=='lost'),lostStage=stages.find(s=>s.kind==='lost'),isLost=byKey[lead.status]?.kind==='lost';
 const [lostOpen,setLostOpen]=useState(false),[lostReason,setLostReason]=useState(lead.lost_reason);
 const setStage=(status:Stage,extra:Partial<Lead>={})=>run('stage',{action:'update_lead',id:lead.id,values:{status,...extra}},`Moved to ${label(status)}.`);
 const at=path.findIndex(s=>s.key===lead.status);

 const [section,setSection]=useState<'activity'|'project'|'materials'|'invoices'>(initialSection);
 // Composer
 const [tab,setTab]=useState<Tab>('note'),[body,setBody]=useState(''),[subject,setSubject]=useState(''),[outcome,setOutcome]=useState(callOutcomes[0]!);
 const composer=useRef<HTMLTextAreaElement>(null);
 async function post(e:React.FormEvent){
  e.preventDefault();
  const ok=tab==='email'?await run('post',{action:'send_email',lead_id:lead.id,subject,body},`Email sent to ${lead.email}.`):await run('post',{action:'add_activity',lead_id:lead.id,kind:tab,body,outcome:tab==='call'?outcome:undefined});
  if(ok){setBody('');setSubject('');}
 }
 const emailTab=()=>{setSection('activity');setTab('email');setTimeout(()=>composer.current?.focus(),0);};

 // Details form: saves only what changed.
 const initial={name:lead.name,email:lead.email,company:lead.company,phone:lead.phone,website:lead.website,service_interested:lead.service_interested,budget_range:lead.budget_range,deal_value:lead.deal_value==null?'':String(lead.deal_value),currency:lead.currency,source:lead.source,owner_id:lead.owner_id??'',tags:lead.tags.join(', ')};
 const [d,setD]=useState(initial);
 const set=(k:keyof typeof d)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>setD(s=>({...s,[k]:e.target.value}));
 const dirty=(Object.keys(d) as (keyof typeof d)[]).filter(k=>d[k]!==initial[k]);
 function saveDetails(e:React.FormEvent){
  e.preventDefault();
  const values:Record<string,unknown>={};
  for(const k of dirty)values[k]=k==='deal_value'?(d.deal_value===''?null:Number(d.deal_value)):k==='owner_id'?d.owner_id||null:k==='tags'?[...new Set(d.tags.split(',').map(t=>t.trim()).filter(Boolean))]:d[k];
  void run('details',{action:'update_lead',id:lead.id,values},'Details saved.');
 }

 // Tasks
 const [taskTitle,setTaskTitle]=useState(''),[taskDue,setTaskDue]=useState(''),[showDone,setShowDone]=useState(false);
 const openTasks=tasks.filter(t=>!t.done_at),doneTasks=tasks.filter(t=>t.done_at);
 const quickDue=(days:number)=>{const x=new Date();x.setDate(x.getDate()+days);x.setHours(9,0,0,0);setTaskDue(local(x));};
 async function addTask(e:React.FormEvent){
  e.preventDefault();
  if(await run('task',{action:'add_task',lead_id:lead.id,title:taskTitle,due_at:taskDue?new Date(taskDue).toISOString():null,assignee_id:me})){setTaskTitle('');setTaskDue('');}
 }

 const [confirmDelete,setConfirmDelete]=useState(false);
 const copy=(s:string)=>{void navigator.clipboard?.writeText(s).then(()=>setFlash('Copied to clipboard.'));};

 return <div className="za-page za-lead">
  <Link href="/admin/leads" className="za-back"><ArrowLeft size={14}/>All leads</Link>
  <div className="za-lead-head">
   <span className="za-crm-avatar za-crm-avatar-lg">{initials(lead.name)}</span>
   <div className="za-lead-title">
    <h1>{lead.name}</h1>
    <p>{lead.company&&<span><Building2 size={13}/>{lead.company}</span>}<button type="button" onClick={()=>copy(lead.email)} data-tip="Copy email"><Mail size={13}/>{lead.email}<Copy size={11}/></button>{lead.phone&&<a href={`tel:${lead.phone}`}><Phone size={13}/>{lead.phone}</a>}</p>
   </div>
   <div className="za-toolbar-actions">
    <button type="button" className="za-btn za-btn-ghost" disabled={busy==='zarn'} data-tip={hasSpace?'Open this client’s ZARN space':'Create a private ZARN space for this client'} onClick={async()=>{setBusy('zarn');try{const r=await fetch('/api/zarn/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'open',lead_id:lead.id})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Could not open the client space.');window.open(`/zarn/clients/${lead.id}`,'_blank');refresh();}catch(e){setFlash(e instanceof Error?e.message:'Could not open the client space. Join ZARN first (Admin → ZARN).');}finally{setBusy(null);}}}><MessagesSquare size={14}/>{hasSpace?'Open in ZARN':'Add to ZARN'}</button>
    <button type="button" className="za-btn za-btn-ghost" onClick={emailTab}><Send size={14}/>Email</button>
    <button type="button" className="za-btn za-btn-ghost za-btn-danger-text" onClick={()=>setConfirmDelete(true)} aria-label="Delete lead" data-tip="Delete lead"><Trash2 size={14}/></button>
   </div>
  </div>

  {/* Pipeline path: connected arrow steps (done = check, current = stage colour), Lost as a separate exit. */}
  <div className="za-path-row">
   <ol className={`za-path${isLost?' is-lost':''}`} aria-label="Pipeline stage">
    {path.map((s,i)=>{const on=lead.status===s.key,past=!isLost&&i<at;
     return <li key={s.key}><button type="button" disabled={busy==='stage'} className={`za-path-step${on?' is-on':''}${past?' is-past':''}`} style={on?{background:s.color}:undefined} aria-current={on?'step':undefined} onClick={()=>!on&&setStage(s.key,{lost_reason:''})} title={on?`Current stage: ${s.label}`:`Move to ${s.label}`}>
      <span className="za-path-dot">{past?<Check size={12} strokeWidth={3}/>:i+1}</span><span className="za-path-label">{s.label}</span></button></li>;})}
   </ol>
   {lostStage&&<button type="button" disabled={busy==='stage'} className={`za-path-lost${isLost?' is-on':''}`} style={isLost?{background:lostStage.color,borderColor:lostStage.color}:undefined} aria-pressed={isLost} onClick={()=>setLostOpen(true)}><X size={14}/>{isLost?lostStage.label:`Mark ${lostStage.label.toLowerCase()}`}</button>}
  </div>
  {lostStage&&(lostOpen||isLost)&&<form className="za-lost" onSubmit={e=>{e.preventDefault();void setStage(lostStage.key,{lost_reason:lostReason}).then(()=>setLostOpen(false));}}>
   <label htmlFor="lost-reason">{isLost?'Lost because':'Why was it lost?'}</label>
   <input id="lost-reason" maxLength={300} placeholder="e.g. Budget, timing, went with another studio" value={lostReason} onChange={e=>setLostReason(e.target.value)}/>
   <button className="za-btn za-btn-primary" disabled={busy==='stage'||(isLost&&lostReason===lead.lost_reason)}>{isLost?'Update':`Mark as ${lostStage.label.toLowerCase()}`}</button>
   {!isLost&&<button type="button" className="za-btn za-btn-ghost" onClick={()=>setLostOpen(false)}>Cancel</button>}
  </form>}
  {flash&&<Flash>{flash}</Flash>}

  <div className="za-pagetabs" role="tablist" aria-label="Lead sections">{([['activity','Activity',activities.length],['project','Project',lead.categories.length||null],['materials','Files',files.length||null],['invoices','Invoices',invoices.length||null]] as const).map(([k,l,n])=><button key={k} type="button" role="tab" aria-selected={section===k} className={section===k?'is-on':''} onClick={()=>setSection(k)}>{l}{n!=null&&<span>{n}</span>}</button>)}</div>
  <div className="za-lead-grid">
   {section==='project'?<ProjectPanel lead={lead} categories={categories}/>:section==='materials'?<div className="za-lead-main"><section className="za-card"><div className="za-card-head"><h2>Files</h2><small className="za-date">{hasSpace?'Shared with this client’s ZARN team':'Staff only until you open a ZARN client space'}</small></div><div className="za-card-pad"><LeadFiles endpoint="/api/admin/crm/files" leadId={lead.id} initial={files} names={Object.fromEntries(team.map(t=>[t.id,t.name||t.email]))} me={me}/></div></section><MaterialsPanel leadId={lead.id} materials={materials}/></div>:section==='invoices'?<InvoiceList compact readOnly={!canInvoice} leadId={lead.id} invoices={invoices.map(i=>({...i,client:''}))}/>:
   <div className="za-lead-main">
    <section className="za-card">
     <div className="za-tabs" role="tablist">{tabs.map(t=><button key={t.key} type="button" role="tab" aria-selected={tab===t.key} className={tab===t.key?'is-on':''} onClick={()=>setTab(t.key)}><t.icon size={14}/>{t.label}</button>)}</div>
     {tab==='email'&&!emailReady?<p className="za-empty">Email isn’t set up. Add RESEND_API_KEY and LEAD_NOTIFICATION_EMAIL to the environment.</p>:
     <form className="za-composer" onSubmit={post}>
      {tab==='email'&&<div className="za-composer-row"><span>To</span><b>{lead.name} &lt;{lead.email}&gt;</b></div>}
      {tab==='email'&&<input aria-label="Subject" placeholder="Subject" maxLength={200} required value={subject} onChange={e=>setSubject(e.target.value)}/>}
      {tab==='call'&&<div className="za-chips" role="radiogroup" aria-label="Call outcome">{callOutcomes.map(o=><button key={o} type="button" role="radio" aria-checked={outcome===o} className={outcome===o?'is-on':''} onClick={()=>setOutcome(o)}>{o}</button>)}</div>}
      <textarea ref={composer} rows={tab==='email'?8:4} required maxLength={20000} value={body} onChange={e=>setBody(e.target.value)} placeholder={tab==='note'?'Add a note about this lead…':tab==='call'?'What was discussed?':tab==='meeting'?'Meeting notes, decisions, next steps…':`Hi ${lead.name.split(' ')[0]},`} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')e.currentTarget.form?.requestSubmit();}}/>
      <div className="za-composer-foot"><small>{tab==='email'?'Sent from the studio inbox. Replies go there too.':'⌘ + Enter to save'}</small><button className="za-btn za-btn-primary" disabled={busy==='post'||!body.trim()}>{busy==='post'?'Working…':tab==='email'?<><Send size={14}/>Send email</>:tab==='note'?'Add note':'Log it'}</button></div>
     </form>}
    </section>

    <section className="za-card">
     <div className="za-card-head"><h2>Activity</h2><small className="za-date">{pending?'Updating…':`${activities.length} entr${activities.length===1?'y':'ies'}`}</small></div>
     <ol className="za-timeline">
      {activities.map(a=>{const Icon=kindIcon[a.kind];return <li key={a.id} className={`za-tl-${a.kind}`}>
       <span className="za-tl-icon" style={a.kind==='stage'&&a.meta.to?{background:byKey[a.meta.to]?.color??'#52525b'}:undefined}><Icon size={13}/></span>
       <div className="za-tl-body">
        <p className="za-tl-meta"><b>{who(a.author_id)}</b>{a.kind==='stage'?<> moved this from <em>{label(a.meta.from)}</em> to <em>{label(a.meta.to)}</em></>:a.kind==='email'?' sent an email':a.kind==='call'?<> logged a call{a.meta.outcome&&<span className="za-tl-tag">{a.meta.outcome}</span>}</>:a.kind==='meeting'?' logged a meeting':a.kind==='task'?' completed a task':' added a note'}<time suppressHydrationWarning dateTime={a.created_at} title={new Date(a.created_at).toLocaleString('en-GB')}>{ago(a.created_at)}</time>
         {['note','call','meeting'].includes(a.kind)&&<button type="button" className="za-tl-del" aria-label="Delete entry" data-tip="Delete" onClick={()=>void run(`del-${a.id}`,{action:'delete_activity',id:a.id})}><Trash2 size={12}/></button>}</p>
        {a.kind==='email'&&<p className="za-tl-subject">{a.meta.subject}</p>}
        {a.body&&a.kind!=='stage'&&<div className={`za-tl-text${a.kind==='task'?' is-task':''}`}>{a.body}</div>}
       </div>
      </li>;})}
      <li className="za-tl-created"><span className="za-tl-icon"><Sparkles size={13}/></span><div className="za-tl-body"><p className="za-tl-meta"><b>Lead created</b>{lead.source==='website'||lead.source==='partnership'?' from the website form':` · ${lead.source}`}<time suppressHydrationWarning dateTime={lead.created_at}>{new Date(lead.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</time></p></div></li>
     </ol>
    </section>
   </div>}

   <aside className="za-lead-side">
    <section className="za-card">
     <div className="za-card-head"><h2>Follow-ups</h2><small className="za-date">{openTasks.length} open</small></div>
     <div className="za-card-pad">
      {openTasks.length?<ul className="za-tasks">{openTasks.map(t=><TaskRow key={t.id} t={t} busy={busy===t.id} onToggle={()=>void run(t.id,{action:'toggle_task',id:t.id,done:true},'Task done.')} onDelete={()=>void run(t.id,{action:'delete_task',id:t.id})}/>)}</ul>:<p className="za-muted-note">No follow-ups scheduled.</p>}
      <form className="za-task-add" onSubmit={addTask}>
       <input aria-label="New task" placeholder="Add a follow-up, e.g. Send proposal" maxLength={300} required value={taskTitle} onChange={e=>setTaskTitle(e.target.value)}/>
       <div className="za-chips">{[['Tomorrow',1],['In 3 days',3],['Next week',7]].map(([l,n])=><button key={l} type="button" onClick={()=>quickDue(n as number)}>{l}</button>)}<input type="datetime-local" aria-label="Due date" value={taskDue} onChange={e=>setTaskDue(e.target.value)}/></div>
       <button className="za-btn za-btn-ghost" disabled={busy==='task'||!taskTitle.trim()}><AlarmClock size={14}/>Add follow-up</button>
      </form>
      {doneTasks.length>0&&<><button type="button" className="za-link-btn" onClick={()=>setShowDone(v=>!v)}>{showDone?'Hide':'Show'} {doneTasks.length} completed</button>
       {showDone&&<ul className="za-tasks">{doneTasks.map(t=><TaskRow key={t.id} t={t} busy={busy===t.id} onToggle={()=>void run(t.id,{action:'toggle_task',id:t.id,done:false})} onDelete={()=>void run(t.id,{action:'delete_task',id:t.id})}/>)}</ul>}</>}
     </div>
    </section>

    <section className="za-card">
     <div className="za-card-head"><h2>Details</h2>{lead.deal_value!=null&&<strong className="za-lead-value">{money(lead.deal_value,lead.currency)}</strong>}</div>
     <form className="za-card-pad za-form-grid" onSubmit={saveDetails}>
      <F label="Deal value"><input type="number" min={0} step="any" inputMode="decimal" value={d.deal_value} onChange={set('deal_value')}/></F>
      <F label="Currency"><Dropdown label="Currency" value={d.currency} onChange={x=>setD(s=>({...s,currency:x}))} options={currencies.map(c=>({value:c,label:c}))}/></F>
      <F label="Owner"><Dropdown label="Owner" value={d.owner_id} onChange={x=>setD(s=>({...s,owner_id:x}))} options={[{value:'',label:'Unassigned'},...team.map(s=>({value:s.id,label:s.name||s.email}))]}/></F>
      <F label="Source"><Dropdown label="Source" value={d.source} onChange={x=>setD(s=>({...s,source:x}))} options={sources.map(s=>({value:s,label:s[0]!.toUpperCase()+s.slice(1)}))}/></F>
      <F label="Tags (comma separated)" wide><input maxLength={400} placeholder="e.g. fintech, urgent" value={d.tags} onChange={set('tags')}/></F>
      <F label="Name" wide><input required maxLength={120} value={d.name} onChange={set('name')}/></F>
      <F label="Email" wide><input required type="email" maxLength={254} value={d.email} onChange={set('email')}/></F>
      <F label="Company"><input maxLength={200} value={d.company} onChange={set('company')}/></F>
      <F label="Phone"><input type="tel" maxLength={40} value={d.phone} onChange={set('phone')}/></F>
      <F label="Website" wide><input type="url" maxLength={300} placeholder="https://" value={d.website} onChange={set('website')}/></F>
      <F label="Service"><input maxLength={120} value={d.service_interested} onChange={set('service_interested')}/></F>
      <F label="Budget range"><input maxLength={100} value={d.budget_range} onChange={set('budget_range')}/></F>
      {dirty.length>0&&<div className="za-field-wide za-save-row"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setD(initial)}>Discard</button><button className="za-btn za-btn-primary" disabled={busy==='details'}>{busy==='details'?'Saving…':'Save changes'}</button></div>}
     </form>
    </section>

    {lead.message&&<section className="za-card">
     <div className="za-card-head"><h2><FileText size={14}/>Original brief</h2><small className="za-date">{new Date(lead.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</small></div>
     <div className="za-card-pad"><p className="za-brief">{lead.message}</p></div>
    </section>}
    <p className="za-lead-stamp"><MessageSquare size={12}/>In {label(lead.status)} since {ago(lead.stage_changed_at)} · last activity {ago(lead.last_activity_at)}</p>
   </aside>
  </div>

  {confirmDelete&&<div className="za-modal-scrim" onClick={()=>setConfirmDelete(false)}>
   <div className="za-modal" role="alertdialog" aria-label="Delete lead" onClick={e=>e.stopPropagation()}>
    <div className="za-modal-head"><span className="za-modal-icon"><Trash2 size={18}/></span><div><strong>Delete this lead?</strong><small>{lead.name}</small></div></div>
    <p>This permanently deletes the lead with its timeline and follow-ups. It can’t be undone.</p>
    <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setConfirmDelete(false)}>Cancel</button><button type="button" className="za-btn za-btn-danger" disabled={busy==='delete'} onClick={async()=>{setBusy('delete');try{await crmApi({action:'delete_lead',id:lead.id});router.push('/admin/leads');router.refresh();}catch(e){setFlash(e instanceof Error?e.message:'Could not delete.');setBusy(null);setConfirmDelete(false);}}}>{busy==='delete'?'Deleting…':'Delete'}</button></div>
   </div>
  </div>}
 </div>;
}

function TaskRow({t,busy,onToggle,onDelete}:{t:Task;busy:boolean;onToggle:()=>void;onDelete:()=>void}){
 const st=t.done_at?'done':dueState(t.due_at);
 return <li className={`za-task${t.done_at?' is-done':''}`}>
  <input type="checkbox" checked={!!t.done_at} disabled={busy} onChange={onToggle} aria-label={t.done_at?`Reopen ${t.title}`:`Complete ${t.title}`}/>
  <div><span>{t.title}</span>{t.due_at&&<small className={`za-due za-due-${st}`}><AlarmClock size={11}/>{dueLabel(t.due_at)}</small>}</div>
  <button type="button" aria-label="Delete task" data-tip="Delete" disabled={busy} onClick={onDelete}><Trash2 size={12}/></button>
 </li>;
}
