'use client';
import Link from 'next/link';
import {AlarmClock,TrendingUp,Briefcase,Trophy,CalendarClock} from 'lucide-react';
import {money,dueLabel,dueState} from '@/lib/crm';
import {useZarn} from './ZarnProvider';
import {sumBy} from '@/lib/biz';
import {sums} from './BizMoney';
import {fmtDay,lagosToday} from '@/lib/zarn-care';

export type Overview={leads:{id:string;name:string;company:string;status:string;stage_label:string|null;stage_color:string|null;stage_kind:string|null;deal_value:number|null;currency:string;last_activity_at:string}[];myLeadIds:string[];spaceLeadIds:string[];tasks:{id:string;lead_id:string;title:string;due_at:string|null}[];money?:{in:Amt[];out:Amt[];owed:(Amt&{late:boolean})[];bills:{id:string;title:string;amount:number;currency:string;due_on:string}[];newLeads:number}};
type Amt={amount:number;currency:string};
// Money per currency; when no deal values are set yet, say so instead of a bare dash.
const totals=(rows:{deal_value:number|null;currency:string}[])=>{const m:Record<string,number>={};for(const r of rows)if(r.deal_value)m[r.currency]=(m[r.currency]??0)+Number(r.deal_value);const t=Object.entries(m).map(([c,v])=>money(v,c)).join(' · ');return t?<>{t}</>:<span className="zn-muted">{rows.length?'No values set':'None yet'}</span>;};
const plural=(n:number,one:string,many=one+'s')=>`${n} ${n===1?one:many}`;

// Business home inside ZARN.
export default function BusinessOverview({data}:{data:Overview}){
 const {me}=useZarn();
 const open=data.leads.filter(l=>l.stage_kind==='open'),won=data.leads.filter(l=>l.stage_kind==='won');
 const mine=data.leads.filter(l=>data.myLeadIds.includes(l.id));
 const byId=Object.fromEntries(data.leads.map(l=>[l.id,l]));
 return <div className="zn-page"><div className="zn-scroll" data-lenis-prevent>
  <header className="zn-page-head"><div><h1><TrendingUp size={20}/>Business</h1><p>Hi {me.display_name.split(' ')[0]}, here’s where things stand.</p></div></header>
  <div className="zn-crm-stats">
   <div><small>Open pipeline</small><b>{totals(open)}</b><span>{plural(open.length,'open deal')}</span></div>
   <div><small>Won</small><b>{totals(won)}</b><span>{plural(won.length,'client')}</span></div>
   <div><small>My clients</small><b>{mine.length}</b><span>spaces you’re on</span></div>
   <div><small>My open tasks</small><b>{data.tasks.length}</b><span>{data.tasks.filter(t=>dueState(t.due_at)==='overdue').length} overdue</span></div>
  </div>
  {data.money&&<div className="zn-crm-stats">
   <div><small>In this month</small><b className="zb-in">{sums(sumBy(data.money.in))}</b><span><Link href="/zarn/business/money">Open Money</Link></span></div>
   <div><small>Out this month</small><b className="zb-out">{sums(sumBy(data.money.out))}</b><span>{data.money.out.length} expenses</span></div>
   <div><small>Owed to us</small><b>{sums(sumBy(data.money.owed))}</b><span><Link href="/zarn/business/invoices">{data.money.owed.filter(o=>o.late).length} overdue invoices</Link></span></div>
   <div><small>New leads</small><b>{data.money.newLeads}</b><span><Link href="/zarn/business/leads">this week</Link></span></div>
  </div>}
  <div className="zn-biz-grid">
   {data.money&&data.money.bills.length>0&&<section className="zn-card zn-span-2"><h3><CalendarClock size={15}/>Bills due soon</h3>
    <ul className="zn-rows">{data.money.bills.map(b=><li key={b.id}><span><b>{b.title}</b><small>{b.due_on<lagosToday()?'Overdue · ':''}{fmtDay(b.due_on)}</small></span><b>{money(Number(b.amount),b.currency)}</b><Link href="/zarn/business/bills">Pay</Link></li>)}</ul></section>}
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
