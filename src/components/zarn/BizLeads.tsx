'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ClipboardList,Globe,Inbox,Mail,Phone,Plus,Search} from 'lucide-react';
import {ago} from '@/lib/crm';
import {blankForm,blankQ,type Form} from '@/lib/form';
import {useZarn} from './ZarnProvider';
import {bizApi} from './BizMoney';

const weekAgo=()=>Date.now()-7*864e5;
type Lead={id:string;name:string;email:string;company:string;phone:string;source:string;status:string;message:string;service_interested:string;created_at:string};
// Lead capture: everyone who reached out, from the website or a lead form, newest first.
export default function BizLeads({stages}:{stages:Record<string,{label:string;color:string}>}){
 const {db,me}=useZarn(),router=useRouter();
 const [leads,setLeads]=useState<Lead[]|null>(null),[src,setSrc]=useState('all'),[q,setQ]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 useEffect(()=>{void bizApi<{leads:Lead[]}>({action:'leads'}).then(d=>setLeads(d.leads)).catch(e=>{setErr((e as Error).message);setLeads([]);});},[]);
 const sources=useMemo(()=>[...new Set((leads??[]).map(l=>l.source||'other'))],[leads]);
 const week=weekAgo();
 const list=(leads??[]).filter(l=>(src==='all'||(l.source||'other')===src)&&(!q.trim()||`${l.name} ${l.email} ${l.company}`.toLowerCase().includes(q.trim().toLowerCase())));
 // A ready-made lead form: the usual questions, open to anyone, sending answers to the Pipeline.
 async function makeForm(){
  setBusy(true);setErr('');
  const q=(t:Parameters<typeof blankQ>[0],title:string,req=true)=>({...blankQ(t),title,...(req?{req:1 as const}:{})});
  const f:Form={...blankForm(),desc:'Tell us a little about you and what you need. We’ll get back to you within one working day.',
   qs:[q('short','Name'),q('short','Email'),q('short','Company',false),q('short','Phone or WhatsApp',false),{...q('radio','What do you need?'),opts:['Website','Branding','App','Marketing','Something else']},q('para','Tell us about the project')],
   set:{...blankForm().set,open:true,who:'anyone',notify:1,lead:1}};
  const id=crypto.randomUUID();
  const {error}=await db.from('zarn_docs').insert({id,owner_id:me.user_id,title:'Work with us',drive:'my',kind:'form',content:JSON.stringify(f)});
  if(error){setErr('Could not create the form.');setBusy(false);return;}
  router.push(`/zarn/forms/${id}`);
 }
 return <div className="zn-page"><div className="zn-scroll" data-lenis-prevent>
  <header className="zn-page-head zb-head"><div><h1><Inbox size={20}/>Leads</h1><p>Everyone who reached out. Open one to move it through the Pipeline.</p></div>
   <div className="zb-acts"><Link href="/zarn/crm" className="zn-btn">Open Pipeline</Link><button type="button" className="zn-btn is-primary" disabled={busy} onClick={()=>void makeForm()}><Plus size={15}/>{busy?'Creating…':'New lead form'}</button></div></header>
  {err&&<p className="zb-err" role="alert">{err}</p>}
  <div className="zn-crm-stats">
   <div><small>New this week</small><b>{(leads??[]).filter(l=>Date.parse(l.created_at)>week).length}</b><span>all sources</span></div>
   <div><small>Still new</small><b>{(leads??[]).filter(l=>l.status==='new').length}</b><span>not contacted yet</span></div>
   <div><small>From the website</small><b>{(leads??[]).filter(l=>l.source==='website').length}</b><span>contact page and lead forms</span></div>
  </div>
  <div className="zb-grid">
   <section className="zn-card zb-list-card">
    <div className="zb-filter"><button type="button" className={src==='all'?'is-on':''} onClick={()=>setSrc('all')}>All</button>{sources.map(s=><button key={s} type="button" className={src===s?'is-on':''} onClick={()=>setSrc(s)}>{s[0].toUpperCase()+s.slice(1)}</button>)}
     <label className="zb-search"><Search size={14}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search leads"/></label></div>
    {leads===null?<p className="zn-note">Loading…</p>:!list.length?<p className="zn-note">No leads yet.</p>:
     <ul className="zb-rows">{list.map(l=>{const st=stages[l.status];return <li key={l.id} className="is-link"><Link href={`/zarn/crm?lead=${l.id}`} className="zb-rowlink">
      <span className="zb-main"><b>{l.name||l.email}{l.company?` · ${l.company}`:''}</b><small>{[l.service_interested,l.message].filter(Boolean).join(' · ').slice(0,140)||l.email}</small></span>
      <span className="zb-lead-meta">{st&&<span className="zb-badge" style={{background:st.color}}>{st.label}</span>}<small>{l.source} · {ago(l.created_at)}</small></span></Link>
      <span className="zb-row-acts">{l.email&&<a className="zb-ic" href={`mailto:${l.email}`} aria-label={`Email ${l.name}`} data-tip="Email"><Mail size={15}/></a>}{l.phone&&<a className="zb-ic" href={`tel:${l.phone}`} aria-label={`Call ${l.name}`} data-tip="Call"><Phone size={15}/></a>}</span></li>;})}</ul>}
   </section>
   <section className="zn-card"><h3>Where leads come from</h3>
    <div className="zb-src"><Globe size={18}/><span><b>Website contact page</b><small>Project and partnership enquiries land here on their own.</small></span></div>
    <div className="zb-src"><ClipboardList size={18}/><span><b>Lead forms</b><small>Any form with “Send answers to the Pipeline” switched on. Share the link anywhere: bio, ads, WhatsApp.</small></span></div>
    <button type="button" className="zn-btn" disabled={busy} onClick={()=>void makeForm()}><Plus size={15}/>Make a lead form</button>
   </section>
  </div>
 </div></div>;
}
