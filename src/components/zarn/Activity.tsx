'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Bell,CircleCheck,Handshake,HeartCrack,UserPlus} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {Avatar,dayOf,timeOf} from './format';
import {money} from '@/lib/crm';

type Kind='member_joined'|'client_won'|'client_lost'|'project_completed';
type Ev={id:string;kind:Kind;lead_id:string|null;user_id:string|null;title:string;detail:string;meta:{deal_value?:number|null;currency?:string};created_at:string};
type Filter='all'|'people'|'projects'|'clients';
const SEEN='zarn:activity-seen';
const tone:Record<Kind,string>={member_joined:'#0891b2',client_won:'#16a34a',client_lost:'#71717a',project_completed:'#7c3aed'};
const filters:{k:Filter;label:string;match:(e:Ev)=>boolean}[]=[
 {k:'all',label:'All',match:()=>true},
 {k:'people',label:'New users',match:e=>e.kind==='member_joined'},
 {k:'projects',label:'Completed projects',match:e=>e.kind==='project_completed'},
 {k:'clients',label:'Closed clients',match:e=>e.kind==='client_won'||e.kind==='client_lost'},
];

// Company news: people who joined, projects completed and clients closed. Mentions have their own page.
export default function Activity(){
 const {db,people,me}=useZarn(),admin=me.zarnAdmin;
 const [events,setEvents]=useState<Ev[]>([]),[loading,setLoading]=useState(true),[filter,setFilter]=useState<Filter>('all'),[seen]=useState(()=>{try{return Number(localStorage.getItem(SEEN))||0;}catch{return 0;}});
 useEffect(()=>{let live=true;void (async()=>{
  const {data}=await db.from('zarn_events').select('id,kind,lead_id,user_id,title,detail,meta,created_at').order('created_at',{ascending:false}).limit(200);
  if(!live)return;setEvents((data??[]) as Ev[]);setLoading(false);
  try{localStorage.setItem(SEEN,String(Date.now()));}catch{/* private mode */}
 })();return()=>{live=false;};},[db]);
 const active=filters.find(f=>f.k===filter)!,shown=events.filter(active.match);
 const text=(e:Ev)=>e.kind==='member_joined'?<><b>{e.title}</b> joined the team{e.detail?<span className="zn-in"> · {e.detail}</span>:null}</>
  :e.kind==='client_won'?<><b>{e.title}</b> closed as a client{admin&&e.meta.deal_value?<span className="zn-in"> · {money(e.meta.deal_value,e.meta.currency??'NGN')}</span>:null}</>
  :e.kind==='client_lost'?<><b>{e.title}</b> <span className="zn-in">was closed as lost</span></>
  :<>Project completed for <b>{e.title}</b>{e.detail?<span className="zn-in"> · {e.detail}</span>:null}</>;
 const icon=(k:Kind)=>k==='member_joined'?<UserPlus size={16}/>:k==='client_won'?<Handshake size={16}/>:k==='client_lost'?<HeartCrack size={16}/>:<CircleCheck size={16}/>;
 // Grouped by day, newest first.
 const days:[string,Ev[]][]=[];for(const e of shown){const d=dayOf(e.created_at),last=days[days.length-1];if(last&&last[0]===d)last[1].push(e);else days.push([d,[e]]);}
 const label:Record<Kind,string>={member_joined:'New member',client_won:'Client won',client_lost:'Client lost',project_completed:'Project completed'};
 return <div className="zn-page">
  <header className="zn-page-head"><div><h1><Bell size={20}/>Activity</h1><p>New users, completed projects and closed clients.</p></div></header>
  <div className="zn-act-tabs" role="tablist" aria-label="Activity type">{filters.map(f=>{const n=events.filter(f.match).length;return <button key={f.k} type="button" role="tab" aria-selected={filter===f.k} className={filter===f.k?'is-on':''} onClick={()=>setFilter(f.k)}>{f.label}{n>0&&<em>{n}</em>}</button>;})}</div>
  <div className="zn-act" data-lenis-prevent>
   {loading?<p className="zn-loading">Loading…</p>:shown.length?days.map(([d,list])=><section key={d}>
    <h2 className="zn-act-day">{d}</h2>
    <div className="zn-act-list">{list.map(e=>{
     const who=e.kind==='member_joined'&&e.user_id?people[e.user_id]:undefined,unread=new Date(e.created_at).getTime()>seen;
     const row=<>
      <span className="zn-act-ico">{who?<Avatar m={who} size={36}/>:<span className="zn-act-glyph" style={{background:tone[e.kind]}}>{icon(e.kind)}</span>}{who&&<i style={{background:tone[e.kind]}}>{icon(e.kind)}</i>}</span>
      <span className="zn-act-main"><span className="zn-act-text">{text(e)}</span><small>{label[e.kind]}</small></span>
      <time>{timeOf(e.created_at)}</time>{unread&&<span className="zn-act-dot" aria-label="New"/>}</>;
     const cls=`zn-act-row${unread?' is-unread':''}`;
     return e.lead_id&&e.kind!=='member_joined'?<Link key={e.id} href={`/zarn/clients/${e.lead_id}`} className={cls}>{row}</Link>:<div key={e.id} className={cls}>{row}</div>;})}</div>
   </section>)
   :<div className="zn-empty-state"><h2>Nothing yet</h2><p>When someone joins, a project is completed or a client is closed, it shows up here.</p></div>}
  </div>
 </div>;
}
