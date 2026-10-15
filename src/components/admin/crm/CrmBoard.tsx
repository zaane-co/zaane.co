'use client';
import {useMemo,useState,useSyncExternalStore} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {AlarmClock,CalendarCheck,Globe,Tag,UserRound,Columns3,Download,Plus,Rows3,Search,SlidersHorizontal,Trophy,Wallet} from 'lucide-react';
import {stageMap,sources,totals,money,ago,dueState,dueLabel,initials,crmApi,type Lead,type PipelineStage,type Stage,type Staff,type Task} from '@/lib/crm';
import NewLead from './NewLead';
import FilterSelect from '../FilterSelect';
import StageManager,{StageBadge} from './StageManager';

type View='board'|'table';
const VIEW_KEY='za-crm-view';
// Board/table choice is a per-browser preference.
function readView():View{try{return localStorage.getItem(VIEW_KEY)==='table'?'table':'board';}catch{return 'board';}}
function subscribeView(cb:()=>void){window.addEventListener('za-crm-view',cb);return()=>window.removeEventListener('za-crm-view',cb);}
function pickView(v:View){try{localStorage.setItem(VIEW_KEY,v);}catch{}window.dispatchEvent(new Event('za-crm-view'));}

export default function CrmBoard({stages,leads,tasks,team,me,startNew}:{startNew?:boolean;stages:PipelineStage[];leads:Lead[];tasks:Task[];team:Staff[];me:string}){
 const router=useRouter();
 // Local copy for optimistic drags; reset whenever the server sends fresh leads.
 const [items,setItems]=useState(leads),[seen,setSeen]=useState(leads);
 if(seen!==leads){setSeen(leads);setItems(leads);}
 const view=useSyncExternalStore(subscribeView,readView,()=>'board' as View);
 const [search,setSearch]=useState(''),[owner,setOwner]=useState('all'),[source,setSource]=useState('all'),[category,setCategory]=useState('all');
 const allCats=useMemo(()=>[...new Set(leads.flatMap(l=>l.categories))].sort(),[leads]);
 const [creating,setCreating]=useState(!!startNew),[managing,setManaging]=useState(false),[flash,setFlash]=useState('');
 const byKey=stageMap(stages),kindOf=(l:Lead)=>byKey[l.status]?.kind??'open';
 const people=useMemo(()=>Object.fromEntries(team.map(s=>[s.id,s])),[team]);
 // Earliest open task per lead drives the follow-up chip.
 const nextTask=useMemo(()=>{const m:Record<string,Task>={};for(const t of tasks){const c=m[t.lead_id];if(!c||(t.due_at&&(!c.due_at||t.due_at<c.due_at)))m[t.lead_id]=t;}return m;},[tasks]);

 const shown=items.filter(l=>{
  if(owner==='mine'&&l.owner_id!==me)return false;if(owner==='none'&&l.owner_id)return false;if(!['all','mine','none'].includes(owner)&&l.owner_id!==owner)return false;
  if(source!=='all'&&l.source!==source)return false;
  if(category!=='all'&&!l.categories.includes(category))return false;
  const q=search.trim().toLowerCase();return !q||[l.name,l.email,l.company,l.service_interested,...l.tags,...l.categories].join(' ').toLowerCase().includes(q);
 });
 const month=new Date();month.setDate(1);month.setHours(0,0,0,0);
 const open=items.filter(l=>kindOf(l)==='open');
 const wonMonth=items.filter(l=>kindOf(l)==='won'&&new Date(l.stage_changed_at)>=month);
 const closed=items.filter(l=>kindOf(l)!=='open').length;
 const winRate=closed?Math.round(items.filter(l=>kindOf(l)==='won').length/closed*100)+'%':'-';
 const overdue=tasks.filter(t=>dueState(t.due_at)==='overdue').length,today=tasks.filter(t=>dueState(t.due_at)==='today').length;

 // Drag and drop: drop index is worked out from the cards' vertical midpoints.
 const [dragId,setDragId]=useState<string|null>(null),[target,setTarget]=useState<{stage:Stage;index:number}|null>(null);
 function over(e:React.DragEvent<HTMLDivElement>,stage:Stage){
  if(!dragId)return;e.preventDefault();e.dataTransfer.dropEffect='move';
  const cards=[...e.currentTarget.querySelectorAll<HTMLElement>('[data-card]')].filter(c=>c.dataset.card!==dragId);
  const index=cards.findIndex(c=>{const r=c.getBoundingClientRect();return e.clientY<r.top+r.height/2;});
  const next={stage,index:index<0?cards.length:index};
  if(target?.stage!==next.stage||target.index!==next.index)setTarget(next);
 }
 async function drop(stage:Stage){
  const id=dragId,t=target;setDragId(null);setTarget(null);if(!id||!t)return;
  const lead=items.find(l=>l.id===id);if(!lead)return;
  const col=items.filter(l=>l.status===stage&&l.id!==id).sort((a,b)=>a.position-b.position);
  const prev=col[t.index-1],next=col[t.index];
  const position=prev&&next?(prev.position+next.position)/2:prev?prev.position+1:next?next.position-1:0;
  if(lead.status===stage&&lead.position===position)return;
  const before=items;
  setItems(list=>list.map(l=>l.id===id?{...l,status:stage,position,stage_changed_at:l.status===stage?l.stage_changed_at:new Date().toISOString()}:l));
  try{await crmApi({action:'move',id,status:stage,position});if(lead.status!==stage){setFlash(`${lead.name} moved to ${byKey[stage]?.label??stage}.`);router.refresh();}}
  catch(e){setItems(before);setFlash(e instanceof Error?e.message:'Could not move this lead.');}
 }

 const Owner=({id}:{id:string|null})=>{const p=id?people[id]:null;return p?<span className="za-crm-owner" data-tip={p.name||p.email}>{initials(p.name||p.email)}</span>:null;};
 const Due=({lead}:{lead:Lead})=>{const t=nextTask[lead.id];if(!t)return null;const st=dueState(t.due_at);return <span className={`za-due za-due-${st}`} data-tip={t.title}><AlarmClock size={11}/>{dueLabel(t.due_at)}</span>;};

 return <div className="za-page za-page-wide">
  <div className="za-page-head">
   <div><h1>Leads</h1><p>Your pipeline, from first brief to signed project.</p></div>
   <div className="za-toolbar-actions">
    <div className="za-seg" role="group" aria-label="View">
     <button type="button" className={view==='board'?'is-on':''} aria-pressed={view==='board'} onClick={()=>pickView('board')}><Columns3 size={14}/>Board</button>
     <button type="button" className={view==='table'?'is-on':''} aria-pressed={view==='table'} onClick={()=>pickView('table')}><Rows3 size={14}/>Table</button>
    </div>
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- CSV download from an API route, not a page */}
    <a className="za-btn za-btn-ghost" href="/api/admin/leads"><Download size={15}/>Export</a>
    <button type="button" className="za-btn za-btn-ghost" onClick={()=>setManaging(true)}><SlidersHorizontal size={15}/>Stages</button>
    <button type="button" className="za-btn za-btn-primary" onClick={()=>setCreating(true)}><Plus size={15}/>New lead</button>
   </div>
  </div>

  <div className="za-stats">
   <Stat icon={Wallet} label="Open pipeline" value={totals(open)} note={`${open.length} open lead${open.length===1?'':'s'}`}/>
   <Stat icon={Trophy} label="Won this month" value={totals(wonMonth)} note={`${wonMonth.length} deal${wonMonth.length===1?'':'s'} closed`}/>
   <Stat icon={CalendarCheck} label="Win rate" value={winRate} note={`${closed} closed overall`}/>
   <Stat icon={AlarmClock} label="Follow-ups" value={String(overdue+today)} note={overdue?`${overdue} overdue`:'Due today'} alert={overdue>0}/>
  </div>

  <div className="za-toolbar">
   <div className="za-search za-search-wide"><Search size={14}/><input placeholder="Search name, company, tag…" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search leads"/></div>
   <div className="za-toolbar-actions">
    <FilterSelect label="Filter by owner" icon={<UserRound size={14}/>} value={owner} onChange={setOwner} options={[{value:'all',label:'All owners'},{value:'mine',label:'My leads'},{value:'none',label:'Unassigned'},...team.filter(s=>s.id!==me).map(s=>({value:s.id,label:s.name||s.email,group:'Team',avatar:true}))]}/>
    <FilterSelect label="Filter by source" icon={<Globe size={14}/>} value={source} onChange={setSource} options={[{value:'all',label:'All sources'},...sources.map(s=>({value:s,label:s[0]!.toUpperCase()+s.slice(1)}))]}/>
    {allCats.length>0&&<FilterSelect label="Filter by category" icon={<Tag size={14}/>} value={category} onChange={setCategory} options={[{value:'all',label:'All categories'},...allCats.map(c=>({value:c,label:c}))]}/>}
   </div>
  </div>
  {flash&&<p role="status" className="za-flash">{flash}</p>}

  {view==='board'?<div className="za-board" data-lenis-prevent>
   {stages.map(({key:stage,label,color})=>{
    const col=shown.filter(l=>l.status===stage).sort((a,b)=>a.position-b.position);
    const others=col.filter(l=>l.id!==dragId),hot=target?.stage===stage;
    return <div key={stage} className={`za-col${hot?' is-hot':''}`} onDragOver={e=>over(e,stage)} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setTarget(null);}} onDrop={e=>{e.preventDefault();void drop(stage);}}>
     <div className="za-col-head"><span className="za-col-dot" style={{background:color}}/><strong>{label}</strong><span className="za-col-count">{col.length}</span><small>{totals(col)==='-'?'':totals(col)}</small></div>
     <div className="za-col-body">
      {col.map(l=><div key={l.id}>
       {hot&&l.id!==dragId&&target.index===others.indexOf(l)&&<div className="za-drop-line"/>}
       <Link href={`/admin/leads/${l.id}`} data-card={l.id} draggable onDragStart={e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',l.id);setDragId(l.id);}} onDragEnd={()=>{setDragId(null);setTarget(null);}} className={`za-lead-card${l.id===dragId?' is-dragging':''}`}>
        <div className="za-lead-card-top"><b>{l.name}</b><Owner id={l.owner_id}/></div>
        <small>{l.company||l.service_interested||l.email}</small>
        {(l.categories.length>0||l.tags.length>0)&&<div className="za-tags">{l.categories.slice(0,3).map(c=><span key={'c'+c} className="is-cat">{c}</span>)}{l.tags.slice(0,2).map(t=><span key={t}>{t}</span>)}</div>}
        <div className="za-lead-card-foot"><span className="za-lead-value">{money(l.deal_value,l.currency)||<em>No value</em>}</span><Due lead={l}/></div>
       </Link>
      </div>)}
      {hot&&target.index>=others.length&&<div className="za-drop-line"/>}
      {!col.length&&!hot&&<p className="za-col-empty">{byKey[stage]?.system&&stage==='new'?'Website briefs land here':'Drop leads here'}</p>}
     </div>
    </div>;
   })}
  </div>
  :<section className="za-card">{shown.length?<div className="za-table-wrap"><table className="za-table za-table-click">
   <thead><tr><th>Lead</th><th>Stage</th><th>Value</th><th className="za-hide-sm">Owner</th><th className="za-hide-sm">Next follow-up</th><th className="za-hide-sm">Last activity</th></tr></thead>
   <tbody>{[...shown].sort((a,b)=>b.last_activity_at.localeCompare(a.last_activity_at)).map(l=><tr key={l.id} tabIndex={0} onClick={()=>router.push(`/admin/leads/${l.id}`)} onKeyDown={e=>{if(e.key==='Enter')router.push(`/admin/leads/${l.id}`);}}>
    <td><div className="za-cell-main"><span className="za-crm-avatar">{initials(l.name)}</span><span><b>{l.name}</b><small>{l.company||l.email}</small></span></div></td>
    <td><StageBadge stage={byKey[l.status]} fallback={l.status}/></td>
    <td>{money(l.deal_value,l.currency)||'-'}</td>
    <td className="za-hide-sm">{l.owner_id&&people[l.owner_id]?(people[l.owner_id]!.name||people[l.owner_id]!.email):'Unassigned'}</td>
    <td className="za-hide-sm">{nextTask[l.id]?<Due lead={l}/>:'-'}</td>
    <td className="za-hide-sm za-cell-muted">{ago(l.last_activity_at)}</td>
   </tr>)}</tbody>
  </table></div>:<div className="za-empty za-empty-lg"><h3>{items.length?'No matches':'No leads yet'}</h3><p>{items.length?'Try a different search or filter.':'Website briefs land here, or add one yourself.'}</p></div>}</section>}

  {managing&&<StageManager stages={stages} counts={Object.fromEntries(stages.map(s=>[s.key,items.filter(l=>l.status===s.key).length]))} onClose={()=>setManaging(false)}/>}
  {creating&&<NewLead stages={stages} team={team} me={me} onClose={()=>setCreating(false)} onCreated={id=>router.push(`/admin/leads/${id}`)}/>}
 </div>;
}

function Stat({icon:Icon,label,value,note,alert}:{icon:typeof Wallet;label:string;value:string;note:string;alert?:boolean}){
 return <div className="za-card za-stat za-crm-stat"><span className="za-stat-icon"><Icon size={19} strokeWidth={1.8}/></span><div><p>{label}</p><strong>{value}</strong><small className={alert?'is-alert':''}>{note}</small></div></div>;
}
