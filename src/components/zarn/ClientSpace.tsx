'use client';
import Dropdown from '@/components/ui/Dropdown';
import {useConfirm} from './ConfirmProvider';
import ClientProjects from './ClientProjects';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {FolderKanban,AlarmClock,Check,ExternalLink,FileText,Link2,Lock,Mail,MessageSquare,Phone,Plus,Receipt,ListChecks,LayoutGrid,History,Trash2,UserPlus,X} from 'lucide-react';
import {money,ago,dueLabel,dueState,invoiceState,invoiceStateStyle,fmtDate,type InvoiceStatus} from '@/lib/crm';
import {zarnApi} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {useShell} from './nav';
import LeadFiles,{type LeadFile} from '@/components/files/LeadFiles';
import ChannelView from './ChannelView';
import {Avatar} from './format';

type Lead={id:string;name:string;company:string;email:string;phone:string;website:string;service_interested:string;budget_range:string;message:string;project_description:string;status:string;deal_value:number|null;currency:string;categories:string[];owner_id:string|null;created_at:string;last_activity_at:string};
export type SpaceData={
 files:LeadFile[];me:string;
 lead:Lead;channelId:string;stages:{key:string;label:string;color:string;kind:string;position:number}[];team:string[];
 tasks:{id:string;title:string;due_at:string|null;done_at:string|null;assignee_id:string|null;created_at:string}[];
 materials:{id:string;title:string;note:string;link:string;file_key:string|null;file_name:string;received_at:string|null}[];
 activities:{id:string;kind:string;body:string;meta:Record<string,string>;author_id:string|null;created_at:string}[];
 invoices:{id:string;number:string;status:string;total:number;amount_paid:number;currency:string;due_date:string}[]|null;
 names:Record<string,string>;canManage:boolean;canStudio:boolean;
};
type Tab='chat'|'overview'|'tasks'|'projects'|'files'|'activity'|'invoices';

// A client's private space: team chat plus everything we're tracking for them.
export default function ClientSpace({data}:{data:SpaceData}){
 const {lead,team,stages}=data,z=useZarn(),router=useRouter(),[pending,start]=useTransition(),isAdmin=z.me.staffRole==='super_admin'||z.me.staffRole==='admin';
 const [tab,setTab]=useState<Tab>('chat'),[adding,setAdding]=useState(false),[flash,setFlash]=useState('');
 const stage=stages.find(s=>s.key===lead.status);
 const openTasks=data.tasks.filter(t=>!t.done_at);
 async function act(body:object,msg?:string){
  setFlash('');
  try{await zarnApi('/api/zarn/clients',{lead_id:lead.id,...body});if(msg)setFlash(msg);start(()=>router.refresh());return true;}
  catch(e){setFlash(e instanceof Error?e.message:'Something went wrong.');return false;}
 }
 const tabs:[Tab,string,React.ReactNode,number?][]=[['chat','Chat',<MessageSquare key="c" size={15}/>,z.unread[data.channelId]?.unread],['overview','Overview',<LayoutGrid key="o" size={15}/>],['tasks','Tasks',<ListChecks key="t" size={15}/>,openTasks.length],['projects','Projects',<FolderKanban key="p" size={15}/>,(z.projects??[]).filter(p=>p.lead_id===lead.id).length||undefined],['files','Files',<FileText key="f" size={15}/>,data.files.length],['activity','Activity',<History key="a" size={15}/>]];
 if(data.invoices)tabs.push(['invoices','Invoices',<Receipt key="i" size={15}/>,data.invoices.length]);
 const name=lead.company||lead.name;
 return <div className="zn-client">
  <header className="zn-client-head">
   <div className="zn-client-title">
    <span className="zn-client-mark" style={{background:stage?.color??'#52525b'}}>{name.slice(0,1).toUpperCase()}</span>
    <div><h1>{name}<Lock size={13} className="zn-lock"/></h1><p>{lead.company?lead.name:''}{lead.service_interested&&<>{lead.company?' · ':''}{lead.service_interested}</>}</p></div>
   </div>
   <div className="zn-client-meta">
    <Dropdown variant="pill" label="Stage" value={lead.status} disabled={pending} onChange={async x=>{if(await act({action:'stage',status:x},'Stage updated.'))z.loadLead(lead.id,true);}} options={stages.map(s=>({value:s.key,label:s.label,color:s.color}))}/>
    <div className="zn-team-stack" title={team.map(id=>z.people[id]?.display_name??data.names[id]).join(', ')}>{team.slice(0,5).map(id=><Avatar key={id} m={z.people[id]} size={28} online={z.online.has(id)}/>)}{team.length>5&&<span className="zn-more">+{team.length-5}</span>}</div>
    {data.canManage&&<button type="button" className="zn-btn" onClick={()=>setAdding(true)}><UserPlus size={14}/>Team</button>}
   </div>
  </header>
  <nav className="zn-client-tabs" role="tablist">{tabs.map(([k,l,icon,n])=><button key={k} type="button" role="tab" aria-selected={tab===k} className={tab===k?'is-on':''} onClick={()=>setTab(k)}>{icon}{l}{n?<span>{n}</span>:null}</button>)}</nav>
  {flash&&<p className="zn-flash">{flash}</p>}
  <div className="zn-client-body">
   {tab==='chat'&&<ChannelView id={data.channelId} embedded/>}
   {tab==='overview'&&<Overview data={data} onAct={act} onTab={setTab}/>}
   {tab==='tasks'&&<Tasks data={data} onAct={act}/>}
   {tab==='projects'&&<ClientProjects leadId={lead.id}/>}
   {tab==='files'&&<Files data={data}/>}
   {tab==='activity'&&<Activity data={data}/>}
   {tab==='invoices'&&data.invoices&&<div className="zn-pane"><div className="zn-pane-inner">
    {data.invoices.length?<ul className="zn-rows">{data.invoices.map(i=>{const st=invoiceStateStyle[invoiceState({status:i.status as InvoiceStatus,due_date:i.due_date,total:Number(i.total),amount_paid:Number(i.amount_paid)})]!;return <li key={i.id}>
     <span><b>{i.number}</b><small>Due {fmtDate(i.due_date)}</small></span><span className="zn-stage" style={{background:st.color}}>{st.label}</span>{isAdmin&&<b>{money(Number(i.total),i.currency)}</b>}
     {data.canStudio&&<a href={`/admin/invoices/${i.id}`} target="_blank" rel="noopener noreferrer" aria-label="Open in admin"><ExternalLink size={14}/></a>}</li>;})}</ul>
     :<p className="zn-note">No invoices for this client yet.</p>}</div></div>}
  </div>
  {adding&&<TeamDialog data={data} onClose={()=>setAdding(false)} onSave={async(add,remove)=>{if(await act({action:'team',add,remove},'Team updated.')){setAdding(false);await z.reload();}}}/>}
 </div>;
}

function Overview({data,onAct,onTab}:{data:SpaceData;onAct:(b:object,m?:string)=>Promise<boolean>;onTab:(t:Tab)=>void}){
 const {lead}=data,z=useZarn(),{profile}=useShell(),isAdmin=z.me.staffRole==='super_admin'||z.me.staffRole==='admin';
 const [note,setNote]=useState(''),[copied,setCopied]=useState(false);
 const owner=lead.owner_id?(z.people[lead.owner_id]?.display_name??data.names[lead.owner_id]):null;
 const stage=data.stages.find(s=>s.key===lead.status);
 const open=data.tasks.filter(t=>!t.done_at),got=data.materials.filter(m=>m.received_at).length;
 const name=(id:string|null)=>id?(z.people[id]?.display_name??data.names[id]??'Someone'):'Unassigned';
 const brief=lead.project_description||lead.message;
 return <div className="zn-pane"><div className="zn-pane-inner zn-ov">
  <div className="zn-ov-stats">
   <div><small>Stage</small><b><i style={{background:stage?.color??'#52525b'}}/>{stage?.label??lead.status}</b></div>
   {isAdmin&&<div><small>Deal value</small><b>{lead.deal_value!=null?money(Number(lead.deal_value),lead.currency):<span className="zn-muted">Not set</span>}</b></div>}
   <button type="button" onClick={()=>onTab('tasks')}><small>Open tasks</small><b>{open.length}</b></button>
   <button type="button" onClick={()=>onTab('files')}><small>Materials</small><b>{got}/{data.materials.length}</b></button>
   <button type="button" onClick={()=>onTab('activity')}><small>Last activity</small><b>{ago(lead.last_activity_at)}</b></button>
  </div>
  <div className="zn-ov-grid">
   <div className="zn-ov-main">
    <section className="zn-card">
     <div className="zn-card-head"><h3>Project brief</h3>{lead.service_interested&&<span className="zn-cat">{lead.service_interested}</span>}</div>
     {brief?<p className="zn-pre">{brief}</p>:<p className="zn-empty-line">No brief yet.{data.canStudio?' Add one in the Studio admin (Leads → Project).':''}</p>}
     {lead.categories.length>0&&<div className="zn-cats">{lead.categories.map(c=><span key={c} className="zn-cat">{c}</span>)}</div>}
    </section>
    <section className="zn-card">
     <div className="zn-card-head"><h3>Next up</h3><button type="button" className="zn-link-btn" onClick={()=>onTab('tasks')}>All tasks →</button></div>
     {open.length?<ul className="zn-mini-tasks">{open.slice(0,4).map(t=><li key={t.id}><span className={`zn-dotline${t.due_at?` is-${dueState(t.due_at)}`:''}`}/><span><b>{t.title}</b><small>{name(t.assignee_id)}{t.due_at?` · ${dueLabel(t.due_at)}`:''}</small></span></li>)}</ul>
      :<p className="zn-empty-line">Nothing open. <button type="button" className="zn-link-btn" onClick={()=>onTab('tasks')}>Add a task</button></p>}
    </section>
    <section className="zn-card">
     <div className="zn-card-head"><h3>Log a note</h3><small className="zn-muted">Goes on the CRM timeline, not the chat</small></div>
     <form className="zn-note-form" onSubmit={async e=>{e.preventDefault();if(await onAct({action:'note',body:note},'Note saved to the CRM.'))setNote('');}}>
      <textarea className="zn-input" rows={2} maxLength={5000} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Kickoff call done, they approved the moodboard."/>
      <button className="zn-btn is-primary" disabled={!note.trim()}>Save</button>
     </form>
    </section>
   </div>
   <aside className="zn-ov-side">
    <section className="zn-card">
     <div className="zn-card-head"><h3>Contact</h3></div>
     <div className="zn-contact"><span className="zn-avatar zn-contact-mark" style={{width:40,height:40,fontSize:15,background:stage?.color??'#52525b'}}>{(lead.name||'?').slice(0,1).toUpperCase()}</span><span><b>{lead.name}</b>{lead.company&&<small>{lead.company}</small>}</span></div>
     <div className="zn-contact-actions">
      {lead.email&&<a className="zn-btn" href={`mailto:${lead.email}`}><Mail size={14}/>Email</a>}
      {lead.phone&&<a className="zn-btn" href={`tel:${lead.phone}`}><Phone size={14}/>Call</a>}
      {lead.website&&<a className="zn-btn" href={lead.website} target="_blank" rel="noopener noreferrer"><Link2 size={14}/>Site</a>}
     </div>
     <dl className="zn-dl">
      {lead.email&&<><dt>Email</dt><dd><button type="button" className="zn-copy" onClick={()=>{void navigator.clipboard?.writeText(lead.email).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1500);});}}>{lead.email}{copied&&<em>Copied</em>}</button></dd></>}
      {lead.phone&&<><dt>Phone</dt><dd>{lead.phone}</dd></>}
      {owner&&<><dt>Owner</dt><dd>{owner}</dd></>}
      <dt>Client since</dt><dd>{fmtDate(lead.created_at)}</dd>
     </dl>
     {data.canStudio&&<a className="zn-link" href={`/admin/leads/${lead.id}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/>Edit in Studio admin</a>}
    </section>
    <section className="zn-card">
     <div className="zn-card-head"><h3>Team</h3><small className="zn-muted">{data.team.length} {data.team.length===1?'person':'people'}</small></div>
     <ul className="zn-team-list">{data.team.map(id=><li key={id} className="is-click" role="button" tabIndex={0} onClick={()=>profile(id)}><Avatar m={z.people[id]} size={32} online={z.online.has(id)}/><span><b>{z.people[id]?.display_name??data.names[id]??'Former member'}</b><small>{z.people[id]?.title||(z.online.has(id)?'Online':'Offline')}</small></span></li>)}</ul>
    </section>
   </aside>
  </div>
 </div></div>;
}

function Tasks({data,onAct}:{data:SpaceData;onAct:(b:object,m?:string)=>Promise<boolean>}){
 const z=useZarn();
 const [title,setTitle]=useState(''),[due,setDue]=useState(''),[who,setWho]=useState(z.me.user_id),[showDone,setShowDone]=useState(false);
 const open=data.tasks.filter(t=>!t.done_at),done=data.tasks.filter(t=>t.done_at);
 const name=(id:string|null)=>id?(z.people[id]?.display_name??data.names[id]??'Someone'):'Unassigned';
 const row=(t:SpaceData['tasks'][number])=><li key={t.id} className={`zn-task${t.done_at?' is-done':''}`}>
  <input type="checkbox" checked={!!t.done_at} onChange={e=>void onAct({action:'task_toggle',id:t.id,done:e.target.checked})} aria-label={`Complete ${t.title}`}/>
  <div><b>{t.title}</b><small><Avatar m={t.assignee_id?z.people[t.assignee_id]:undefined} size={16}/>{name(t.assignee_id)}{t.due_at&&<span className={`zn-due is-${t.done_at?'done':dueState(t.due_at)}`}><AlarmClock size={11}/>{dueLabel(t.due_at)}</span>}</small></div>
  <button type="button" aria-label="Delete task" onClick={()=>void onAct({action:'task_delete',id:t.id})}><Trash2 size={13}/></button>
 </li>;
 return <div className="zn-pane"><div className="zn-pane-inner">
  <form className="zn-task-form" onSubmit={async e=>{e.preventDefault();if(await onAct({action:'task_add',title,due_at:due?new Date(due).toISOString():null,assignee_id:who},'Task added.')){setTitle('');setDue('');}}}>
   <input className="zn-input" required maxLength={300} placeholder="Add a task, e.g. Send first logo concepts" value={title} onChange={e=>setTitle(e.target.value)}/>
   <div className="zn-row"><Dropdown label="Assign to" value={who} onChange={setWho} options={data.team.map(id=>({value:id,label:`${name(id)}${id===z.me.user_id?' (me)':''}`}))}/>
    <input className="zn-input" type="datetime-local" value={due} onChange={e=>setDue(e.target.value)} aria-label="Due"/>
    <button className="zn-btn is-primary" disabled={!title.trim()}><Plus size={14}/>Add</button></div>
  </form>
  {open.length?<ul className="zn-tasks">{open.map(row)}</ul>:<p className="zn-note">No open tasks. Add what the team needs to do for this client.</p>}
  {done.length>0&&<><button type="button" className="zn-link" onClick={()=>setShowDone(v=>!v)}><Check size={13}/>{showDone?'Hide':'Show'} {done.length} completed</button>{showDone&&<ul className="zn-tasks">{done.map(row)}</ul>}</>}
 </div></div>;
}

function Files({data}:{data:SpaceData}){
 const got=data.materials.filter(m=>m.received_at).length;
 return <div className="zn-pane"><div className="zn-pane-inner">
  <section className="zn-card"><div className="zn-card-head"><h3>Files</h3><small className="zn-muted">Shared with the team and staff</small></div>
   <LeadFiles preview endpoint="/api/zarn/clients/files" leadId={data.lead.id} initial={data.files} names={data.names} me={data.me}/></section>
  <h3 className="zn-files-sub">Materials checklist</h3>
  <p className="zn-note">Materials from the client: {got} of {data.materials.length} received.{data.canStudio?' Add or tick items off in the Studio admin (Leads → Materials).':''}</p>
  {data.materials.length?<ul className="zn-rows">{data.materials.map(m=><li key={m.id}><span className={`zn-tick${m.received_at?' is-on':''}`}>{m.received_at?<Check size={13}/>:null}</span><span><b>{m.title}</b>{m.note&&<small>{m.note}</small>}</span>
   {m.link&&<a href={m.link} target="_blank" rel="noopener noreferrer"><Link2 size={14}/>Link</a>}
   {m.file_key&&<a href={`/api/zarn/clients/file?id=${m.id}`}><FileText size={14}/>{m.file_name||'File'}</a>}</li>)}</ul>:<p className="zn-note">No materials tracked yet.</p>}
 </div></div>;
}

function Activity({data}:{data:SpaceData}){
 const z=useZarn();
 const who=(id:string|null)=>id?(z.people[id]?.display_name??data.names[id]??'Someone'):'System';
 const label=(a:SpaceData['activities'][number])=>a.kind==='stage'?`moved the deal from ${a.meta.from} to ${a.meta.to}`:a.kind==='email'?`emailed the client: ${a.meta.subject??''}`:a.kind==='task'?'completed a task':a.kind==='call'?'logged a call':a.kind==='meeting'?'logged a meeting':'added a note';
 return <div className="zn-pane"><div className="zn-pane-inner">
  {data.activities.length?<ol className="zn-timeline">{data.activities.map(a=><li key={a.id}><b>{who(a.author_id)}</b> {label(a)}<time>{ago(a.created_at)}</time>{a.body&&a.kind!=='stage'&&<p>{a.body}</p>}</li>)}</ol>:<p className="zn-note">No CRM activity yet.</p>}
 </div></div>;
}

function TeamDialog({data,onClose,onSave}:{data:SpaceData;onClose:()=>void;onSave:(add:string[],remove:string[])=>Promise<void>}){
 const z=useZarn(),confirm=useConfirm();
 const [sel,setSel]=useState<string[]>([]),[q,setQ]=useState(''),[busy,setBusy]=useState(false);
 const staff=z.members.filter(m=>!m.deactivated_at&&m.account_type==='member');
 const onTeam=staff.filter(m=>data.team.includes(m.user_id)),pool=staff.filter(m=>!data.team.includes(m.user_id)&&`${m.display_name} ${m.title}`.toLowerCase().includes(q.toLowerCase()));
 async function run(add:string[],remove:string[]){setBusy(true);try{await onSave(add,remove);}finally{setBusy(false);}}
 return <div className="zn-modal-scrim" onClick={onClose}><div className="zn-modal" role="dialog" aria-label="Client team" onClick={e=>e.stopPropagation()}>
  <div className="zn-modal-head"><h2>Client team</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
  <p className="zn-note">Only these people (and admins) can see this client’s space and chat.</p>
  <p className="zn-section-label">On this client · {onTeam.length}</p>
  <ul className="zn-list zn-member-list">{onTeam.length?onTeam.map(m=><li key={m.user_id}><div className="zn-person"><Avatar m={m} size={28}/><span><b>{m.display_name}</b><small>{m.title||m.email}</small></span><button type="button" className="zn-remove" disabled={busy} onClick={async()=>{if(await confirm({title:`Remove ${m.display_name}?`,message:'They will lose access to this client’s space and chat.',confirm:'Remove',danger:true}))void run([],[m.user_id]);}}>Remove</button></div></li>):<li className="zn-note">No one yet. Add people below.</li>}</ul>
  <p className="zn-section-label">Add people</p>
  <input className="zn-input" placeholder="Search staff" value={q} onChange={e=>setQ(e.target.value)}/>
  <ul className="zn-list zn-list-scroll">{pool.map(m=><li key={m.user_id}><button type="button" className={sel.includes(m.user_id)?'is-on':''} onClick={()=>setSel(s=>s.includes(m.user_id)?s.filter(x=>x!==m.user_id):[...s,m.user_id])}><Avatar m={m} size={28}/><span><b>{m.display_name}</b><small>{m.title||m.email}</small></span>{sel.includes(m.user_id)&&<Check size={16} className="zn-check"/>}</button></li>)}</ul>
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="button" className="zn-btn is-primary" disabled={busy||!sel.length} onClick={()=>void run(sel,[])}>Add {sel.length||''}</button></div>
 </div></div>;
}
