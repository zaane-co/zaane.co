'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {FolderKanban,Plus} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {NewProject} from './Projects';
// The projects linked to this client, with how far along each one is.
export default function ClientProjects({leadId}:{leadId:string}){
 const {db,projects,people}=useZarn();
 const mine=useMemo(()=>(projects??[]).filter(p=>p.lead_id===leadId),[projects,leadId]);
 const ids=mine.map(p=>p.id).join(',');
 const [counts,setCounts]=useState<Record<string,{total:number;done:number}>>({}),[creating,setCreating]=useState(false);
 useEffect(()=>{
  const list=ids?ids.split(','):[];if(!list.length)return;let live=true;
  void (async()=>{
   const {data}=await db.from('zarn_tasks').select('project_id,status').in('project_id',list);
   if(!live)return;
   const c:Record<string,{total:number;done:number}>={};
   for(const t of (data??[]) as {project_id:string;status:string}[]){const x=c[t.project_id]??={total:0,done:0};x.total++;if(t.status==='done')x.done++;}
   setCounts(c);
  })();
  return()=>{live=false;};
 },[db,ids]);
 return <div className="zn-pane"><div className="zn-pane-inner">
  <div className="zn-card-head"><h3>Projects for this client</h3><button type="button" className="zn-btn is-primary" onClick={()=>setCreating(true)}><Plus size={14}/>New project</button></div>
  {mine.length?<div className="zcp-list">{mine.map(p=>{const c=counts[p.id]??{total:0,done:0},pct=c.total?Math.round(c.done/c.total*100):0;return <Link key={p.id} href={`/zarn/projects/${p.id}`} className="zcp-card">
   <span className="zp-badge" style={{background:p.color}}>{p.name.slice(0,1).toUpperCase()}</span>
   <span className="zcp-main"><b>{p.name}</b><small>{p.description||(p.brief?p.brief.slice(0,90):'No description')}</small>
    <span className="zcp-bar" aria-label={`${pct}% done`}><i style={{width:`${pct}%`,background:p.color}}/></span>
    <small>{c.total?`${c.done} of ${c.total} tasks done`:'No tasks yet'}{p.created_by&&people[p.created_by]?` · started by ${people[p.created_by]!.display_name}`:''}</small></span>
  </Link>;})}</div>
  :<div className="zn-empty-state"><FolderKanban size={26}/><h2>No projects yet</h2><p>Start a project for this client to plan the work, assign tasks and track progress.</p></div>}
  {creating&&<NewProject clientId={leadId} onClose={()=>setCreating(false)} onCreated={()=>setCreating(false)}/>}
 </div></div>;
}
