'use client';
import Flash from '../Flash';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {AlarmClock,FileText,Plus,Search,Trash2,Wallet} from 'lucide-react';
import {invoiceState,invoiceStateStyle,money,fmtDate,invoiceApi,type Invoice} from '@/lib/crm';

type Row=Invoice&{client:string};
const sum=(rows:{currency:string;v:number}[])=>{const m:Record<string,number>={};for(const r of rows)if(r.v)m[r.currency]=(m[r.currency]??0)+r.v;return Object.entries(m).map(([c,v])=>money(v,c)).join(' · ')||'-';};

// All invoices across clients. compact=true is the per-client list on a lead's page.
export default function InvoiceList({created,invoices,collected,compact,leadId,readOnly}:{invoices:Row[];collected?:{currency:string;amount:number}[];created?:string;compact?:boolean;leadId?:string;readOnly?:boolean}){
 const router=useRouter();
 const [deleting,setDeleting]=useState<Row|null>(null),[flash,setFlash]=useState(created?`Invoice ${created} created. It’s a draft: open it to send it or record a payment.`:'');
 async function remove(){
  if(!deleting)return;setBusy(true);
  try{await invoiceApi({action:'delete',id:deleting.id});setFlash(`Invoice ${deleting.number} deleted.`);setDeleting(null);router.refresh();}
  catch(e){setFlash(e instanceof Error?e.message:'Could not delete.');setDeleting(null);}finally{setBusy(false);}
 }
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[busy,setBusy]=useState(false),[opening,setOpening]=useState(false),[error,setError]=useState('');
 const owed=(i:Invoice)=>Math.max(0,Number(i.total)-Number(i.amount_paid));
 const live=invoices.filter(i=>i.status==='sent');
 const overdue=live.filter(i=>invoiceState(i)==='overdue');
 const shown=invoices.filter(i=>(filter==='all'||invoiceState(i)===filter||(filter==='open'&&i.status==='sent'))&&(!search||`${i.number} ${i.client}`.toLowerCase().includes(search.toLowerCase())));
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
   <Link href="/admin/invoices/new" className="za-btn za-btn-primary"><Plus size={15}/>New invoice</Link></div>
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
 </div>;
}
