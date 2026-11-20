'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Ban,Check,Copy,CopyPlus,FileText,Plus,Printer,RotateCcw,Search,Send,Trash2,Wallet,X} from 'lucide-react';
import {currencies,paymentMethods,invoiceTotals,invoiceState,invoiceStateStyle,money,fmtDate,invoiceApi,type Invoice,type InvoiceItem,type Payment} from '@/lib/crm';
import {pickAccount,type BankAccount} from '@/lib/bank';
import {lagosToday} from '@/lib/zarn-care';
import {sumBy} from '@/lib/biz';
import {Modal} from './Dialogs';
import {useConfirm} from './ConfirmProvider';
import {sums} from './BizMoney';

export type InvRow=Invoice&{client:string};
const Badge=({i}:{i:Pick<Invoice,'status'|'due_date'|'total'|'amount_paid'>})=>{const s=invoiceStateStyle[invoiceState(i)];return <span className="zb-badge" style={{background:s.color}}>{s.label}</span>;};
const FILTERS=[['all','All'],['draft','Drafts'],['unpaid','Unpaid'],['overdue','Overdue'],['paid','Paid']] as const;

// Every invoice, with what's owed and what's late at the top.
export function InvoiceList({invoices,collected}:{invoices:InvRow[];collected:{amount:number;currency:string}[]}){
 const [f,setF]=useState<typeof FILTERS[number][0]>('all'),[q,setQ]=useState('');
 const owed=invoices.filter(i=>i.status==='sent'),late=owed.filter(i=>invoiceState(i)==='overdue');
 const due=(l:InvRow[])=>sumBy(l.map(i=>({amount:Number(i.total)-Number(i.amount_paid),currency:i.currency})));
 const list=invoices.filter(i=>{const s=invoiceState(i);
  if(f==='draft'&&s!=='draft')return false;if(f==='unpaid'&&i.status!=='sent')return false;if(f==='overdue'&&s!=='overdue')return false;if(f==='paid'&&s!=='paid')return false;
  const t=q.trim().toLowerCase();return !t||i.number.toLowerCase().includes(t)||i.client.toLowerCase().includes(t);});
 return <div className="zn-page"><div className="zn-scroll" data-lenis-prevent>
  <header className="zn-page-head zb-head"><div><h1><FileText size={20}/>Invoices</h1><p>Make an invoice, send it with a payment link, and record payments as they land.</p></div>
   <div className="zb-acts"><Link href="/zarn/business/invoices/new" className="zn-btn is-primary"><Plus size={15}/>New invoice</Link></div></header>
  <div className="zn-crm-stats">
   <div><small>Waiting to be paid</small><b>{sums(due(owed))}</b><span>{owed.length} invoices</span></div>
   <div><small>Overdue</small><b className={late.length?'zb-out':''}>{sums(due(late))}</b><span>{late.length} late</span></div>
   <div><small>Collected this month</small><b className="zb-in">{sums(sumBy(collected))}</b><span>from recorded payments</span></div>
   <div><small>Drafts</small><b>{invoices.filter(i=>i.status==='draft').length}</b><span>not sent yet</span></div>
  </div>
  <section className="zn-card zb-list-card zb-pad">
   <div className="zb-filter">{FILTERS.map(([k,l])=><button key={k} type="button" className={f===k?'is-on':''} onClick={()=>setF(k)}>{l}</button>)}
    <label className="zb-search"><Search size={14}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search number or client"/></label></div>
   {!list.length?<p className="zn-note">{invoices.length?'No invoices match.':'No invoices yet. Make your first one.'}</p>:
    <ul className="zb-rows">{list.map(i=><li key={i.id} className="is-link"><Link href={`/zarn/business/invoices/${i.id}`} className="zb-rowlink">
     <span className="zb-main"><b>{i.number} · {i.client||'Client'}</b><small>Issued {fmtDate(i.issue_date)} · due {fmtDate(i.due_date)}</small></span>
     <Badge i={i}/><span className="zb-amt">{money(Number(i.total),i.currency)}{i.status==='sent'&&Number(i.amount_paid)>0&&<small>{money(Number(i.total)-Number(i.amount_paid),i.currency)} left</small>}</span></Link></li>)}</ul>}
  </section>
 </div></div>;
}

type Client={id:string;name:string;company:string;email:string};
// One editor for a new invoice and an existing one. Saving goes through the same invoice service the Studio admin uses.
export function InvoiceEditor({invoice,payments=[],clients,accounts,wonStage,emailReady,origin}:{invoice:Invoice|null;payments?:Payment[];clients:Client[];accounts:BankAccount[];wonStage:string|null;emailReady:boolean;origin:string}){
 const router=useRouter(),confirm=useConfirm(),today=lagosToday();
 const plus=(d:string,n:number)=>{const t=new Date(`${d}T12:00:00Z`);t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);};
 const [lead,setLead]=useState(invoice?.lead_id??''),[nc,setNc]=useState({name:'',email:'',company:'',phone:''}),[newClient,setNewClient]=useState(!invoice&&!clients.length);
 const [currency,setCurrency]=useState(invoice?.currency??'NGN'),[issue,setIssue]=useState(invoice?.issue_date??today),[dueOn,setDueOn]=useState(invoice?.due_date??plus(today,14));
 const [items,setItems]=useState<InvoiceItem[]>(invoice?.items?.length?invoice.items:[{description:'',qty:1,unit_price:0}]);
 const [tax,setTax]=useState(String(invoice?.tax_rate??0)),[discount,setDiscount]=useState(String(invoice?.discount??0)),[notes,setNotes]=useState(invoice?.notes??''),[bank,setBank]=useState(invoice?.bank_account_id??'');
 const [busy,setBusy]=useState(''),[err,setErr]=useState(''),[flash,setFlash]=useState(''),[payOpen,setPayOpen]=useState(false),[sendOpen,setSendOpen]=useState(false);
 const t=invoiceTotals(items,Number(tax)||0,Number(discount)||0);
 const locked=!!invoice&&(invoice.status==='paid'||invoice.status==='void');
 const client=clients.find(c=>c.id===lead);
 const accts=useMemo(()=>accounts.filter(a=>a.currency===currency),[accounts,currency]);
 const setItem=(i:number,p:Partial<InvoiceItem>)=>setItems(l=>l.map((x,j)=>j===i?{...x,...p}:x));
 const values=()=>({currency,issue_date:issue,due_date:dueOn,items:items.filter(i=>i.description.trim()).map(i=>({description:i.description.trim(),qty:Number(i.qty)||0,unit_price:Number(i.unit_price)||0})),tax_rate:Number(tax)||0,discount:Number(discount)||0,notes,bank_account_id:bank||pickAccount(accounts,currency)?.id||null});
 async function run(label:string,fn:()=>Promise<unknown>,done?:string){setBusy(label);setErr('');setFlash('');try{await fn();if(done)setFlash(done);router.refresh();}catch(e){setErr((e as Error).message);}setBusy('');}
 async function save(){
  if(!invoice){
   if(newClient&&(!nc.name.trim()||!nc.email.trim()))return setErr('Enter the client’s name and email.');
   if(!newClient&&!lead)return setErr('Choose a client.');
   setBusy('save');setErr('');
   try{const r=await invoiceApi<{id:string}>({action:'create_full',client:newClient?{new:nc}:{lead_id:lead},...(newClient&&wonStage?{stage:wonStage}:{}),values:values()});router.replace(`/zarn/business/invoices/${r.id}`);}
   catch(e){setErr((e as Error).message);setBusy('');}
   return;
  }
  await run('save',()=>invoiceApi({action:'save',id:invoice.id,values:{lead_id:lead,...values()}}),'Saved.');
 }
 const link=invoice?`${origin}/invoice/${invoice.public_token}`:'';
 return <div className="zn-page"><div className="zn-scroll" data-lenis-prevent>
  <header className="zn-page-head zb-head"><div><h1><Link href="/zarn/business/invoices" className="zb-back" aria-label="Back to invoices"><ArrowLeft size={18}/></Link>{invoice?<>{invoice.number}<Badge i={invoice}/></>:'New invoice'}</h1>
   <p>{invoice?`${client?.company||client?.name||'Client'} · ${money(Number(invoice.total),invoice.currency)}${Number(invoice.amount_paid)>0?` · ${money(Number(invoice.amount_paid),invoice.currency)} paid`:''}`:'Fill it in, save, then send it from here.'}</p></div>
   <div className="zb-acts">
    {invoice&&<>
     <a className="zn-btn" href={`/invoice/print/${invoice.id}`} target="_blank" rel="noreferrer"><Printer size={15}/>Print or PDF</a>
     {invoice.status!=='draft'&&<button type="button" className="zn-btn" onClick={()=>{void navigator.clipboard.writeText(link);setFlash('Client link copied.');}}><Copy size={15}/>Copy client link</button>}
     {(invoice.status==='draft'||invoice.status==='sent')&&<button type="button" className="zn-btn" onClick={()=>setSendOpen(true)}><Send size={15}/>{invoice.status==='draft'?'Send':'Send again'}</button>}
     {invoice.status==='sent'&&<button type="button" className="zn-btn is-primary" onClick={()=>setPayOpen(true)}><Wallet size={15}/>Record payment</button>}
    </>}
    {!locked&&<button type="button" className={`zn-btn${invoice?.status==='sent'?'':' is-primary'}`} disabled={!!busy} onClick={()=>void save()}>{busy==='save'?'Saving…':invoice?'Save':'Create invoice'}</button>}
   </div></header>
  {err&&<p className="zb-err" role="alert">{err}</p>}{flash&&<p className="zb-flash" role="status">{flash}</p>}
  <div className={`zb-inv${invoice?'':' is-one'}`}>
   <section className="zn-card zb-inv-main">
    <h3>Bill to</h3>
    {invoice?<select className="zn-input" value={lead} disabled={locked} onChange={e=>setLead(e.target.value)}>{clients.map(c=><option key={c.id} value={c.id}>{c.company?`${c.company} (${c.name})`:c.name}</option>)}</select>:
     <><div className="zb-seg"><button type="button" className={!newClient?'is-on':''} onClick={()=>setNewClient(false)} disabled={!clients.length}>Existing client</button><button type="button" className={newClient?'is-on':''} onClick={()=>setNewClient(true)}>New client</button></div>
      {newClient?<div className="zn-form-row"><input className="zn-input" placeholder="Name" value={nc.name} onChange={e=>setNc({...nc,name:e.target.value})}/><input className="zn-input" type="email" placeholder="Email" value={nc.email} onChange={e=>setNc({...nc,email:e.target.value})}/><input className="zn-input" placeholder="Company (optional)" value={nc.company} onChange={e=>setNc({...nc,company:e.target.value})}/><input className="zn-input" placeholder="Phone (optional)" value={nc.phone} onChange={e=>setNc({...nc,phone:e.target.value})}/></div>:
       <select className="zn-input" value={lead} onChange={e=>setLead(e.target.value)}><option value="">Choose a client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.company?`${c.company} (${c.name})`:c.name}</option>)}</select>}</>}
    <div className="zb-three">
     <label className="zn-label">Currency<select className="zn-input" value={currency} disabled={locked} onChange={e=>{setCurrency(e.target.value);setBank('');}}>{currencies.map(c=><option key={c}>{c}</option>)}</select></label>
     <label className="zn-label">Issued<input className="zn-input" type="date" value={issue} disabled={locked} onChange={e=>setIssue(e.target.value)}/></label>
     <label className="zn-label">Due<input className="zn-input" type="date" value={dueOn} disabled={locked} onChange={e=>setDueOn(e.target.value)}/></label>
    </div>
    <h3>Items</h3>
    <div className="zb-items">
     <div className="zb-item is-head"><span>Description</span><span>Qty</span><span>Price</span><span>Amount</span><span/></div>
     {items.map((it,i)=><div key={i} className="zb-item">
      <input className="zn-input" value={it.description} disabled={locked} maxLength={500} placeholder="What you did or sold" onChange={e=>setItem(i,{description:e.target.value})} aria-label="Description"/>
      <input className="zn-input" inputMode="decimal" value={String(it.qty)} disabled={locked} onChange={e=>setItem(i,{qty:e.target.value.replace(/[^\d.]/g,'') as unknown as number})} aria-label="Quantity"/>
      <input className="zn-input" inputMode="decimal" value={String(it.unit_price)} disabled={locked} onChange={e=>setItem(i,{unit_price:e.target.value.replace(/[^\d.]/g,'') as unknown as number})} aria-label="Unit price"/>
      <b>{money((Number(it.qty)||0)*(Number(it.unit_price)||0),currency)}</b>
      {!locked&&<button type="button" className="zb-ic" aria-label="Remove line" onClick={()=>setItems(l=>l.length>1?l.filter((_,j)=>j!==i):[{description:'',qty:1,unit_price:0}])}><X size={15}/></button>}
     </div>)}
     {!locked&&<button type="button" className="zn-btn zb-addline" onClick={()=>setItems(l=>[...l,{description:'',qty:1,unit_price:0}])}><Plus size={15}/>Add line</button>}
    </div>
    <div className="zb-totals">
     <label>Discount<input className="zn-input" inputMode="decimal" value={discount} disabled={locked} onChange={e=>setDiscount(e.target.value)}/></label>
     <label>Tax %<input className="zn-input" inputMode="decimal" value={tax} disabled={locked} onChange={e=>setTax(e.target.value)}/></label>
     <p><span>Subtotal</span><b>{money(t.subtotal,currency)}</b></p>
     {t.tax>0&&<p><span>Tax</span><b>{money(t.tax,currency)}</b></p>}
     <p className="is-total"><span>Total</span><b>{money(t.total,currency)}</b></p>
    </div>
    <label className="zn-label">Notes for the client <small>optional, e.g. payment terms</small><textarea className="zn-input zb-area" value={notes} disabled={locked} maxLength={5000} onChange={e=>setNotes(e.target.value)}/></label>
    {accts.length>0&&<label className="zn-label">Pay into<select className="zn-input" value={bank||pickAccount(accounts,currency)?.id||''} disabled={locked} onChange={e=>setBank(e.target.value)}>{accts.map(a=><option key={a.id} value={a.id}>{a.bank} · {a.account_number}</option>)}</select></label>}
   </section>
   {invoice&&<aside className="zb-inv-side">
    <section className="zn-card"><h3>Payments</h3>
     {payments.length?<ul className="zb-rows">{payments.map(p=><li key={p.id}><span className="zb-main"><b>{money(Number(p.amount),invoice.currency)}</b><small>{fmtDate(p.paid_on)} · {p.method}{p.note?` · ${p.note}`:''}</small></span>
      <button type="button" className="zb-ic" aria-label="Delete payment" onClick={async()=>{if(await confirm({title:'Delete this payment?',confirm:'Delete',danger:true}))void run('pay',()=>invoiceApi({action:'payment_delete',id:p.id}));}}><Trash2 size={15}/></button></li>)}</ul>:<p className="zn-note">No payments recorded yet.</p>}
     {invoice.status==='sent'&&<button type="button" className="zn-btn" onClick={()=>setPayOpen(true)}><Wallet size={15}/>Record payment</button>}
    </section>
    <section className="zn-card"><h3>More</h3>
     <div className="zb-more">
      {invoice.status==='draft'&&<button type="button" className="zn-btn" onClick={()=>void run('sent',()=>invoiceApi({action:'mark_sent',id:invoice.id}),'Marked as sent.')}><Check size={15}/>Mark as sent (sent another way)</button>}
      <button type="button" className="zn-btn" onClick={()=>void run('dup',async()=>{const r=await invoiceApi<{id:string}>({action:'duplicate',id:invoice.id});router.push(`/zarn/business/invoices/${r.id}`);})}><CopyPlus size={15}/>Duplicate</button>
      {invoice.status==='void'?<button type="button" className="zn-btn" onClick={()=>void run('reopen',()=>invoiceApi({action:'reopen',id:invoice.id}),'Reopened.')}><RotateCcw size={15}/>Reopen</button>:
       invoice.status!=='paid'&&<button type="button" className="zn-btn" onClick={async()=>{if(await confirm({title:'Void this invoice?',message:'The client link will show it as void.',confirm:'Void',danger:true}))void run('void',()=>invoiceApi({action:'void',id:invoice.id}),'Voided.');}}><Ban size={15}/>Void</button>}
      {(invoice.status==='draft'||invoice.status==='void')&&<button type="button" className="zn-btn zb-danger-text" onClick={async()=>{if(await confirm({title:`Delete ${invoice.number}?`,message:'This can’t be undone.',confirm:'Delete',danger:true}))void run('del',async()=>{await invoiceApi({action:'delete',id:invoice.id});router.replace('/zarn/business/invoices');});}}><Trash2 size={15}/>Delete</button>}
     </div>
    </section>
   </aside>}
  </div>
  {payOpen&&invoice&&<PaymentDialog invoice={invoice} onClose={()=>setPayOpen(false)} onSave={v=>run('pay',async()=>{await invoiceApi({action:'payment_add',invoice_id:invoice.id,...v});setPayOpen(false);},'Payment recorded.')}/>}
  {sendOpen&&invoice&&<SendDialog email={client?.email??''} emailReady={emailReady} onClose={()=>setSendOpen(false)} onSend={m=>run('send',async()=>{await invoiceApi({action:'send',id:invoice.id,...(m?{message:m}:{})});setSendOpen(false);},`Sent to ${client?.email}.`)}/>}
 </div></div>;
}

function PaymentDialog({invoice,onClose,onSave}:{invoice:Invoice;onClose:()=>void;onSave:(v:{amount:number;paid_on:string;method:string;note?:string})=>Promise<void>}){
 const left=Math.max(0,Number(invoice.total)-Number(invoice.amount_paid));
 const [amount,setAmount]=useState(String(left)),[paid,setPaid]=useState(lagosToday()),[method,setMethod]=useState(paymentMethods[0]),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
 return <Modal title="Record a payment" onClose={onClose}><form className="zn-modal-body" onSubmit={async e=>{e.preventDefault();setBusy(true);await onSave({amount:Number(amount.replace(/,/g,'')),paid_on:paid,method,...(note.trim()?{note:note.trim()}:{})});setBusy(false);}}>
  <p className="zn-note">{money(left,invoice.currency)} is still owed on {invoice.number}.</p>
  <div className="zn-form-row"><label className="zn-label">Amount ({invoice.currency})<input className="zn-input" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} autoFocus/></label>
   <label className="zn-label">Paid on<input className="zn-input" type="date" value={paid} onChange={e=>setPaid(e.target.value)}/></label></div>
  <label className="zn-label">Method<select className="zn-input" value={method} onChange={e=>setMethod(e.target.value)}>{paymentMethods.map(m=><option key={m}>{m}</option>)}</select></label>
  <label className="zn-label">Note <small>optional</small><input className="zn-input" value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder="e.g. transfer reference"/></label>
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="submit" className="zn-btn is-primary" disabled={busy}>{busy?'Saving…':'Record payment'}</button></div>
 </form></Modal>;
}

function SendDialog({email,emailReady,onClose,onSend}:{email:string;emailReady:boolean;onClose:()=>void;onSend:(message:string)=>Promise<void>}){
 const [m,setM]=useState(''),[busy,setBusy]=useState(false);
 return <Modal title="Send invoice" onClose={onClose}>
  {emailReady?<form className="zn-modal-body" onSubmit={async e=>{e.preventDefault();setBusy(true);await onSend(m.trim());setBusy(false);}}>
   <p className="zn-note">We’ll email <b>{email||'the client'}</b> a link to view and pay this invoice.</p>
   <label className="zn-label">Message <small>optional</small><textarea className="zn-input zb-area" value={m} maxLength={5000} onChange={e=>setM(e.target.value)} placeholder="Hi, here’s the invoice for this month’s work."/></label>
   <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="submit" className="zn-btn is-primary" disabled={busy||!email}><Send size={15}/>{busy?'Sending…':'Send'}</button></div>
  </form>:<div className="zn-modal-body"><p className="zn-note">Email isn’t set up on this site yet. Use “Mark as sent” under More, then copy the client link and share it.</p><div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>OK</button></div></div>}
 </Modal>;
}
