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
 const {db,people}=useZarn();
 const [events,setEvents]=useState<Ev[]>([]),[loading,setLoading]=useState(true),[filter,setFilter]=useState<Filter>('all'),[seen]=useState(()=>{try{return Number(localStorage.getItem(SEEN))||0;}catch{return 0;}});
 useEffect(()=>{let live=true;void (async()=>{
  const {data}=await db.from('zarn_events').select('id,kind,lead_id,user_id,title,detail,meta,created_at').order('created_at',{ascending:false}).limit(200);
  if(!live)return;setEvents((data??[]) as Ev[]);setLoading(false);
  try{localStorage.setItem(SEEN,String(Date.now()));}catch{/* private mode */}
 })();return()=>{live=false;};},[db]);
 const active=filters.find(f=>f.k===filter)!,shown=events.filter(active.match);
 const text=(e:Ev)=>e.kind==='member_joined'?<><b>{e.title}</b> joined the team{e.detail?<span className="zn-in"> · {e.detail}</span>:null}</>
  :e.kind==='client_won'?<><b>{e.title}</b> closed as a client{e.meta.deal_value?<span className="zn-in"> · {money(e.meta.deal_value,e.meta.currency??'NGN')}</span>:null}</>
  :e.kind==='client_lost'?<><b>{e.title}</b> <span className="zn-in">was closed as lost</span></>
  :<>Project completed for <b>{e.title}</b>{e.detail?<span className="zn-in"> · {e.detail}</span>:null}</>;
 const icon=(k:Kind)=>k==='member_joined'?<UserPlus size={16}/>:k==='client_won'?<Handshake size={16}/>:k==='client_lost'?<HeartCrack size={16}/>:<CircleCheck size={16}/>;
 return <div className="zn-page">
  <header className="zn-page-head"><div><h1><Bell size={20}/>Activity</h1><p>New users, completed projects and closed clients.</p></div></header>
  <div className="zn-tools"><div className="zn-pills" role="tablist" aria-label="Activity type">{filters.map(f=><button key={f.k} type="button" role="tab" aria-selected={filter===f.k} className={filter===f.k?'is-on':''} onClick={()=>setFilter(f.k)}>{f.label} <span>{events.filter(f.match).length}</span></button>)}</div></div>
  <div className="zn-crm-list" data-lenis-prevent>
   {loading?<p className="zn-loading">Loading…</p>:shown.length?shown.map(e=>{
    const row=<><span className="zn-ev-icon" style={{background:tone[e.kind]}}>{e.kind==='member_joined'&&e.user_id&&people[e.user_id]?<Avatar m={people[e.user_id]} size={34}/>:icon(e.kind)}</span>
     <div><p className="zn-ev-text">{text(e)}</p><time>{dayOf(e.created_at)} {timeOf(e.created_at)}</time></div></>;
    const cls=`zn-mention-row zn-ev${new Date(e.created_at).getTime()>seen?' is-unread':''}`;
    return e.lead_id&&e.kind!=='member_joined'?<Link key={e.id} href={`/zarn/clients/${e.lead_id}`} className={cls}>{row}</Link>:<div key={e.id} className={cls}>{row}</div>;})
   :<div className="zn-empty-state"><h2>Nothing yet</h2><p>When someone joins, a project is completed or a client is closed, it shows up here.</p></div>}
  </div>
 </div>;
}
