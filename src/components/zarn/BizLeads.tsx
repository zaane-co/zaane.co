'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import {ClipboardList,FileText,Inbox,Mail,Pencil,Phone,Plus,Search,Trash2,UserRound} from 'lucide-react';
import {ago,money,currencies} from '@/lib/crm';
import {stages,stageOf,contactSources,sourceName,type Contact,type StageKey} from '@/lib/biz';
import {blankForm,blankQ,type Form} from '@/lib/form';
import {useZarn} from './ZarnProvider';
import {useConfirm} from './ConfirmProvider';
import {Modal} from './Dialogs';
import {bizApi,sums} from './BizMoney';

const weekAgo=()=>Date.now()-7*864e5;
const OPEN:StageKey[]=['new','contacted','proposal'];
// Business contacts. Leads: everyone we're still talking to. Customers: the ones who said yes. Separate from Clients.
export default function BizLeads({mode}:{mode:'leads'|'customers'}){
 const {db,me}=useZarn(),router=useRouter(),params=useSearchParams(),confirm=useConfirm();
 const [all,setAll]=useState<Contact[]|null>(null),[tab,setTab]=useState<StageKey|'open'>(mode==='leads'?'open':'won'),[q,setQ]=useState(''),[edit,setEdit]=useState<Contact|'new'|null>(null),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const load=useCallback(async()=>{try{const d=await bizApi<{contacts:Contact[]}>({action:'contacts'});setAll(d.contacts);setErr('');}catch(e){setErr((e as Error).message);setAll([]);}},[]);
 useEffect(()=>{void (async()=>{await load();})();},[load]);
 // Opening a lead from a notification (?c=<id>).
 const deep=params.get('c');
 useEffect(()=>{if(!deep||!all)return;const c=all.find(x=>x.id===deep);if(c)queueMicrotask(()=>setEdit(c));},[deep,all]);
 const leads=(all??[]).filter(c=>OPEN.includes(c.stage)),customers=(all??[]).filter(c=>c.stage==='won'),lost=(all??[]).filter(c=>c.stage==='lost');
 const week=weekAgo();
 const list=useMemo(()=>{const t=q.trim().toLowerCase();return (all??[]).filter(c=>(tab==='open'?OPEN.includes(c.stage):c.stage===tab)&&(!t||`${c.name} ${c.email} ${c.company} ${c.phone}`.toLowerCase().includes(t)));},[all,tab,q]);
 const pipeValue:Record<string,number>={};for(const c of leads)if(c.value)pipeValue[c.currency]=(pipeValue[c.currency]??0)+Number(c.value);
 async function move(c:Contact,stage:StageKey){setAll(l=>l?.map(x=>x.id===c.id?{...x,stage}:x)??null);try{await bizApi({action:'contact_stage',id:c.id,stage});}catch(e){setErr((e as Error).message);void load();}}
 async function remove(c:Contact){if(!await confirm({title:`Delete ${c.name}?`,message:'This can’t be undone.',confirm:'Delete',danger:true}))return;try{await bizApi({action:'contact_delete',id:c.id});void load();}catch(e){setErr((e as Error).message);}}
 // A ready-made lead form: the usual questions, open to anyone, adding each answer here as a new lead.
 async function makeForm(){
  setBusy(true);setErr('');
  const mk=(t:Parameters<typeof blankQ>[0],title:string,req=true)=>({...blankQ(t),title,...(req?{req:1 as const}:{})});
  const f:Form={...blankForm(),desc:'Tell us a little about you and what you need. We’ll get back to you within one working day.',
   qs:[mk('short','Name'),mk('short','Email'),mk('short','Company',false),mk('short','Phone or WhatsApp',false),{...mk('radio','What do you need?'),opts:['Website','Branding','App','Marketing','Something else']},mk('para','Tell us about the project')],
   set:{...blankForm().set,open:true,who:'anyone',notify:1,lead:1}};
  const id=crypto.randomUUID();
  const {error}=await db.from('zarn_docs').insert({id,owner_id:me.user_id,title:'Work with us',drive:'my',kind:'form',content:JSON.stringify(f)});
  if(error){setErr('Could not create the form.');setBusy(false);return;}
  router.push(`/zarn/forms/${id}`);
 }
 const tabs:[StageKey|'open',string,number][]=mode==='leads'?[['open','All open',leads.length],['new','New',leads.filter(c=>c.stage==='new').length],['contacted','Contacted',leads.filter(c=>c.stage==='contacted').length],['proposal','Proposal sent',leads.filter(c=>c.stage==='proposal').length],['lost','Lost',lost.length]]:[['won','Customers',customers.length]];
 return <div className="zn-page"><div className="zn-scroll" data-lenis-prevent>
  <header className="zn-page-head zb-head"><div><h1>{mode==='leads'?<><Inbox size={20}/>Leads</>:<><UserRound size={20}/>Customers</>}</h1><p>{mode==='leads'?'Everyone we’re talking to. Move them along until they say yes.':'People and companies who buy from us. Invoice them from here.'}</p></div>
   <div className="zb-acts">{mode==='leads'&&<button type="button" className="zn-btn" disabled={busy} onClick={()=>void makeForm()}><ClipboardList size={15}/>{busy?'Creating…':'New lead form'}</button>}
    <button type="button" className="zn-btn is-primary" onClick={()=>setEdit('new')}><Plus size={15}/>{mode==='leads'?'Add lead':'Add customer'}</button></div></header>
  {err&&<p className="zb-err" role="alert">{err}</p>}
  {mode==='leads'?<div className="zn-crm-stats">
   <div><small>New this week</small><b>{leads.filter(c=>Date.parse(c.created_at)>week).length}</b><span>from every source</span></div>
   <div><small>Waiting on us</small><b>{leads.filter(c=>c.stage==='new').length}</b><span>not contacted yet</span></div>
   <div><small>Open deals</small><b>{sums(pipeValue)}</b><span>{leads.length} open leads</span></div>
   <div><small>Won</small><b className="zb-in">{customers.length}</b><span><Link href="/zarn/business/customers">see customers</Link></span></div>
  </div>:null}
  <section className="zn-card zb-list-card zb-pad">
   <div className="zb-filter">{tabs.length>1&&tabs.map(([k,l,n])=><button key={k} type="button" className={tab===k?'is-on':''} onClick={()=>setTab(k)}>{l} {n>0&&<small>{n}</small>}</button>)}
    <label className="zb-search"><Search size={14}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={mode==='leads'?'Search leads':'Search customers'}/></label></div>
   {all===null?<p className="zn-note">Loading…</p>:!list.length?<p className="zn-note">{q?'Nobody matches.':mode==='leads'?'No leads here yet. Add one, or share a lead form.':'No customers yet. Leads you mark as Customer show up here.'}</p>:
    <ul className="zb-rows">{list.map(c=>{const st=stageOf(c.stage);return <li key={c.id}>
     <span className="zb-avatar" style={{background:st.color}}>{(c.company||c.name).slice(0,1).toUpperCase()}</span>
     <button type="button" className="zb-main zb-plain" onClick={()=>setEdit(c)}><b>{c.name}{c.company?` · ${c.company}`:''}</b><small>{[c.email,c.phone,sourceName[c.source],ago(c.created_at)].filter(Boolean).join(' · ')}</small></button>
     {c.value!=null&&<span className="zb-amt">{money(Number(c.value),c.currency)}</span>}
     <select className="zb-stage" value={c.stage} style={{background:st.color}} onChange={e=>void move(c,e.target.value as StageKey)} aria-label={`Stage for ${c.name}`}>{stages.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select>
     <span className="zb-row-acts">
      {c.stage==='won'&&<Link className="zb-ic" href={`/zarn/business/invoices/new?c=${c.id}`} aria-label={`Invoice ${c.name}`} data-tip="New invoice"><FileText size={15}/></Link>}
      {c.email&&<a className="zb-ic" href={`mailto:${c.email}`} aria-label={`Email ${c.name}`} data-tip="Email"><Mail size={15}/></a>}
      {c.phone&&<a className="zb-ic" href={`tel:${c.phone}`} aria-label={`Call ${c.name}`} data-tip="Call"><Phone size={15}/></a>}
      <button type="button" className="zb-ic" aria-label="Edit" data-tip="Edit" onClick={()=>setEdit(c)}><Pencil size={15}/></button>
      <button type="button" className="zb-ic" aria-label="Delete" data-tip="Delete" onClick={()=>void remove(c)}><Trash2 size={15}/></button>
     </span></li>;})}</ul>}
  </section>
  {edit&&<ContactDialog contact={edit==='new'?null:edit} won={mode==='customers'} onClose={()=>{setEdit(null);if(deep)router.replace(mode==='leads'?'/zarn/business/leads':'/zarn/business/customers');}} onDone={()=>{setEdit(null);void load();}}/>}
 </div></div>;
}

function ContactDialog({contact,won,onClose,onDone}:{contact:Contact|null;won:boolean;onClose:()=>void;onDone:()=>void}){
 const [v,setV]=useState({name:contact?.name??'',email:contact?.email??'',company:contact?.company??'',phone:contact?.phone??'',stage:(contact?.stage??(won?'won':'new')) as StageKey,source:contact?.source??'manual',value:contact?.value!=null?String(contact.value):'',currency:contact?.currency??'NGN',note:contact?.note??''});
 const [busy,setBusy]=useState(false),[err,setErr]=useState('');
 const f=(k:keyof typeof v)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setV(x=>({...x,[k]:e.target.value}));
 async function save(e:React.FormEvent){e.preventDefault();setErr('');setBusy(true);
  const value=v.value.trim()?Number(v.value.replace(/,/g,'')):null;
  try{await bizApi({action:'contact_save',...(contact?{id:contact.id}:{}),...v,value:value!=null&&value>=0?value:null});onDone();}catch(x){setErr((x as Error).message);setBusy(false);}}
 return <Modal title={contact?contact.name:won?'Add a customer':'Add a lead'} onClose={onClose}><form className="zn-modal-body" onSubmit={save}>
  <div className="zn-form-row"><label className="zn-label">Name<input className="zn-input" value={v.name} maxLength={160} onChange={f('name')} autoFocus={!contact}/></label>
   <label className="zn-label">Company <small>optional</small><input className="zn-input" value={v.company} maxLength={200} onChange={f('company')}/></label></div>
  <div className="zn-form-row"><label className="zn-label">Email<input className="zn-input" type="email" value={v.email} maxLength={254} onChange={f('email')}/></label>
   <label className="zn-label">Phone<input className="zn-input" value={v.phone} maxLength={40} onChange={f('phone')}/></label></div>
  <div className="zn-form-row"><label className="zn-label">Stage<select className="zn-input" value={v.stage} onChange={f('stage')}>{stages.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
   <label className="zn-label">Came from<select className="zn-input" value={v.source} onChange={f('source')}>{contactSources.map(s=><option key={s} value={s}>{sourceName[s]}</option>)}</select></label></div>
  <div className="zn-form-row"><label className="zn-label">Deal value <small>optional</small><input className="zn-input" inputMode="decimal" value={v.value} onChange={f('value')} placeholder="0"/></label>
   <label className="zn-label">Currency<select className="zn-input" value={v.currency} onChange={f('currency')}>{currencies.map(c=><option key={c}>{c}</option>)}</select></label></div>
  <label className="zn-label">Notes<textarea className="zn-input zb-area" value={v.note} maxLength={5000} onChange={f('note')} placeholder="What they need, what was said, next step"/></label>
  {err&&<p className="zb-err" role="alert">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="submit" className="zn-btn is-primary" disabled={busy}>{busy?'Saving…':'Save'}</button></div>
 </form></Modal>;
}
