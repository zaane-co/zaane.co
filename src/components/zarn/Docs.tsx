'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {FileText,Lock,Plus,Search,Users} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {Avatar,dayOf,timeOf} from './format';
type Row={id:string;title:string;owner_id:string;visibility:'private'|'team';lead_id:string|null;updated_at:string};
// Documents written in ZARN. Listed here are the ones you own and the ones shared with you.
export default function Docs(){
 const {db,me,people,channels,title}=useZarn(),router=useRouter();
 const [rows,setRows]=useState<Row[]|null>(null),[q,setQ]=useState(''),[tab,setTab]=useState<'all'|'mine'|'shared'>('all'),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{const {data}=await db.from('zarn_docs').select('id,title,owner_id,visibility,lead_id,updated_at').order('updated_at',{ascending:false}).limit(300);setRows((data??[]) as Row[]);},[db]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves, not synchronously
 useEffect(()=>{void load();},[load]);
 const shown=useMemo(()=>(rows??[]).filter(r=>(tab==='all'||(tab==='mine'?r.owner_id===me.user_id:r.owner_id!==me.user_id))&&(r.title||'Untitled').toLowerCase().includes(q.toLowerCase())),[rows,tab,q,me.user_id]);
 async function create(){
  setBusy(true);
  const {data,error}=await db.from('zarn_docs').insert({owner_id:me.user_id,title:'Untitled'}).select('id').single();
  setBusy(false);if(error||!data)return;
  router.push(`/zarn/docs/${(data as {id:string}).id}`);
 }
 const clientName=(lead:string|null)=>{const c=channels.find(x=>x.kind==='client'&&x.lead_id===lead);return c?title(c):'';};
 return <div className="zn-page">
  <header className="zn-page-head"><div><h1><FileText size={20}/>Docs</h1><p>Write and share documents with your team, a client or anyone with a link.</p></div><button type="button" className="zn-btn is-primary" disabled={busy} onClick={()=>void create()}><Plus size={14}/>New doc</button></header>
  <div className="zn-tools">
   <label className="zn-tool-search"><Search size={15}/><input placeholder="Search docs" value={q} onChange={e=>setQ(e.target.value)} aria-label="Search docs"/></label>
   <div className="zn-pills" role="tablist" aria-label="Show">{([['all','All'],['mine','Mine'],['shared','Shared with me']] as const).map(([k,l])=><button key={k} type="button" role="tab" aria-selected={tab===k} className={tab===k?'is-on':''} onClick={()=>setTab(k)}>{l}</button>)}</div>
  </div>
  <div className="zn-crm-list" data-lenis-prevent>
   {rows===null?<p className="zn-loading">Loading…</p>:shown.length?shown.map(r=><Link key={r.id} href={`/zarn/docs/${r.id}`} className="zd-row">
    <span className="zd-ico"><FileText size={18}/></span>
    <span className="zd-main"><b>{r.title||'Untitled'}</b><small>{r.owner_id===me.user_id?'You':people[r.owner_id]?.display_name??'Someone'} · {dayOf(r.updated_at)} {timeOf(r.updated_at)}</small></span>
    {r.lead_id&&clientName(r.lead_id)&&<span className="zd-tag">{clientName(r.lead_id)}</span>}
    <span className="zd-tag">{r.visibility==='team'?<><Users size={11}/>Team</>:<><Lock size={11}/>Private</>}</span>
    <Avatar m={people[r.owner_id]} size={24}/>
   </Link>):<div className="zn-empty-state"><h2>{rows.length?'No docs match':'No documents yet'}</h2><p>{rows.length?'Try another search.':'Create one to write notes, briefs or proposals and share them.'}</p></div>}
  </div>
 </div>;
}
