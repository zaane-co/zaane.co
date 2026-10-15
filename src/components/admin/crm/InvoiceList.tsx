'use client';
import Flash from '../Flash';
import Dropdown from '@/components/ui/Dropdown';
import {useState} from 'react';
import {F} from './NewLead';
import {useRouter} from 'next/navigation';
import {AlarmClock,FileText,Plus,Search,Trash2,Wallet,X} from 'lucide-react';
import {currencies,invoiceState,invoiceStateStyle,money,fmtDate,invoiceApi,type Invoice} from '@/lib/crm';

type Row=Invoice&{client:string};
type Client={id:string;name:string;company:string};
const sum=(rows:{currency:string;v:number}[])=>{const m:Record<string,number>={};for(const r of rows)if(r.v)m[r.currency]=(m[r.currency]??0)+r.v;return Object.entries(m).map(([c,v])=>money(v,c)).join(' · ')||'-';};

// All invoices across clients. compact=true is the per-client list on a lead's page.
export default function InvoiceList({invoices,clients,collected,compact,leadId,readOnly}:{invoices:Row[];clients?:Client[];collected?:{currency:string;amount:number}[];compact?:boolean;leadId?:string;readOnly?:boolean}){
 const router=useRouter();
 const [deleting,setDeleting]=useState<Row|null>(null),[flash,setFlash]=useState('');
 async function remove(){
  if(!deleting)return;setBusy(true);
  try{await invoiceApi({action:'delete',id:deleting.id});setFlash(`Invoice ${deleting.number} deleted.`);setDeleting(null);router.refresh();}
  catch(e){setFlash(e instanceof Error?e.message:'Could not delete.');setDeleting(null);}finally{setBusy(false);}
 }
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[picking,setPicking]=useState(false),[client,setClient]=useState(''),[mode,setMode]=useState<'new'|'existing'>(clients?.length?'existing':'new'),[nc,setNc]=useState({name:'',email:'',company:'',phone:'',currency:'NGN'}),[busy,setBusy]=useState(false),[opening,setOpening]=useState(false),[error,setError]=useState('');
 const owed=(i:Invoice)=>Math.max(0,Number(i.total)-Number(i.amount_paid));
 const live=invoices.filter(i=>i.status==='sent');
 const overdue=live.filter(i=>invoiceState(i)==='overdue');
 const shown=invoices.filter(i=>(filter==='all'||invoiceState(i)===filter||(filter==='open'&&i.status==='sent'))&&(!search||`${i.number} ${i.client}`.toLowerCase().includes(search.toLowerCase())));
 async function createWithClient(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{const {currency,...c}=nc;const r=await invoiceApi<{id:string}>({action:'create_with_client',client:c,currency});setOpening(true);router.push(`/admin/invoices/${r.id}`);}
  catch(err){setError(err instanceof Error?err.message:'Could not create the invoice.');setBusy(false);}
 }
 async function create(id:string){
  setBusy(true);setError('');
  try{const r=await invoiceApi<{id:string}>({action:'create',lead_id:id});setOpening(true);router.push(`/admin/invoices/${r.id}`);}
  catch(e){setError(e instanceof Error?e.message:'Could not create the invoice.');setBusy(false);}
 }
 const table=<section className="za-card">{shown.length?<div className="za-table-wrap"><table className={`za-table${readOnly?'':' za-table-click'}`}>
  <thead><tr><th>Invoice</th>{!compact&&<th>Client</th>}<th>Status</th><th>Total</th><th className="za-hide-sm">Due</th><th className="za-hide-sm">Balance</th><th className="za-th-actions"><span className="sr-only">Actions</span></th></tr></thead>
  <tbody>{shown.map(i=>{const st=invoiceStateStyle[invoiceState(i)]!;return <tr key={i.id} tabIndex={readOnly?undefined:0} onClick={readOnly?undefined:()=>router.push(`/admin/invoices/${i.id}`)} onKeyDown={readOnly?undefined:e=>{if(e.key==='Enter')router.push(`/admin/invoices/${i.id}`);}}>
   <td><b>{i.number}</b><small>Issued {fmtDate(i.issue_date)}</small></td>
   {!compact&&<td className="za-cell-muted">{i.client}</td>}
   <td><span className="za-status" style={{background:st.color}}>{st.label}</span></td>
   <td>{money(Number(i.total),i.currency)}</td>
   <td className="za-hide-sm">{fmtDate(i.due_date)}</td>
   <td className="za-hide-sm">{i.status==='void'?'-':money(owed(i),i.currency)}</td>
   <td onClick={e=>e.stopPropagation()}><div className="za-row-actions">{!readOnly&&<button type="button" className="za-row-danger" aria-label={`Delete ${i.number}`} data-tip="Delete" onClick={()=>setDeleting(i)}><Trash2 size={14}/></button>}</div></td>
  </tr>;})}</tbody>
 </table></div>:<div className="za-empty"><h3>{invoices.length?'No matches':'No invoices yet'}</h3><p>{invoices.length?'Try another filter.':compact?'Create the first invoice for this client.':'Create an invoice from a client in Leads, or here.'}</p></div>}</section>;

 const confirmModal=deleting&&<div className="za-modal-scrim" onClick={()=>setDeleting(null)}>
  <div className="za-modal" role="alertdialog" aria-label="Delete invoice" onClick={e=>e.stopPropagation()}>
   <div className="za-modal-head"><span className="za-modal-icon"><Trash2 size={18}/></span><div><strong>Delete invoice {deleting.number}?</strong><small>{money(Number(deleting.total),deleting.currency)}{deleting.client?` · ${deleting.client}`:''}</small></div></div>
   <p>{deleting.status==='draft'?'The draft is removed permanently.':`This permanently deletes the invoice${Number(deleting.amount_paid)>0?' and its recorded payments':''}, and the client’s link stops working. To keep a record, open it and void it instead.`}</p>
   <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setDeleting(null)}>Cancel</button><button type="button" className="za-btn za-btn-danger" disabled={busy} onClick={()=>void remove()}>{busy?'Deleting…':'Delete'}</button></div>
  </div>
 </div>;

 if(compact)return <div className="za-lead-main">
  <div className="za-toolbar"><p className="za-muted-note" style={{margin:0}}>{live.length?`${sum(live.map(i=>({currency:i.currency,v:owed(i)})))} outstanding`:'Nothing outstanding.'}</p>
   {readOnly?<small className="za-date">Finance manages invoices</small>:<button type="button" className="za-btn za-btn-primary" disabled={busy} onClick={()=>leadId&&void create(leadId)}><Plus size={15}/>{opening?'Opening…':busy?'Creating…':'New invoice'}</button>}</div>
  {error&&<Flash tone="error">{error}</Flash>}
  {flash&&<Flash>{flash}</Flash>}
  {table}
  {confirmModal}
 </div>;

 return <div className="za-page">
  <div className="za-page-head"><div><h1>Invoices</h1><p>Bill clients, send invoices and track what’s been paid.</p></div>
   <button type="button" className="za-btn za-btn-primary" onClick={()=>setPicking(true)}><Plus size={15}/>New invoice</button></div>
  <div className="za-stats za-stats-3">
   <div className="za-card za-stat za-crm-stat"><span className="za-stat-icon"><FileText size={19} strokeWidth={1.8}/></span><div><p>Outstanding</p><strong>{sum(live.map(i=>({currency:i.currency,v:owed(i)})))}</strong><small>{live.length} open invoice{live.length===1?'':'s'}</small></div></div>
   <div className="za-card za-stat za-crm-stat"><span className="za-stat-icon"><AlarmClock size={19} strokeWidth={1.8}/></span><div><p>Overdue</p><strong>{sum(overdue.map(i=>({currency:i.currency,v:owed(i)})))}</strong><small className={overdue.length?'is-alert':''}>{overdue.length} invoice{overdue.length===1?'':'s'}</small></div></div>
   <div className="za-card za-stat za-crm-stat"><span className="za-stat-icon"><Wallet size={19} strokeWidth={1.8}/></span><div><p>Collected this month</p><strong>{sum((collected??[]).map(c=>({currency:c.currency,v:c.amount})))}</strong><small>From recorded payments</small></div></div>
  </div>
  <div className="za-toolbar">
   <div className="za-search za-search-wide"><Search size={14}/><input placeholder="Search number or client…" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search invoices"/></div>
   <div className="za-seg" role="group" aria-label="Filter">{[['all','All'],['draft','Drafts'],['open','Open'],['overdue','Overdue'],['paid','Paid']].map(([k,l])=><button key={k} type="button" className={filter===k?'is-on':''} aria-pressed={filter===k} onClick={()=>setFilter(k!)}>{l}</button>)}</div>
  </div>
  {flash&&<Flash>{flash}</Flash>}
  {table}
  {confirmModal}
  {picking&&<div className="za-modal-scrim" onClick={()=>setPicking(false)}>
   <div className="za-modal za-modal-wide" role="dialog" aria-label="New invoice" onClick={e=>e.stopPropagation()}>
    <div className="za-modal-head"><span className="za-modal-icon za-modal-icon-brand"><FileText size={18}/></span><div><strong>New invoice</strong><small>Who is it for?</small></div><button type="button" className="za-icon-btn za-push" aria-label="Close" onClick={()=>setPicking(false)}><X size={16}/></button></div>
    {!!clients?.length&&<div className="za-seg za-seg-full" role="group" aria-label="Client type"><button type="button" className={mode==='existing'?'is-on':''} aria-pressed={mode==='existing'} onClick={()=>setMode('existing')}>Existing client</button><button type="button" className={mode==='new'?'is-on':''} aria-pressed={mode==='new'} onClick={()=>setMode('new')}>New client</button></div>}
    {mode==='existing'&&clients?.length?<>
     <Dropdown label="Client" placeholder="Choose a client…" value={client} onChange={setClient} options={clients.map(c=>({value:c.id,label:c.company||c.name,hint:c.company?c.name:undefined}))}/>
     {error&&<Flash tone="error">{error}</Flash>}
     <div className="za-modal-foot" style={{marginTop:16}}><button type="button" className="za-btn za-btn-ghost" onClick={()=>setPicking(false)}>Cancel</button><button type="button" className="za-btn za-btn-primary" disabled={!client||busy} onClick={()=>void create(client)}>{opening?'Opening invoice…':busy?'Creating…':'Create draft'}</button></div>
    </>:<form onSubmit={createWithClient}>
     <div className="za-form-grid">
      <F label="Name *"><input required autoFocus maxLength={120} value={nc.name} onChange={e=>setNc(v=>({...v,name:e.target.value}))}/></F>
      <F label="Email *"><input required type="email" maxLength={254} value={nc.email} onChange={e=>setNc(v=>({...v,email:e.target.value}))}/></F>
      <F label="Company"><input maxLength={200} value={nc.company} onChange={e=>setNc(v=>({...v,company:e.target.value}))}/></F>
      <F label="Phone"><input type="tel" maxLength={40} value={nc.phone} onChange={e=>setNc(v=>({...v,phone:e.target.value}))}/></F>
      <F label="Currency" wide><Dropdown label="Currency" value={nc.currency} onChange={x=>setNc(v=>({...v,currency:x}))} options={currencies.map(c=>({value:c,label:c}))}/></F>
     </div>
     <p className="za-modal-hint">They’re saved to Leads as a won client. If the email already exists, the invoice goes to that client.</p>
     {error&&<Flash tone="error">{error}</Flash>}
     <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setPicking(false)}>Cancel</button><button className="za-btn za-btn-primary" disabled={busy}>{opening?'Opening invoice…':busy?'Saving client…':'Create draft'}</button></div>
    </form>}
   </div>
  </div>}
 </div>;
}
