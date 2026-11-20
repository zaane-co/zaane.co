'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import {Archive,ArchiveRestore,Building2,ClipboardList,FileSpreadsheet,FileText,Mail,Phone,Plus,Search,Trash2,Upload,UserRound,Users} from 'lucide-react';
import {ago} from '@/lib/crm';
import {contactSources,sourceName,importFields,sumBy,type Company,type Contact,type DealStage} from '@/lib/biz';
import {fmtDay} from '@/lib/zarn-care';
import {blankForm,blankQ,type Form} from '@/lib/form';
import {useZarn} from './ZarnProvider';
import {useConfirm} from './ConfirmProvider';
import {Modal} from './Dialogs';
import {bizApi,sums} from './BizMoney';

type DealLite={id:string;contact_id:string|null;company_id:string|null;stage:DealStage;value:number|null;currency:string};
type Data={contacts:Contact[];companies:Company[];deals:DealLite[]};
// Everything the lead pages need, loaded once and reloaded after each change.
function useCrm(){
 const [d,setD]=useState<Data|null>(null),[err,setErr]=useState('');
 const load=useCallback(async()=>{try{setD(await bizApi<Data>({action:'contacts'}));setErr('');}catch(e){setErr((e as Error).message);setD({contacts:[],companies:[],deals:[]});}},[]);
 useEffect(()=>{void (async()=>{await load();})();},[load]);
 return {d,err,setErr,load};
}
const initial=(s:string)=>(s.trim()[0]??'?').toUpperCase();
const hue=(s:string)=>['#2563eb','#7c3aed','#0891b2','#d97706','#16a34a','#db2777','#4f46e5','#0d9488'][[...s].reduce((a,c)=>a+c.charCodeAt(0),0)%8];
const Empty=({icon,title,body,children}:{icon:React.ReactNode;title:string;body:string;children?:React.ReactNode})=><div className="zb-empty-in">{icon}<b>{title}</b><p className="zn-note">{body}</p>{children}</div>;

// Contacts: every person, added by hand, from a lead form or imported from a sheet.
export function BizContacts(){
 const {db,me}=useZarn(),router=useRouter(),params=useSearchParams(),confirm=useConfirm();
 const {d,err,setErr,load}=useCrm();
 const [f,setF]=useState<'all'|'leads'|'customers'>('all'),[q,setQ]=useState(''),[edit,setEdit]=useState<Contact|'new'|null>(null),[imp,setImp]=useState(false),[busy,setBusy]=useState(false);
 const deep=params.get('c');
 useEffect(()=>{if(!deep||!d)return;const c=d.contacts.find(x=>x.id===deep);if(c)queueMicrotask(()=>setEdit(c));},[deep,d]);
 const list=useMemo(()=>{const t=q.trim().toLowerCase();return (d?.contacts??[]).filter(c=>(f==='all'||(f==='customers'?c.customer:!c.customer))&&(!t||`${c.name} ${c.email} ${c.company} ${c.phone} ${c.tags.join(' ')}`.toLowerCase().includes(t)));},[d,f,q]);
 async function remove(c:Contact){if(!await confirm({title:`Delete ${c.name}?`,message:'Their deals stay on the board without a contact.',confirm:'Delete',danger:true}))return;try{await bizApi({action:'contact_delete',id:c.id});void load();}catch(e){setErr((e as Error).message);}}
 // A ready-made lead form: the usual questions, open to anyone, adding each answer here as a contact with a new deal.
 async function makeForm(){
  setBusy(true);setErr('');
  const mk=(t:Parameters<typeof blankQ>[0],title:string,req=true)=>({...blankQ(t),title,...(req?{req:1 as const}:{})});
  const fm:Form={...blankForm(),desc:'Tell us a little about you and what you need. We’ll get back to you within one working day.',
   qs:[mk('short','Name'),mk('short','Email'),mk('short','Company',false),mk('short','Phone or WhatsApp',false),{...mk('radio','What do you need?'),opts:['Website','Branding','App','Marketing','Something else']},mk('para','Tell us about the project')],
   set:{...blankForm().set,open:true,who:'anyone',notify:1,lead:1}};
  const id=crypto.randomUUID();
  const {error}=await db.from('zarn_docs').insert({id,owner_id:me.user_id,title:'Work with us',drive:'my',kind:'form',content:JSON.stringify(fm)});
  if(error){setErr('Could not create the form.');setBusy(false);return;}
  router.push(`/zarn/forms/${id}`);
 }
 const n=(k:typeof f)=>(d?.contacts??[]).filter(c=>k==='all'||(k==='customers'?c.customer:!c.customer)).length;
 return <div className="zn-page"><div className="zn-scroll" data-lenis-prevent>
  <header className="zn-page-head zb-head"><div><h1><Users size={20}/>Contacts</h1><p>Everyone we know. Add them by hand, import a sheet, or let a lead form fill this in.</p></div>
   <div className="zb-acts"><button type="button" className="zn-btn" disabled={busy} onClick={()=>void makeForm()}><ClipboardList size={15}/>{busy?'Creating…':'Lead form'}</button>
    <button type="button" className="zn-btn" onClick={()=>setImp(true)}><Upload size={15}/>Import sheet</button>
    <button type="button" className="zn-btn is-primary" onClick={()=>setEdit('new')}><Plus size={15}/>Add contact</button></div></header>
  {err&&<p className="zb-err" role="alert">{err}</p>}
  <section className="zn-card zb-list-card zb-pad">
   <div className="zb-filter">{([['all','All'],['leads','Leads'],['customers','Customers']] as const).map(([k,l])=><button key={k} type="button" className={f===k?'is-on':''} onClick={()=>setF(k)}>{l} <small>{n(k)}</small></button>)}
    <label className="zb-search"><Search size={14}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, email, company, tag"/></label></div>
   {d===null?<p className="zn-note">Loading…</p>:!list.length?(q?<p className="zn-note">Nobody matches.</p>:<Empty icon={<Users size={22}/>} title="No contacts yet" body="Add someone, import a sheet from Excel or Google Sheets, or share a lead form."><div className="zb-acts"><button type="button" className="zn-btn" onClick={()=>setImp(true)}><Upload size={15}/>Import sheet</button><button type="button" className="zn-btn is-primary" onClick={()=>setEdit('new')}><Plus size={15}/>Add contact</button></div></Empty>):
    <ul className="zb-rows">{list.map(c=><li key={c.id}>
     <span className="zb-avatar" style={{background:hue(c.name)}}>{initial(c.name)}</span>
     <button type="button" className="zb-main zb-plain" onClick={()=>setEdit(c)}><b>{c.name}{c.job_title?<span className="zb-sub"> · {c.job_title}</span>:null}</b><small>{[c.company,c.email,c.phone,sourceName[c.source],ago(c.created_at)].filter(Boolean).join(' · ')}</small></button>
     {c.tags.length>0&&<span className="zb-tags">{c.tags.slice(0,3).map(t=><i key={t}>{t}</i>)}</span>}
     {c.customer&&<span className="zb-badge" style={{background:c.archived_at?'#52525b':'#16a34a'}}>{c.archived_at?'Archived':'Customer'}</span>}
     <span className="zb-row-acts">
      {c.email&&<a className="zb-ic" href={`mailto:${c.email}`} aria-label={`Email ${c.name}`} data-tip="Email"><Mail size={15}/></a>}
      {c.phone&&<a className="zb-ic" href={`tel:${c.phone}`} aria-label={`Call ${c.name}`} data-tip="Call"><Phone size={15}/></a>}
      <button type="button" className="zb-ic" aria-label="Delete" data-tip="Delete" onClick={()=>void remove(c)}><Trash2 size={15}/></button>
     </span></li>)}</ul>}
  </section>
  {edit&&<ContactDialog contact={edit==='new'?null:edit} companies={d?.companies??[]} onClose={()=>{setEdit(null);if(deep)router.replace('/zarn/business/contacts');}} onDone={()=>{setEdit(null);void load();}}/>}
  {imp&&<ImportDialog onClose={()=>setImp(false)} onDone={()=>void load()}/>}
 </div></div>;
}

// Companies: made automatically from the company name on a contact, or added here.
export function BizCompanies(){
 const confirm=useConfirm();
 const {d,err,setErr,load}=useCrm();
 const [q,setQ]=useState(''),[edit,setEdit]=useState<Company|'new'|null>(null),[contact,setContact]=useState<Contact|null>(null);
 const rows=useMemo(()=>{const t=q.trim().toLowerCase();return (d?.companies??[]).filter(c=>!t||`${c.name} ${c.industry} ${c.website}`.toLowerCase().includes(t)).map(c=>{
  const people=(d?.contacts??[]).filter(x=>x.company_id===c.id),deals=(d?.deals??[]).filter(x=>x.company_id===c.id&&x.stage!=='won'&&x.stage!=='lost');
  return {...c,people,open:sumBy(deals.filter(x=>x.value).map(x=>({amount:Number(x.value),currency:x.currency}))),openN:deals.length,customer:people.some(p=>p.customer&&!p.archived_at)};});},[d,q]);
 async function remove(c:Company){if(!await confirm({title:`Delete ${c.name}?`,message:'Its contacts stay, without a company.',confirm:'Delete',danger:true}))return;try{await bizApi({action:'company_delete',id:c.id});void load();}catch(e){setErr((e as Error).message);}}
 return <div className="zn-page"><div className="zn-scroll" data-lenis-prevent>
  <header className="zn-page-head zb-head"><div><h1><Building2 size={20}/>Companies</h1><p>Filled in for you: type a company on a contact and it’s saved here.</p></div>
   <div className="zb-acts"><button type="button" className="zn-btn is-primary" onClick={()=>setEdit('new')}><Plus size={15}/>Add company</button></div></header>
  {err&&<p className="zb-err" role="alert">{err}</p>}
  <section className="zn-card zb-list-card zb-pad">
   <div className="zb-filter"><label className="zb-search"><Search size={14}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search companies"/></label></div>
   {d===null?<p className="zn-note">Loading…</p>:!rows.length?(q?<p className="zn-note">No company matches.</p>:<Empty icon={<Building2 size={22}/>} title="No companies yet" body="Add a contact with a company name and it shows up here."/>):
    <ul className="zb-rows">{rows.map(c=><li key={c.id}>
     <span className="zb-avatar is-square" style={{background:hue(c.name)}}>{initial(c.name)}</span>
     <button type="button" className="zb-main zb-plain" onClick={()=>setEdit(c)}><b>{c.name}</b><small>{[c.industry,c.website,`${c.people.length} contact${c.people.length===1?'':'s'}`].filter(Boolean).join(' · ')}</small></button>
     {c.openN>0&&<span className="zb-amt">{sums(c.open)}<small>{c.openN} open deal{c.openN===1?'':'s'}</small></span>}
     {c.customer&&<span className="zb-badge" style={{background:'#16a34a'}}>Customer</span>}
     <span className="zb-row-acts"><button type="button" className="zb-ic" aria-label="Delete" data-tip="Delete" onClick={()=>void remove(c)}><Trash2 size={15}/></button></span></li>)}</ul>}
  </section>
  {edit&&<CompanyDialog company={edit==='new'?null:edit} people={edit==='new'?[]:(d?.contacts??[]).filter(x=>x.company_id===edit.id)} onOpen={c=>{setEdit(null);setContact(c);}} onClose={()=>setEdit(null)} onDone={()=>{setEdit(null);void load();}}/>}
  {contact&&<ContactDialog contact={contact} companies={d?.companies??[]} onClose={()=>setContact(null)} onDone={()=>{setContact(null);void load();}}/>}
 </div></div>;
}

// Customers: contacts with a won deal (or marked by hand). Archive the ones you no longer work with.
export function BizCustomers({archived}:{archived:boolean}){
 const confirm=useConfirm();
 const {d,err,setErr,load}=useCrm();
 const [q,setQ]=useState(''),[edit,setEdit]=useState<Contact|null>(null),[add,setAdd]=useState(false);
 const list=useMemo(()=>{const t=q.trim().toLowerCase();return (d?.contacts??[]).filter(c=>c.customer&&!!c.archived_at===archived&&(!t||`${c.name} ${c.email} ${c.company}`.toLowerCase().includes(t)));},[d,q,archived]);
 const won=(c:Contact)=>sumBy((d?.deals??[]).filter(x=>x.contact_id===c.id&&x.stage==='won'&&x.value).map(x=>({amount:Number(x.value),currency:x.currency})));
 async function arch(c:Contact,v:boolean){try{await bizApi({action:'contact_archive',id:c.id,archived:v});void load();}catch(e){setErr((e as Error).message);}}
 async function unmark(c:Contact){if(!await confirm({title:`Move ${c.name} back to leads?`,message:'They stay in Contacts as a lead.',confirm:'Move'}))return;await bizApi({action:'contact_customer',id:c.id,customer:false}).catch(()=>{});void load();}
 const leads=(d?.contacts??[]).filter(c=>!c.customer);
 return <div className="zn-page"><div className="zn-scroll" data-lenis-prevent>
  <header className="zn-page-head zb-head"><div><h1>{archived?<><Archive size={20}/>Archived customers</>:<><UserRound size={20}/>Active customers</>}</h1><p>{archived?'Past customers. Restore one when you work with them again.':'People we work with now. Winning a deal adds them here.'}</p></div>
   {!archived&&<div className="zb-acts"><button type="button" className="zn-btn is-primary" onClick={()=>setAdd(true)}><Plus size={15}/>Add customer</button></div>}</header>
  {err&&<p className="zb-err" role="alert">{err}</p>}
  <section className="zn-card zb-list-card zb-pad">
   <div className="zb-filter"><label className="zb-search"><Search size={14}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search customers"/></label></div>
   {d===null?<p className="zn-note">Loading…</p>:!list.length?(q?<p className="zn-note">Nobody matches.</p>:<Empty icon={archived?<Archive size={22}/>:<UserRound size={22}/>} title={archived?'Nothing archived':'No customers yet'} body={archived?'Customers you archive show up here.':'Move a deal to Won, or add a customer from your contacts.'}/>):
    <ul className="zb-rows">{list.map(c=>{const w=won(c);return <li key={c.id}>
     <span className="zb-avatar" style={{background:hue(c.name)}}>{initial(c.name)}</span>
     <button type="button" className="zb-main zb-plain" onClick={()=>setEdit(c)}><b>{c.company||c.name}{c.company?<span className="zb-sub"> · {c.name}</span>:null}</b><small>{[c.email,c.phone,c.customer_since?`Customer since ${fmtDay(c.customer_since.slice(0,10))}`:'',archived&&c.archived_at?`archived ${fmtDay(c.archived_at.slice(0,10))}`:''].filter(Boolean).join(' · ')}</small></button>
     {Object.keys(w).length>0&&<span className="zb-amt">{sums(w)}<small>won</small></span>}
     <span className="zb-row-acts">
      {!archived&&<Link className="zb-ic" href={`/zarn/business/invoices/new?c=${c.id}`} aria-label={`Invoice ${c.name}`} data-tip="New invoice"><FileText size={15}/></Link>}
      {c.email&&<a className="zb-ic" href={`mailto:${c.email}`} aria-label={`Email ${c.name}`} data-tip="Email"><Mail size={15}/></a>}
      {archived?<button type="button" className="zb-ic" aria-label="Restore" data-tip="Restore" onClick={()=>void arch(c,false)}><ArchiveRestore size={15}/></button>:
       <button type="button" className="zb-ic" aria-label="Archive" data-tip="Archive" onClick={()=>void arch(c,true)}><Archive size={15}/></button>}
      <button type="button" className="zb-ic" aria-label="Move back to leads" data-tip="Back to leads" onClick={()=>void unmark(c)}><UserRound size={15}/></button>
     </span></li>;})}</ul>}
  </section>
  {edit&&<ContactDialog contact={edit} companies={d?.companies??[]} onClose={()=>setEdit(null)} onDone={()=>{setEdit(null);void load();}}/>}
  {add&&<Modal title="Add a customer" onClose={()=>setAdd(false)}><div className="zn-modal-body">
   {leads.length?<><p className="zn-note">Pick one of your leads, or add someone new from Contacts.</p><ul className="zb-rows zb-pick">{leads.slice(0,50).map(c=><li key={c.id}><span className="zb-main"><b>{c.name}</b><small>{[c.company,c.email].filter(Boolean).join(' · ')}</small></span><button type="button" className="zn-btn" onClick={async()=>{await bizApi({action:'contact_customer',id:c.id,customer:true}).catch(()=>{});setAdd(false);void load();}}>Add</button></li>)}</ul></>:<p className="zn-note">You have no leads to pick from. Add a contact first.</p>}
   <div className="zn-modal-foot"><Link className="zn-btn" href="/zarn/business/contacts">Go to Contacts</Link></div>
  </div></Modal>}
 </div></div>;
}

export function ContactDialog({contact,companies,onClose,onDone}:{contact:Contact|null;companies:Company[];onClose:()=>void;onDone:()=>void}){
 const [v,setV]=useState({name:contact?.name??'',job_title:contact?.job_title??'',email:contact?.email??'',phone:contact?.phone??'',company:contact?.company??'',website:contact?.website??'',social:contact?.social??'',address:contact?.address??'',city:contact?.city??'',country:contact?.country??'',tags:(contact?.tags??[]).join(', '),source:contact?.source??'manual',note:contact?.note??''});
 const [busy,setBusy]=useState(false),[err,setErr]=useState('');
 const f=(k:keyof typeof v)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setV(x=>({...x,[k]:e.target.value}));
 const isNew=!!v.company.trim()&&!companies.some(c=>c.name.toLowerCase()===v.company.trim().toLowerCase());
 async function save(e:React.FormEvent){e.preventDefault();setErr('');setBusy(true);
  try{await bizApi({action:'contact_save',...(contact?{id:contact.id}:{}),...v,tags:[...new Set(v.tags.split(/[,;]/).map(t=>t.trim()).filter(Boolean))].slice(0,20)});onDone();}catch(x){setErr((x as Error).message);setBusy(false);}}
 return <Modal title={contact?contact.name:'Add a contact'} onClose={onClose} wide><form className="zn-modal-body" onSubmit={save}>
  <div className="zn-form-row"><label className="zn-label">Name<input className="zn-input" value={v.name} maxLength={160} onChange={f('name')} autoFocus={!contact}/></label>
   <label className="zn-label">Job title<input className="zn-input" value={v.job_title} maxLength={120} onChange={f('job_title')} placeholder="e.g. Marketing lead"/></label></div>
  <div className="zn-form-row"><label className="zn-label">Email<input className="zn-input" type="email" value={v.email} maxLength={254} onChange={f('email')}/></label>
   <label className="zn-label">Phone<input className="zn-input" value={v.phone} maxLength={40} onChange={f('phone')}/></label></div>
  <label className="zn-label">Company {isNew&&<small>New: it will be saved to Companies</small>}<input className="zn-input" list="zb-companies" value={v.company} maxLength={200} onChange={f('company')} placeholder="Start typing to pick one, or type a new one"/>
   <datalist id="zb-companies">{companies.map(c=><option key={c.id} value={c.name}/>)}</datalist></label>
  <div className="zn-form-row"><label className="zn-label">Website<input className="zn-input" value={v.website} maxLength={300} onChange={f('website')}/></label>
   <label className="zn-label">LinkedIn or social<input className="zn-input" value={v.social} maxLength={300} onChange={f('social')} placeholder="Profile link or @handle"/></label></div>
  <label className="zn-label">Address<input className="zn-input" value={v.address} maxLength={500} onChange={f('address')}/></label>
  <div className="zn-form-row"><label className="zn-label">City<input className="zn-input" value={v.city} maxLength={120} onChange={f('city')}/></label>
   <label className="zn-label">Country<input className="zn-input" value={v.country} maxLength={120} onChange={f('country')}/></label></div>
  <div className="zn-form-row"><label className="zn-label">Tags <small>comma separated</small><input className="zn-input" value={v.tags} onChange={f('tags')} placeholder="e.g. VIP, Lagos"/></label>
   <label className="zn-label">Came from<select className="zn-input" value={v.source} onChange={f('source')}>{contactSources.map(s=><option key={s} value={s}>{sourceName[s]}</option>)}</select></label></div>
  <label className="zn-label">Notes<textarea className="zn-input zb-area" value={v.note} maxLength={5000} onChange={f('note')} placeholder="What they need, what was said, next step"/></label>
  {err&&<p className="zb-err" role="alert">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="submit" className="zn-btn is-primary" disabled={busy}>{busy?'Saving…':'Save'}</button></div>
 </form></Modal>;
}

function CompanyDialog({company,people,onOpen,onClose,onDone}:{company:Company|null;people:Contact[];onOpen:(c:Contact)=>void;onClose:()=>void;onDone:()=>void}){
 const [v,setV]=useState({name:company?.name??'',industry:company?.industry??'',website:company?.website??'',email:company?.email??'',phone:company?.phone??'',address:company?.address??'',note:company?.note??''});
 const [busy,setBusy]=useState(false),[err,setErr]=useState('');
 const f=(k:keyof typeof v)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setV(x=>({...x,[k]:e.target.value}));
 async function save(e:React.FormEvent){e.preventDefault();setErr('');setBusy(true);try{await bizApi({action:'company_save',...(company?{id:company.id}:{}),...v});onDone();}catch(x){setErr((x as Error).message);setBusy(false);}}
 return <Modal title={company?company.name:'Add a company'} onClose={onClose} wide><form className="zn-modal-body" onSubmit={save}>
  <div className="zn-form-row"><label className="zn-label">Name<input className="zn-input" value={v.name} maxLength={200} onChange={f('name')} autoFocus={!company}/></label>
   <label className="zn-label">Industry<input className="zn-input" value={v.industry} maxLength={120} onChange={f('industry')} placeholder="e.g. Food and drink"/></label></div>
  <div className="zn-form-row"><label className="zn-label">Website<input className="zn-input" value={v.website} maxLength={300} onChange={f('website')}/></label>
   <label className="zn-label">Email<input className="zn-input" type="email" value={v.email} maxLength={254} onChange={f('email')}/></label></div>
  <div className="zn-form-row"><label className="zn-label">Phone<input className="zn-input" value={v.phone} maxLength={40} onChange={f('phone')}/></label>
   <label className="zn-label">Address<input className="zn-input" value={v.address} maxLength={500} onChange={f('address')}/></label></div>
  <label className="zn-label">Notes<textarea className="zn-input zb-area" value={v.note} maxLength={5000} onChange={f('note')}/></label>
  {company&&<div className="zn-label">People here<div className="zb-people">{people.length?people.map(p=><button key={p.id} type="button" className="zb-person" onClick={()=>onOpen(p)}><span className="zb-avatar" style={{background:hue(p.name)}}>{initial(p.name)}</span><span><b>{p.name}</b><small>{p.job_title||p.email}</small></span></button>):<small>No contacts at this company yet.</small>}</div></div>}
  {err&&<p className="zb-err" role="alert">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="submit" className="zn-btn is-primary" disabled={busy}>{busy?'Saving…':'Save'}</button></div>
 </form></Modal>;
}

// Import contacts from Excel, CSV or a Google Sheets download. Columns are matched by their headings; adjust before importing.
function ImportDialog({onClose,onDone}:{onClose:()=>void;onDone:()=>void}){
 const [file,setFile]=useState(''),[head,setHead]=useState<string[]>([]),[rows,setRows]=useState<string[][]>([]),[map,setMap]=useState<Record<string,number>>({});
 const [dupes,setDupes]=useState(true),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[done,setDone]=useState<{added:number;skipped:number;companies:number}|null>(null);
 async function read(fl:File){
  setErr('');setDone(null);
  try{
   const X=await import('xlsx');const wb=X.read(await fl.arrayBuffer(),{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];
   const all=(X.utils.sheet_to_json(ws,{header:1,raw:false,defval:''}) as unknown[][]).map(r=>r.map(c=>String(c??'').trim())).filter(r=>r.some(Boolean));
   if(all.length<2)return setErr('That sheet has no rows under its headings.');
   const h=all[0];const m:Record<string,number>={};
   for(const fd of importFields){const i=h.findIndex((x,j)=>fd.match.test(x)&&!Object.values(m).includes(j));if(i>=0)m[fd.key]=i;}
   setFile(fl.name);setHead(h);setRows(all.slice(1));setMap(m);
  }catch{setErr('Could not read that file. Use .xlsx, .xls, .csv or .ods.');}
 }
 const build=()=>rows.map(r=>{const g=(k:string)=>map[k]!==undefined?r[map[k]]??'':'';
  const name=(g('name')||[g('first'),g('last')].filter(Boolean).join(' ')||g('email')).slice(0,160);
  const email=g('email').toLowerCase();
  return {name,email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:'',phone:g('phone').slice(0,40),company:g('company').slice(0,200),job_title:g('job_title').slice(0,120),website:g('website').slice(0,300),social:g('social').slice(0,300),address:g('address').slice(0,500),city:g('city').slice(0,120),country:g('country').slice(0,120),tags:g('tags').split(/[,;]/).map(t=>t.trim().slice(0,40)).filter(Boolean).slice(0,20),note:g('note').slice(0,5000)};}).filter(r=>r.name);
 const ready=head.length?build():[];
 async function go(){setBusy(true);setErr('');let added=0,skipped=0,companies=0;
  try{for(let i=0;i<ready.length;i+=2000){const r=await bizApi<{added:number;skipped:number;companies:number}>({action:'contact_import',rows:ready.slice(i,i+2000),skip_dupes:dupes});added+=r.added;skipped+=r.skipped;companies+=r.companies;}
   setDone({added,skipped,companies});onDone();}catch(e){setErr((e as Error).message);}setBusy(false);}
 return <Modal title="Import contacts" onClose={onClose} wide><div className="zn-modal-body">
  {done?<><p className="zb-flash-in">Imported {done.added} contact{done.added===1?'':'s'}{done.skipped?`, skipped ${done.skipped} already saved`:''}. {done.companies?`${done.companies} compan${done.companies===1?'y':'ies'} filed under Companies.`:''}</p><div className="zn-modal-foot"><button type="button" className="zn-btn is-primary" onClick={onClose}>Done</button></div></>:<>
   <label className="zb-drop"><input type="file" accept=".xlsx,.xls,.csv,.ods" onChange={e=>{const fl=e.target.files?.[0];if(fl)void read(fl);}}/><FileSpreadsheet size={16}/>{file||'Choose a sheet (Excel, CSV, or Google Sheets downloaded as .xlsx or .csv)'}</label>
   {head.length>0&&<>
    <p className="zn-note">We matched your columns. Change any that are wrong. Each row needs a name (or first and last name, or an email).</p>
    <div className="zb-map">{importFields.map(fd=><label key={fd.key} className="zn-label">{fd.label}<select className="zn-input" value={map[fd.key]??''} onChange={e=>setMap(m=>{const n={...m};if(e.target.value==='')delete n[fd.key];else n[fd.key]=Number(e.target.value);return n;})}><option value="">Skip</option>{head.map((h,i)=><option key={i} value={i}>{h||`Column ${i+1}`}</option>)}</select></label>)}</div>
    {ready.length>0&&<div className="zb-preview"><b>Preview</b>{ready.slice(0,4).map((r,i)=><span key={i}>{r.name}{r.company?` · ${r.company}`:''}{r.email?` · ${r.email}`:''}</span>)}{ready.length>4&&<small>and {ready.length-4} more</small>}</div>}
    <label className="zb-check is-left"><input type="checkbox" checked={dupes} onChange={e=>setDupes(e.target.checked)}/>Skip people whose email is already saved</label>
   </>}
   {err&&<p className="zb-err" role="alert">{err}</p>}
   <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="button" className="zn-btn is-primary" disabled={busy||!ready.length} onClick={()=>void go()}>{busy?'Importing…':`Import ${ready.length||''} contact${ready.length===1?'':'s'}`}</button></div>
  </>}
 </div></Modal>;
}
