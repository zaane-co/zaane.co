'use client';
import Link from 'next/link';
import {CalendarClock,FileText,Inbox,TrendingUp} from 'lucide-react';
import {money,ago} from '@/lib/crm';
import {sumBy,stageOf} from '@/lib/biz';
import {fmtDay} from '@/lib/zarn-care';
import {useZarn} from './ZarnProvider';
import {sums} from './BizMoney';

type Amt={amount:number;currency:string};
export type Overview={today:string;weekAgo:string;in:Amt[];out:Amt[];owed:(Amt&{id:string;number:string;who:string;due:string})[];bills:{id:string;title:string;amount:number;currency:string;due_on:string}[];leads:{id:string;name:string;stage:string;created_at:string}[]};
// Business home inside ZARN: this month's money, what's owed, new leads and bills coming up.
export default function BusinessOverview({data}:{data:Overview}){
 const {me}=useZarn();
 const net:Record<string,number>={},ins=sumBy(data.in),outs=sumBy(data.out);for(const c of new Set([...Object.keys(ins),...Object.keys(outs)]))net[c]=(ins[c]??0)-(outs[c]??0);
 const late=data.owed.filter(o=>o.due<data.today),fresh=data.leads.filter(l=>l.created_at>data.weekAgo);
 return <div className="zn-page"><div className="zn-scroll" data-lenis-prevent>
  <header className="zn-page-head"><div><h1><TrendingUp size={20}/>Business</h1><p>Hi {me.display_name.split(' ')[0]}, here’s how the business is doing this month.</p></div></header>
  <div className="zn-crm-stats">
   <div><small>Money in</small><b className="zb-in">{sums(ins)}</b><span><Link href="/zarn/business/money">this month</Link></span></div>
   <div><small>Money out</small><b className="zb-out">{sums(outs)}</b><span>{data.out.length} expenses</span></div>
   <div><small>Net</small><b>{sums(net)}</b><span>this month</span></div>
   <div><small>Owed to us</small><b>{sums(sumBy(data.owed))}</b><span><Link href="/zarn/business/invoices">{late.length} overdue</Link></span></div>
  </div>
  <div className="zn-biz-grid">
   <section className="zn-card"><h3><Inbox size={15}/>Leads <small className="zn-muted">{fresh.length} new this week</small></h3>
    {data.leads.length?<ul className="zn-rows">{data.leads.slice(0,6).map(l=>{const s=stageOf(l.stage);return <li key={l.id}><span className="zn-stage-dot" style={{background:s.color}}/><span><b>{l.name}</b><small>{s.label} · {ago(l.created_at)}</small></span><Link href={`/zarn/business/leads?c=${l.id}`}>Open</Link></li>;})}</ul>:<p className="zn-note">No open leads. <Link className="zn-link" href="/zarn/business/leads">Add one or make a lead form</Link></p>}</section>
   <section className="zn-card"><h3><FileText size={15}/>Waiting to be paid</h3>
    {data.owed.length?<ul className="zn-rows">{data.owed.slice(0,6).map(o=><li key={o.id}><span><b>{o.who||o.number}</b><small>{o.number} · {o.due<data.today?'overdue since ':'due '}{fmtDay(o.due)}</small></span><b>{money(o.amount,o.currency)}</b><Link href={`/zarn/business/invoices/${o.id}`}>Open</Link></li>)}</ul>:<p className="zn-note">Nothing owed right now.</p>}</section>
   <section className="zn-card zn-span-2"><h3><CalendarClock size={15}/>Bills due soon</h3>
    {data.bills.length?<ul className="zn-rows">{data.bills.map(b=><li key={b.id}><span><b>{b.title}</b><small>{b.due_on<data.today?'Overdue · ':''}{fmtDay(b.due_on)}</small></span><b>{money(Number(b.amount),b.currency)}</b><Link href="/zarn/business/bills">Pay</Link></li>)}</ul>:<p className="zn-note">No bills due in the next 7 days.</p>}</section>
  </div>
 </div></div>;
}
