'use client';
import {useEffect,useMemo,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {Briefcase,Search,Send,X} from 'lucide-react';
import {money} from '@/lib/crm';
import {zarnApi,type ZLead} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {LeadCard} from './Message';

// Read-only CRM for the whole team: pipeline summary from the zarn_leads view, share a lead into any channel.
export default function CrmPanel(){
 const {db,channels,membership,me,title,loadLead,reload}=useZarn(),router=useRouter(),params=useSearchParams();
 const [rows,setRows]=useState<ZLead[]>([]),[q,setQ]=useState(''),[stage,setStage]=useState('all'),[loading,setLoading]=useState(true);
 const [open,setOpen]=useState<string|null>(params.get('lead')),[sharing,setSharing]=useState(false),[target,setTarget]=useState(''),[note,setNote]=useState(''),[flash,setFlash]=useState('');
 useEffect(()=>{void db.from('zarn_leads').select('*').order('last_activity_at',{ascending:false}).limit(1000).then(({data}:{data:unknown})=>{setRows((data??[]) as ZLead[]);setLoading(false);});},[db]);
 useEffect(()=>{if(open)loadLead(open);},[open,loadLead]);
 const stages=useMemo(()=>{const m=new Map<string,{label:string;color:string;kind:string;n:number}>();for(const r of rows){const k=r.status;const s=m.get(k)??{label:r.stage_label??k,color:r.stage_color??'#52525b',kind:r.stage_kind??'open',n:0};s.n++;m.set(k,s);}return [...m.entries()];},[rows]);
 const shown=rows.filter(r=>(stage==='all'||r.status===stage)&&(!q||`${r.name} ${r.company} ${r.categories.join(' ')} ${r.owner_name??''}`.toLowerCase().includes(q.toLowerCase())));
 const openTotals=useMemo(()=>{const m:Record<string,number>={};for(const r of rows)if(r.stage_kind==='open'&&r.deal_value)m[r.currency]=(m[r.currency]??0)+Number(r.deal_value);return Object.entries(m).map(([c,v])=>money(v,c)).join(' · ')||'-';},[rows]);
 const staff=me.staffRole&&['super_admin','admin','sales'].includes(me.staffRole);
 if(!me.can_view_crm)return <div className="zn-empty-state"><h2>No CRM access</h2><p>Ask a ZARN admin to turn on CRM access for your account.</p></div>;
 const targets=channels.filter(c=>membership[c.id]&&!c.archived_at&&c.kind!=='client');
 async function share(){
  if(!open||!target)return;
  const {error}=await db.from('zarn_messages').insert({channel_id:target,user_id:me.user_id,body:note.trim(),lead_id:open});
  if(error){setFlash('Could not share it.');return;}
  setSharing(false);setNote('');router.push(`/zarn/c/${target}`);
 }
 return <div className="zn-page">
  <header className="zn-page-head"><div><h1><Briefcase size={20}/>CRM</h1><p>The studio pipeline, live from the CRM. {staff?'Edit deals in the admin.':'Read-only for the team.'}</p></div>
   {staff&&<a className="zn-btn" href="/admin/leads" target="_blank" rel="noopener noreferrer">Open CRM admin</a>}</header>
  <div className="zn-crm-stats"><div><small>Open pipeline</small><b>{openTotals}</b></div><div><small>Leads</small><b>{rows.length}</b></div><div><small>Won</small><b>{rows.filter(r=>r.stage_kind==='won').length}</b></div></div>
  <div className="zn-crm-bar">
   <span className="zn-prefix"><Search size={15}/><input className="zn-input" placeholder="Search leads, companies, owners" value={q} onChange={e=>setQ(e.target.value)}/></span>
   <div className="zn-stage-filter"><button type="button" className={stage==='all'?'is-on':''} onClick={()=>setStage('all')}>All <span>{rows.length}</span></button>{stages.map(([k,s])=><button key={k} type="button" className={stage===k?'is-on':''} onClick={()=>setStage(k)}><i style={{background:s.color}}/>{s.label} <span>{s.n}</span></button>)}</div>
  </div>
  {flash&&<p className="zn-note">{flash}</p>}
  <div className="zn-crm-list" data-lenis-prevent>
   {loading?<p className="zn-loading">Loading…</p>:shown.length?shown.map(l=><button key={l.id} type="button" className={`zn-crm-row${open===l.id?' is-on':''}`} onClick={()=>setOpen(l.id)}>
    <span className="zn-stage-dot" style={{background:l.stage_color??'#52525b'}}/><span className="zn-crm-name"><b>{l.name}</b><small>{l.company||l.service_interested||'No company'}</small></span>
    <span className="zn-stage" style={{background:l.stage_color??'#52525b'}}>{l.stage_label??l.status}</span><span className="zn-crm-val">{l.deal_value!=null?money(Number(l.deal_value),l.currency):''}</span><span className="zn-crm-owner">{l.owner_name??''}</span>
   </button>):<p className="zn-empty-row">No leads match.</p>}
  </div>
  {open&&<aside className="zn-drawer"><header><h2>Lead</h2><button type="button" aria-label="Close" onClick={()=>setOpen(null)}><X size={18}/></button></header>
   <div className="zn-drawer-body"><LeadCard id={open}/>
    {sharing?<div className="zn-share"><label className="zn-label">Share to<select className="zn-input" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose a channel or DM…</option>{targets.map(c=><option key={c.id} value={c.id}>{c.kind==='dm'?title(c):`#${c.name}`}</option>)}</select></label>
     <label className="zn-label">Message (optional)<textarea className="zn-input" rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>
     <div className="zn-row"><button type="button" className="zn-btn" onClick={()=>setSharing(false)}>Cancel</button><button type="button" className="zn-btn is-primary" disabled={!target} onClick={()=>void share()}><Send size={14}/>Share</button></div></div>
    :<div className="zn-row"><button type="button" className="zn-btn is-primary" onClick={()=>setSharing(true)}><Send size={14}/>Share in a channel</button>
     {me.account_type!=='guest'&&<button type="button" className="zn-btn" onClick={async()=>{try{const r=await zarnApi<{lead_id:string}>('/api/zarn/clients',{action:'open',lead_id:open});await reload();router.push(`/zarn/clients/${r.lead_id}`);}catch(e){setFlash(e instanceof Error?e.message:'Could not open the client space.');}}}><Briefcase size={14}/>Open client space</button>}</div>}
   </div></aside>}
 </div>;
}
