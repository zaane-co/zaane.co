'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Check,Plus} from 'lucide-react';
import {crmApi,type Lead} from '@/lib/crm';

// Project scope for a lead: a free-form description and any number of service categories.
export default function ProjectPanel({lead,categories}:{lead:Lead;categories:string[]}){
 const router=useRouter();
 const [desc,setDesc]=useState(lead.project_description),[picked,setPicked]=useState(lead.categories);
 const [extra,setExtra]=useState<string[]>([]),[adding,setAdding]=useState(false),[name,setName]=useState('');
 const [busy,setBusy]=useState(false),[flash,setFlash]=useState('');
 const all=[...new Set([...categories,...extra,...lead.categories])].sort((a,b)=>a.localeCompare(b));
 const dirty=desc!==lead.project_description||JSON.stringify([...picked].sort())!==JSON.stringify([...lead.categories].sort());
 async function save(){
  setBusy(true);setFlash('');
  try{await crmApi({action:'update_lead',id:lead.id,values:{project_description:desc,categories:picked}});setFlash('Project saved.');router.refresh();}
  catch(e){setFlash(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}
 }
 async function create(e:React.FormEvent){
  e.preventDefault();const n=name.trim().replace(/\s+/g,' ');if(!n)return;
  setBusy(true);setFlash('');
  try{await crmApi({action:'category_create',name:n});setExtra(x=>[...x,n]);setPicked(p=>p.includes(n)?p:[...p,n]);setName('');setAdding(false);}
  catch(err){setFlash(err instanceof Error?err.message:'Could not add it.');}finally{setBusy(false);}
 }
 const toggle=(c:string)=>setPicked(p=>p.includes(c)?p.filter(x=>x!==c):[...p,c]);
 return <section className="za-card">
  <div className="za-card-head"><h2>Project</h2><small className="za-date">{picked.length} categor{picked.length===1?'y':'ies'}</small></div>
  <div className="za-card-pad za-project">
   <div className="za-field"><span className="za-field-name">Categories (pick as many as apply)</span>
    <div className="za-chips za-cat-chips">
     {all.map(c=><button key={c} type="button" role="checkbox" aria-checked={picked.includes(c)} className={picked.includes(c)?'is-on':''} onClick={()=>toggle(c)}>{picked.includes(c)&&<Check size={12}/>}{c}</button>)}
     {adding?<form className="za-inline-create" onSubmit={create}><input autoFocus maxLength={60} placeholder="New category" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){setAdding(false);setName('');}}}/><button className="za-btn za-btn-primary" disabled={busy||!name.trim()}>Add</button></form>
      :<button type="button" className="za-chip-add" onClick={()=>setAdding(true)}><Plus size={12}/>New category</button>}
    </div>
   </div>
   <label className="za-field"><span className="za-field-name">Project description</span>
    <textarea rows={12} maxLength={50000} placeholder={'What are we building? Goals, scope, deliverables, timeline, anything agreed on calls…'} value={desc} onChange={e=>setDesc(e.target.value)}/></label>
   {flash&&<p role="status" className="za-flash">{flash}</p>}
   {dirty&&<div className="za-save-row"><button type="button" className="za-btn za-btn-ghost" onClick={()=>{setDesc(lead.project_description);setPicked(lead.categories);}}>Discard</button><button type="button" className="za-btn za-btn-primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save project'}</button></div>}
  </div>
 </section>;
}
