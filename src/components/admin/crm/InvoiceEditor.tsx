'use client';
import Flash from '../Flash';
import Dropdown from '@/components/ui/Dropdown';
import {useState,useTransition} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Ban,Check,Copy,CopyPlus,ExternalLink,Plus,Printer,RotateCcw,Send,Trash2,Wallet,X} from 'lucide-react';
import {currencies,paymentMethods,invoiceTotals,invoiceState,invoiceStateStyle,money,fmtDate,invoiceApi,type Invoice,type InvoiceItem,type Payment} from '@/lib/crm';
import {F} from './NewLead';

type Client={id:string;name:string;company:string;email:string};
const today=()=>new Date().toISOString().slice(0,10);
const plusDays=(from:string,n:number)=>{const d=new Date(from+'T00:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};

export default function InvoiceEditor({invoice,payments,clients,emailReady,canCrm=true}:{invoice:Invoice;payments:Payment[];clients:Client[];emailReady:boolean;canCrm?:boolean}){
 const router=useRouter(),[,start]=useTransition();
 const [flash,setFlash]=useState(''),[busy,setBusy]=useState<string|null>(null);
 const state=invoiceState(invoice),locked=invoice.status==='paid'||invoice.status==='void';
 const initial={lead_id:invoice.lead_id,currency:invoice.currency,issue_date:invoice.issue_date,due_date:invoice.due_date,items:invoice.items,tax_rate:String(invoice.tax_rate),discount:String(invoice.discount),notes:invoice.notes};
 const [v,setV]=useState(initial);
 const dirty=JSON.stringify(v)!==JSON.stringify(initial);
 const items=v.items.map(i=>({...i,qty:Number(i.qty)||0,unit_price:Number(i.unit_price)||0}));
 const t=invoiceTotals(items,Number(v.tax_rate),Number(v.discount));
 const owed=Math.max(0,Number(invoice.total)-Number(invoice.amount_paid));
 const client=clients.find(c=>c.id===v.lead_id);

 async function run(key:string,body:object,done?:string,after?:(r:Record<string,unknown>)=>void){
  setBusy(key);setFlash('');
  try{const r=await invoiceApi(body);if(done)setFlash(done);after?.(r);start(()=>router.refresh());return true;}
  catch(e){setFlash(e instanceof Error?e.message:'Something went wrong.');return false;}
  finally{setBusy(null);}
 }
 const save=()=>run('save',{action:'save',id:invoice.id,values:{...v,items,tax_rate:Number(v.tax_rate)||0,discount:Number(v.discount)||0}},'Invoice saved.');
 const setItem=(i:number,p:Partial<Record<keyof InvoiceItem,string|number>>)=>setV(s=>({...s,items:s.items.map((it,k)=>k===i?{...it,...p} as InvoiceItem:it)}));

 // Send dialog
 const [sending,setSending]=useState(false);
 const first=client?.name.split(' ')[0]??'there';
 const [message,setMessage]=useState(`Hi ${first},\n\nPlease find invoice ${invoice.number}, due ${fmtDate(invoice.due_date)}.\n\nThank you,\nZaane`);
 async function send(){if(dirty&&!await save())return;if(await run('send',{action:'send',id:invoice.id,message},`Invoice emailed to ${client?.email}.`))setSending(false);}

 // Payment form
 const [pay,setPay]=useState({amount:'',paid_on:today(),method:paymentMethods[0]!,note:''});
 async function addPayment(e:React.FormEvent){e.preventDefault();if(await run('pay',{action:'payment_add',invoice_id:invoice.id,amount:Number(pay.amount),paid_on:pay.paid_on,method:pay.method,note:pay.note},'Payment recorded.'))setPay(p=>({...p,amount:'',note:''}));}
 const [confirm,setConfirm]=useState<'delete'|'void'|null>(null);
 const style=invoiceStateStyle[state]!;

 return <div className="za-page za-invoice-edit">
  <Link href={canCrm?`/admin/leads/${invoice.lead_id}`:'/admin/invoices'} className="za-back"><ArrowLeft size={14}/>{canCrm?client?.company||client?.name||'Client':'All invoices'}</Link>
  <div className="za-lead-head">
   <div className="za-lead-title"><h1>Invoice {invoice.number} <span className="za-status" style={{background:style.color}}>{style.label}</span></h1>
    <p><span>{money(Number(invoice.total),invoice.currency)} total</span>{Number(invoice.amount_paid)>0&&<span>{money(Number(invoice.amount_paid),invoice.currency)} paid</span>}{invoice.sent_at&&<span>Sent {fmtDate(invoice.sent_at)}</span>}</p></div>
   <div className="za-toolbar-actions">
    {invoice.status!=='draft'&&<><button type="button" className="za-btn za-btn-ghost" onClick={()=>{void navigator.clipboard?.writeText(`${window.location.origin}/invoice/${invoice.public_token}`).then(()=>setFlash('Client link copied.'));}} data-tip="Copy the client’s invoice link"><Copy size={14}/>Copy link</button>
     <a className="za-btn za-btn-ghost" href={`/invoice/${invoice.public_token}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>View</a></>}
    <a className="za-btn za-btn-ghost" href={`/invoice/print/${invoice.id}?print=1`} target="_blank" rel="noopener noreferrer" data-tip={dirty?'Save first to print your latest changes':'Print or save as PDF'}><Printer size={14}/>Print</a>
    {!locked&&dirty&&<button type="button" className="za-btn za-btn-ghost" disabled={busy==='save'} onClick={()=>void save()}><Check size={14}/>{busy==='save'?'Saving…':'Save'}</button>}
    {!locked&&<button type="button" className="za-btn za-btn-primary" disabled={!emailReady} data-tip={emailReady?undefined:'Email isn’t configured'} onClick={()=>setSending(true)}><Send size={14}/>{invoice.status==='draft'?'Send invoice':'Resend'}</button>}
   </div>
  </div>
  <div className="za-inv-bar" role="toolbar" aria-label="Invoice actions">
   {invoice.status==='draft'&&<button type="button" className="za-btn za-btn-ghost" disabled={!!busy} onClick={()=>void run('mark',{action:'mark_sent',id:invoice.id},'Marked as sent. You can now record payments.')}><Check size={14}/>Mark as sent</button>}
   {!locked&&<button type="button" className="za-btn za-btn-ghost" onClick={()=>document.getElementById('record-payment')?.scrollIntoView({behavior:'smooth',block:'center'})}><Wallet size={14}/>Record payment</button>}
   <button type="button" className="za-btn za-btn-ghost" disabled={!!busy} onClick={()=>void run('dup',{action:'duplicate',id:invoice.id},'Duplicated.',r=>router.push(`/admin/invoices/${r.id}`))}><CopyPlus size={14}/>Duplicate</button>
   {invoice.status==='void'&&<button type="button" className="za-btn za-btn-ghost" disabled={!!busy} onClick={()=>void run('reopen',{action:'reopen',id:invoice.id},'Invoice reopened.')}><RotateCcw size={14}/>Reopen</button>}
   {invoice.status==='sent'&&<button type="button" className="za-btn za-btn-ghost za-btn-danger-text" onClick={()=>setConfirm('void')}><Ban size={14}/>Void</button>}
   <button type="button" className="za-btn za-btn-ghost za-btn-danger-text za-push" onClick={()=>setConfirm('delete')}><Trash2 size={14}/>Delete</button>
  </div>
  {flash&&<Flash>{flash}</Flash>}
  {locked&&<Flash tone="info">{invoice.status==='paid'?'This invoice is paid and locked. Remove a payment to reopen it.':'This invoice is void. Reopen it to make changes.'}</Flash>}

  <div className="za-inv-stack">
    <section className="za-card">
     <div className="za-card-head"><h2>Line items</h2><small className="za-date">{v.items.length} line{v.items.length===1?'':'s'}</small></div>
     <fieldset disabled={locked} className="za-fieldset">
      <div className="za-lines">
       <div className="za-line za-line-head"><span>Description</span><span>Qty</span><span>Price (each)</span><span>Line total</span><span/></div>
       {v.items.map((it,i)=><div key={i} className="za-line">
        <input aria-label="Description" placeholder="e.g. Brand identity design" maxLength={500} value={it.description} onChange={e=>setItem(i,{description:e.target.value})}/>
        <input aria-label="Quantity" type="number" min={0} step="any" value={it.qty} onChange={e=>setItem(i,{qty:e.target.value})}/>
        <input aria-label="Price" type="number" min={0} step="any" placeholder="Amount" value={it.unit_price===0?'':it.unit_price} onChange={e=>setItem(i,{unit_price:e.target.value})}/>
        <span className="za-line-amt">{money((Number(it.qty)||0)*(Number(it.unit_price)||0),v.currency)}</span>
        <button type="button" className="za-stage-icon za-row-danger" aria-label="Remove line" data-tip="Remove" onClick={()=>setV(s=>({...s,items:s.items.filter((_,k)=>k!==i)}))}><Trash2 size={14}/></button>
       </div>)}
       <button type="button" className="za-btn za-btn-ghost za-line-add" onClick={()=>setV(s=>({...s,items:[...s.items,{description:'',qty:1,unit_price:0}]}))}><Plus size={14}/>Add line</button>
      </div>
      <div className="za-inv-sum">
       <div className="za-form-grid">
        <F label={`Discount (${v.currency})`}><input type="number" min={0} step="any" value={v.discount} onChange={e=>setV(s=>({...s,discount:e.target.value}))}/></F>
        <F label="Tax / VAT (%)"><input type="number" min={0} max={100} step="any" value={v.tax_rate} onChange={e=>setV(s=>({...s,tax_rate:e.target.value}))}/></F>
        <F label="Notes to client" wide><textarea rows={3} maxLength={5000} placeholder="e.g. 50% deposit, balance on delivery" value={v.notes} onChange={e=>setV(s=>({...s,notes:e.target.value}))}/></F>
       </div>
       <dl className="za-inv-totals">
        <dt>Subtotal</dt><dd>{money(t.subtotal,v.currency)}</dd>
        {Number(v.discount)>0&&<><dt>Discount</dt><dd>-{money(Number(v.discount),v.currency)}</dd></>}
        {Number(v.tax_rate)>0&&<><dt>Tax ({Number(v.tax_rate)}%)</dt><dd>{money(t.tax,v.currency)}</dd></>}
        <dt className="is-total">Total</dt><dd className="is-total">{money(t.total,v.currency)}</dd>
       </dl>
      </div>
     </fieldset>
     {!locked&&dirty&&<div className="za-card-pad za-save-row"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setV(initial)}>Discard</button><button type="button" className="za-btn za-btn-primary" disabled={busy==='save'} onClick={()=>void save()}>{busy==='save'?'Saving…':'Save changes'}</button></div>}
    </section>

    <section className="za-card">
     <div className="za-card-head"><h2>Details</h2></div>
     <fieldset disabled={locked} className="za-card-pad za-form-grid za-fieldset">
      <F label="Client" wide><Dropdown label="Client" value={v.lead_id} onChange={x=>setV(s=>({...s,lead_id:x}))} options={clients.map(c=>({value:c.id,label:c.company||c.name,hint:c.company?c.name:undefined}))}/></F>
      <F label="Issue date"><input type="date" value={v.issue_date} onChange={e=>setV(s=>({...s,issue_date:e.target.value}))}/></F>
      <F label="Due date"><input type="date" value={v.due_date} min={v.issue_date} onChange={e=>setV(s=>({...s,due_date:e.target.value}))}/></F>
      <div className="za-field-wide za-chips">{[7,14,30].map(n=><button key={n} type="button" onClick={()=>setV(s=>({...s,due_date:plusDays(s.issue_date,n)}))}>Net {n}</button>)}<button type="button" onClick={()=>setV(s=>({...s,due_date:s.issue_date}))}>On receipt</button></div>
      <F label="Currency"><Dropdown label="Currency" value={v.currency} onChange={x=>setV(s=>({...s,currency:x}))} options={currencies.map(c=>({value:c,label:c}))}/></F>
     </fieldset>
    </section>

    <section className="za-card">
     <div className="za-card-head"><h2><Wallet size={14}/>Payments</h2><strong className="za-lead-value">{money(owed,invoice.currency)} due</strong></div>
     <div className="za-card-pad">
      {payments.length?<ul className="za-tasks">{payments.map(p=><li key={p.id} className="za-task">
       <Check size={14} className="za-pay-icon"/><div><span>{money(Number(p.amount),invoice.currency)} · {p.method}</span><small className="za-due">{fmtDate(p.paid_on)}{p.note?` · ${p.note}`:''}</small></div>
       <button type="button" aria-label="Remove payment" data-tip="Remove" disabled={busy===p.id} onClick={()=>void run(p.id,{action:'payment_delete',id:p.id},'Payment removed.')}><Trash2 size={12}/></button>
      </li>)}</ul>:<p className="za-muted-note">{locked?'No payments.':'No payments yet. Record one below when the client pays.'}</p>}
      {!locked&&<form id="record-payment" className="za-form-grid za-pay-form" onSubmit={addPayment}>
       <F label="Amount paid"><input type="number" min={0} step="any" required placeholder={String(owed)} value={pay.amount} onChange={e=>setPay(p=>({...p,amount:e.target.value}))}/></F>
       <F label="Date"><input type="date" required value={pay.paid_on} onChange={e=>setPay(p=>({...p,paid_on:e.target.value}))}/></F>
       <F label="Method" wide><Dropdown label="Method" value={pay.method} onChange={x=>setPay(p=>({...p,method:x}))} options={paymentMethods.map(m=>({value:m,label:m}))}/></F>
       <div className="za-field-wide za-chips"><button type="button" onClick={()=>setPay(p=>({...p,amount:String(owed)}))}>Full amount</button><button type="button" onClick={()=>setPay(p=>({...p,amount:String(Math.round(owed/2*100)/100)}))}>Half</button></div>
       <button className="za-btn za-btn-primary za-field-wide" disabled={busy==='pay'||!pay.amount}><Plus size={14}/>Record payment</button>
      </form>}
     </div>
    </section>

  </div>

  {sending&&<div className="za-modal-scrim" onClick={()=>setSending(false)}>
   <div className="za-modal za-modal-wide" role="dialog" aria-label="Send invoice" onClick={e=>e.stopPropagation()}>
    <div className="za-modal-head"><span className="za-modal-icon za-modal-icon-brand"><Send size={18}/></span><div><strong>Send {invoice.number}</strong><small>To {client?.name} &lt;{client?.email}&gt;</small></div><button type="button" className="za-icon-btn za-push" aria-label="Close" onClick={()=>setSending(false)}><X size={16}/></button></div>
    <p>The email includes the line items, the amount due and a link to the full invoice they can print or save as PDF.{dirty?' Your unsaved changes will be saved first.':''}</p>
    <textarea className="za-modal-text" rows={7} maxLength={5000} value={message} onChange={e=>setMessage(e.target.value)} aria-label="Message"/>
    <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setSending(false)}>Cancel</button><button type="button" className="za-btn za-btn-primary" disabled={!!busy} onClick={()=>void send()}>{busy?'Sending…':'Send email'}</button></div>
   </div>
  </div>}
  {confirm&&<div className="za-modal-scrim" onClick={()=>setConfirm(null)}>
   <div className="za-modal" role="alertdialog" aria-label={confirm==='delete'?'Delete draft':'Void invoice'} onClick={e=>e.stopPropagation()}>
    <div className="za-modal-head"><span className="za-modal-icon">{confirm==='delete'?<Trash2 size={18}/>:<Ban size={18}/>}</span><div><strong>{confirm==='delete'?(invoice.status==='draft'?'Delete this draft?':'Delete this invoice?'):'Void this invoice?'}</strong><small>{invoice.number}</small></div></div>
    <p>{confirm==='delete'?(invoice.status==='draft'?'The draft is removed permanently.':`This permanently deletes the invoice${payments.length?` and its ${payments.length} recorded payment${payments.length===1?'':'s'}`:''}. The client’s link will stop working. To keep a record, void it instead.`):'The client’s link will show it as void and it stops counting as outstanding. You can reopen it later.'}</p>
    <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setConfirm(null)}>Cancel</button><button type="button" className="za-btn za-btn-danger" disabled={!!busy} onClick={()=>void (confirm==='delete'?run('del',{action:'delete',id:invoice.id},undefined,()=>router.push(canCrm?`/admin/leads/${invoice.lead_id}`:'/admin/invoices')):run('void',{action:'void',id:invoice.id},'Invoice voided.')).then(()=>setConfirm(null))}>{confirm==='delete'?'Delete':'Void'}</button></div>
   </div>
  </div>}
 </div>;
}
