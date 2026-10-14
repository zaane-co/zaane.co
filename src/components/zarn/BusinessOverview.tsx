'use client';
import Link from 'next/link';
import {AlarmClock,BarChart3,Briefcase,Trophy} from 'lucide-react';
import {money,dueLabel,dueState} from '@/lib/crm';
import {useZarn} from './ZarnProvider';

export type Overview={leads:{id:string;name:string;company:string;status:string;stage_label:string|null;stage_color:string|null;stage_kind:string|null;deal_value:number|null;currency:string;last_activity_at:string}[];myLeadIds:string[];spaceLeadIds:string[];tasks:{id:string;lead_id:string;title:string;due_at:string|null}[]};
const totals=(rows:{deal_value:number|null;currency:string}[])=>{const m:Record<string,number>={};for(const r of rows)if(r.deal_value)m[r.currency]=(m[r.currency]??0)+Number(r.deal_value);return Object.entries(m).map(([c,v])=>money(v,c)).join(' · ')||'-';};

// Business home inside ZARN.
export default function BusinessOverview({data}:{data:Overview}){
 const {me}=useZarn();
 const open=data.leads.filter(l=>l.stage_kind==='open'),won=data.leads.filter(l=>l.stage_kind==='won');
 const mine=data.leads.filter(l=>data.myLeadIds.includes(l.id));
 const byId=Object.fromEntries(data.leads.map(l=>[l.id,l]));
 return <div className="zn-page"><div className="zn-scroll" data-lenis-prevent>
  <header className="zn-page-head"><div><h1><BarChart3 size={20}/>Business</h1><p>Hi {me.display_name.split(' ')[0]}, here’s where things stand.</p></div></header>
  <div className="zn-crm-stats">
   <div><small>Open pipeline</small><b>{totals(open)}</b><span>{open.length} open deals</span></div>
   <div><small>Won</small><b>{totals(won)}</b><span>{won.length} clients</span></div>
   <div><small>My clients</small><b>{mine.length}</b><span>spaces you’re on</span></div>
   <div><small>My open tasks</small><b>{data.tasks.length}</b><span>{data.tasks.filter(t=>dueState(t.due_at)==='overdue').length} overdue</span></div>
  </div>
  <div className="zn-biz-grid">
   <section className="zn-card"><h3><AlarmClock size={15}/>My tasks</h3>
    {data.tasks.length?<ul className="zn-rows">{data.tasks.map(t=><li key={t.id}><span><b>{t.title}</b><small>{byId[t.lead_id]?(byId[t.lead_id]!.company||byId[t.lead_id]!.name):'Client'}</small></span>{t.due_at&&<span className={`zn-due is-${dueState(t.due_at)}`}>{dueLabel(t.due_at)}</span>}<Link href={`/zarn/clients/${t.lead_id}`}>Open</Link></li>)}</ul>:<p className="zn-note">Nothing assigned to you. Nice.</p>}</section>
   <section className="zn-card"><h3><Briefcase size={15}/>My clients</h3>
    {mine.length?<ul className="zn-rows">{mine.map(l=><li key={l.id}><span className="zn-stage-dot" style={{background:l.stage_color??'#52525b'}}/><span><b>{l.company||l.name}</b><small>{l.stage_label}</small></span><Link href={`/zarn/clients/${l.id}`}>Open</Link></li>)}</ul>:<p className="zn-note">You’re not on any client team yet.</p>}</section>
   <section className="zn-card zn-span-2"><h3><Trophy size={15}/>Pipeline by stage</h3>
    <div className="zn-stagebars">{Object.values(data.leads.reduce<Record<string,{label:string;color:string;n:number}>>((m,l)=>{const k=l.status;m[k]??={label:l.stage_label??k,color:l.stage_color??'#52525b',n:0};m[k].n++;return m;},{})).map(s=><div key={s.label}><span style={{background:s.color,width:`${Math.max(6,s.n/Math.max(1,data.leads.length)*100)}%`}}/><b>{s.label}</b><small>{s.n}</small></div>)}</div>
    <Link className="zn-link" href="/zarn/crm">Open the pipeline →</Link></section>
  </div>
 </div></div>;
}
