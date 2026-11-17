'use client';
import {useState} from 'react';
import {CalendarDays,Check,CheckCircle2,Circle,ExternalLink,Flag,Link2,Loader2,PenLine,Plus,Target,Trash2,UserRound,Users,BookOpen,FileText,PackageCheck} from 'lucide-react';
import {useZarn,type ZProject} from './ZarnProvider';
import {Avatar,dayOf} from './format';

type Deliverable={id:string;title:string;done:boolean;due?:string};
type LinkItem={label:string;url:string};
export type About={goals?:string[];deliverables?:Deliverable[];onboarding?:string;links?:LinkItem[];status?:'planning'|'active'|'on_hold'|'done';start?:string;end?:string};
type Section='overview'|'goals'|'deliverables'|'onboarding'|'links'|'details';
const statuses:[NonNullable<About['status']>,string,string][]=[['planning','Planning','#6366f1'],['active','Active','#16a34a'],['on_hold','On hold','#d97706'],['done','Done','#52525b']];
const rid=()=>Math.random().toString(36).slice(2,10);

// About a project: overview, goals, core deliverables, onboarding notes, key links, and its details.
// The project owner (and admins) edit it, one section at a time; everyone on the project reads it.
export default function ProjectBrief({project,canEdit,onSaved,clientName,members=[]}:{project:ZProject;canEdit:boolean;onSaved:(brief:string,about?:About)=>void;clientName:string;members?:string[]}){
 const {db,reloadProjects,people,projectGroups}=useZarn();
 const about=(project.about??{}) as About;
 const [editing,setEditing]=useState<Section|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 // Drafts for whichever section is open.
 const [text,setText]=useState(''),[list,setList]=useState<string[]>([]),[dels,setDels]=useState<Deliverable[]>([]),[links,setLinks]=useState<LinkItem[]>([]),[det,setDet]=useState<Pick<About,'status'|'start'|'end'>>({});

 function open(s:Section){
  setError('');setEditing(s);
  if(s==='overview')setText(project.brief);if(s==='onboarding')setText(about.onboarding??'');
  if(s==='goals')setList(about.goals?.length?[...about.goals]:['']);
  if(s==='deliverables')setDels(about.deliverables?.length?about.deliverables.map(d=>({...d})):[{id:rid(),title:'',done:false}]);
  if(s==='links')setLinks(about.links?.length?about.links.map(l=>({...l})):[{label:'',url:''}]);
  if(s==='details')setDet({status:about.status,start:about.start,end:about.end});
 }
 async function write(patch:{brief?:string;about?:About}){
  setBusy(true);setError('');
  const {error:e}=await db.from('zarn_projects').update(patch).eq('id',project.id);
  setBusy(false);if(e){setError('Could not save that.');return false;}
  onSaved(patch.brief??project.brief,patch.about??about);void reloadProjects();return true;
 }
 async function save(){
  if(!editing)return;
  let ok=false;
  if(editing==='overview')ok=await write({brief:text.trim().slice(0,20000)});
  else{
   const next:About={...about};
   if(editing==='onboarding')next.onboarding=text.trim().slice(0,20000);
   if(editing==='goals')next.goals=list.map(x=>x.trim()).filter(Boolean).slice(0,30);
   if(editing==='deliverables')next.deliverables=dels.map(d=>({...d,title:d.title.trim()})).filter(d=>d.title).slice(0,60);
   if(editing==='links')next.links=links.map(l=>({label:l.label.trim(),url:l.url.trim()})).filter(l=>l.url).map(l=>({label:l.label||l.url,url:/^https?:\/\//i.test(l.url)?l.url:`https://${l.url}`})).slice(0,30);
   if(editing==='details'){next.status=det.status;next.start=det.start||undefined;next.end=det.end||undefined;}
   ok=await write({about:next});
  }
  if(ok)setEditing(null);
 }
 // Ticking a deliverable saves straight away.
 async function toggle(d:Deliverable){if(!canEdit)return;await write({about:{...about,deliverables:(about.deliverables??[]).map(x=>x.id===d.id?{...x,done:!x.done}:x)}});}

 const head=(s:Section,icon:React.ReactNode,title:string,empty:boolean)=><header className="zab-head"><h3>{icon}{title}</h3>{canEdit&&editing!==s&&<button type="button" className="zab-edit" onClick={()=>open(s)}>{empty?<><Plus size={14}/>Add</>:<><PenLine size={14}/>Edit</>}</button>}</header>;
 const actions=<>{error&&<p className="zn-error" role="alert">{error}</p>}<div className="zab-actions"><button type="button" className="zn-btn" disabled={busy} onClick={()=>setEditing(null)}>Cancel</button><button type="button" className="zn-btn is-primary" disabled={busy} onClick={()=>void save()}>{busy?<><Loader2 size={14} className="zn-spin"/>Saving…</>:<><Check size={14}/>Save</>}</button></div></>;
 const none=(t:string)=><p className="zab-none">{canEdit?t:'Nothing here yet.'}</p>;
 const delsDone=(about.deliverables??[]).filter(d=>d.done).length,delsAll=(about.deliverables??[]).length;
 const st=statuses.find(s=>s[0]===about.status);
 const group=projectGroups.find(g=>g.id===project.group_id);

 return <div className="zab">
  <div className="zab-main">
   <section className="zab-card">{head('overview',<FileText size={16}/>,'Overview',!project.brief)}
    {editing==='overview'?<><textarea className="zn-input zab-text" rows={8} maxLength={20000} autoFocus value={text} onChange={e=>setText(e.target.value)} placeholder="What is this project, who is it for, and why are we building it?"/>{actions}</>
     :project.brief?<div className="zab-prose">{project.brief}</div>:none('Say what this project is, who it is for and why it matters.')}
   </section>

   <section className="zab-card">{head('goals',<Target size={16}/>,'Goals',!about.goals?.length)}
    {editing==='goals'?<><div className="zab-rows">{list.map((g,i)=><div key={i} className="zab-row"><input className="zn-input" autoFocus={i===list.length-1} maxLength={300} value={g} onChange={e=>setList(l=>l.map((x,j)=>j===i?e.target.value:x))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();setList(l=>[...l,'']);}}} placeholder="A goal, e.g. Launch the beta by March"/><button type="button" className="zab-x" aria-label="Remove" onClick={()=>setList(l=>l.filter((_,j)=>j!==i))}><Trash2 size={14}/></button></div>)}</div>
     <button type="button" className="zab-more" onClick={()=>setList(l=>[...l,''])}><Plus size={14}/>Add goal</button>{actions}</>
     :about.goals?.length?<ol className="zab-goals">{about.goals.map((g,i)=><li key={i}><span>{i+1}</span>{g}</li>)}</ol>:none('List what this project must achieve.')}
   </section>

   <section className="zab-card">{head('deliverables',<PackageCheck size={16}/>,'Core deliverables',!delsAll)}
    {editing==='deliverables'?<><div className="zab-rows">{dels.map((d,i)=><div key={d.id} className="zab-row"><input className="zn-input" autoFocus={i===dels.length-1} maxLength={300} value={d.title} onChange={e=>setDels(l=>l.map(x=>x.id===d.id?{...x,title:e.target.value}:x))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();setDels(l=>[...l,{id:rid(),title:'',done:false}]);}}} placeholder="A deliverable, e.g. Mobile app on the App Store"/>
      <input className="zn-input zab-date" type="date" value={d.due??''} onChange={e=>setDels(l=>l.map(x=>x.id===d.id?{...x,due:e.target.value||undefined}:x))} aria-label="Due date"/>
      <button type="button" className="zab-x" aria-label="Remove" onClick={()=>setDels(l=>l.filter(x=>x.id!==d.id))}><Trash2 size={14}/></button></div>)}</div>
     <button type="button" className="zab-more" onClick={()=>setDels(l=>[...l,{id:rid(),title:'',done:false}])}><Plus size={14}/>Add deliverable</button>{actions}</>
     :delsAll?<><div className="zab-progress"><span style={{width:`${Math.round(delsDone/delsAll*100)}%`}}/></div><small className="zab-progress-label">{delsDone} of {delsAll} done</small>
      <ul className="zab-dels">{about.deliverables!.map(d=><li key={d.id} className={d.done?'is-done':''}><button type="button" disabled={!canEdit} aria-label={d.done?'Mark not done':'Mark done'} onClick={()=>void toggle(d)}>{d.done?<CheckCircle2 size={18}/>:<Circle size={18}/>}</button><span>{d.title}</span>{d.due&&<em><CalendarDays size={12}/>{dayOf(d.due)}</em>}</li>)}</ul></>
     :none('List the main things this project has to deliver.')}
   </section>

   <section className="zab-card">{head('onboarding',<BookOpen size={16}/>,'Onboarding notes',!about.onboarding)}
    {editing==='onboarding'?<><textarea className="zn-input zab-text" rows={8} maxLength={20000} autoFocus value={text} onChange={e=>setText(e.target.value)} placeholder={'What someone joining needs to know:\nwho to ask, where things live, how we work, access they need…'}/>{actions}</>
     :about.onboarding?<div className="zab-prose">{about.onboarding}</div>:none('Write what a new team member needs to know to get going.')}
   </section>

   <section className="zab-card">{head('links',<Link2 size={16}/>,'Key links',!about.links?.length)}
    {editing==='links'?<><div className="zab-rows">{links.map((l,i)=><div key={i} className="zab-row"><input className="zn-input zab-label" maxLength={80} value={l.label} onChange={e=>setLinks(x=>x.map((y,j)=>j===i?{...y,label:e.target.value}:y))} placeholder="Name, e.g. Figma"/><input className="zn-input" maxLength={500} value={l.url} onChange={e=>setLinks(x=>x.map((y,j)=>j===i?{...y,url:e.target.value}:y))} placeholder="https://"/><button type="button" className="zab-x" aria-label="Remove" onClick={()=>setLinks(x=>x.filter((_,j)=>j!==i))}><Trash2 size={14}/></button></div>)}</div>
     <button type="button" className="zab-more" onClick={()=>setLinks(x=>[...x,{label:'',url:''}])}><Plus size={14}/>Add link</button>{actions}</>
     :about.links?.length?<div className="zab-links">{about.links.map((l,i)=><a key={i} href={l.url} target="_blank" rel="noopener noreferrer"><Link2 size={15}/><span><b>{l.label}</b><small>{l.url.replace(/^https?:\/\//,'')}</small></span><ExternalLink size={14}/></a>)}</div>:none('Add the repo, designs, staging site and other places the team uses.')}
   </section>
  </div>

  <aside className="zab-side">
   <section className="zab-card">{head('details',<Flag size={16}/>,'Details',false)}
    {editing==='details'?<><div className="zn-label">Status<div className="zab-status-pick">{statuses.map(([k,l,c])=><button key={k} type="button" className={det.status===k?'is-on':''} onClick={()=>setDet(d=>({...d,status:k}))}><i style={{background:c}}/>{l}</button>)}</div></div>
     <label className="zn-label">Start date<input className="zn-input" type="date" value={det.start??''} onChange={e=>setDet(d=>({...d,start:e.target.value}))}/></label>
     <label className="zn-label">Target date<input className="zn-input" type="date" value={det.end??''} onChange={e=>setDet(d=>({...d,end:e.target.value}))}/></label>{actions}</>
     :<dl className="zab-dl">
      <div><dt>Status</dt><dd>{st?<span className="zab-status" style={{background:st[2]}}>{st[1]}</span>:'Not set'}</dd></div>
      <div><dt>Start</dt><dd>{about.start?dayOf(about.start):'Not set'}</dd></div>
      <div><dt>Target</dt><dd>{about.end?dayOf(about.end):'Not set'}</dd></div>
      <div><dt><UserRound size={13}/>Owner</dt><dd>{project.created_by?<span className="zab-person"><Avatar m={people[project.created_by]} size={20}/>{people[project.created_by]?.display_name??'Member'}</span>:'—'}</dd></div>
      {!clientName&&<div><dt>Group</dt><dd>{group?<span className="zab-group"><i style={{background:group.color}}/>{group.name}</span>:'No group'}</dd></div>}
      {clientName&&<div><dt>Client</dt><dd>{clientName}</dd></div>}
      <div><dt><Users size={13}/>Team</dt><dd>{members.length} {members.length===1?'person':'people'}</dd></div>
      <div><dt>Created</dt><dd>{dayOf(project.created_at)}</dd></div>
     </dl>}
   </section>
  </aside>
 </div>;
}
