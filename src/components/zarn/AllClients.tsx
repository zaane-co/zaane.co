'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Lock,Plus,Search,Users} from 'lucide-react';
import {money,ago} from '@/lib/crm';
import {useZarn} from './ZarnProvider';
import {Avatar} from './format';
import AddClient from './AddClient';

export type ClientRow={lead_id:string;name:string;contact:string;stage:string;color:string;value:number|null;currency:string;team:string[];openTasks:number;last:string;canOpen:boolean};
export default function AllClients({rows}:{rows:ClientRow[]}){
 const {people,me}=useZarn();
 const [q,setQ]=useState(''),[adding,setAdding]=useState(false);
 const shown=rows.filter(r=>`${r.name} ${r.contact} ${r.stage}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>b.last.localeCompare(a.last));
 const canAdd=me.account_type!=='guest';
 return <div className="zn-page">
  <header className="zn-page-head"><div><h1><Users size={20}/>All clients</h1><p>{rows.length} client spaces. You can open the ones you’re on.</p></div>{canAdd&&<button type="button" className="zn-btn is-primary" onClick={()=>setAdding(true)}><Plus size={14}/>Add client</button>}</header>
  <div className="zn-crm-bar"><span className="zn-prefix"><Search size={15}/><input className="zn-input" placeholder="Search clients" value={q} onChange={e=>setQ(e.target.value)}/></span></div>
  <div className="zn-crm-list" data-lenis-prevent>{shown.length?shown.map(r=>{const body=<>
   <span className="zn-stage-dot" style={{background:r.color}}/><span className="zn-crm-name"><b>{r.name}</b><small>{r.contact||' '}</small></span>
   <span className="zn-stage" style={{background:r.color}}>{r.stage}</span>
   <span className="zn-crm-val">{r.value!=null?money(Number(r.value),r.currency):''}</span>
   <span className="zn-team-stack zn-crm-owner">{r.team.slice(0,4).map(id=><Avatar key={id} m={people[id]} size={22}/>)}{r.team.length>4&&<span className="zn-more">+{r.team.length-4}</span>}</span>
  </>;
   return r.canOpen?<Link key={r.lead_id} href={`/zarn/clients/${r.lead_id}`} className="zn-crm-row zn-client-row">{body}</Link>
    :<div key={r.lead_id} className="zn-crm-row zn-client-row is-locked" title="Only this client’s team can open it">{body}<Lock size={13}/></div>;})
   :<div className="zn-empty-state"><h2>No client spaces yet</h2><p>Add a client, or open one from a lead in the Pipeline.</p></div>}</div>
  <p className="zn-foot-note">Last activity is shown on hover. {shown[0]?`Most recent: ${ago(shown[0].last)}.`:''}</p>
  {adding&&<AddClient onClose={()=>setAdding(false)}/>}
 </div>;
}
