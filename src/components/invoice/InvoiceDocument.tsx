import {invoiceTotals,invoiceState,money,fmtDate,type Invoice} from '@/lib/crm';
import {pickAccount,type BankAccount} from '@/lib/bank';
import PrintButton from './PrintButton';
import './invoice.css';
export type InvoiceClient={name:string;email:string;company:string;phone:string}|null;
// The invoice as the client sees it. Used by the public /invoice/<token> page and the staff print view.
export default function InvoiceDocument({inv,client,settings,accounts,autoPrint,back}:{inv:Invoice;client:InvoiceClient;settings:Record<string,string>;accounts:BankAccount[];autoPrint?:boolean;back?:string}){
 const {subtotal,tax,total}=invoiceTotals(inv.items,Number(inv.tax_rate),Number(inv.discount));
 const due=Math.max(0,Number(inv.total)-Number(inv.amount_paid)),state=invoiceState(inv);
 const from=(settings.invoice_from||'Zaane\nhello@zaane.co').split('\n');
 const acct=pickAccount(accounts,inv.currency,inv.bank_account_id),other=settings.invoice_bank_details;
 const stamp=state==='paid'?'Paid':state==='void'?'Void':state==='draft'?'Draft':null;
 return <main className="za-invoice-page">
  <div className="inv-actions">{back&&<a href={back}>← Back to editor</a>}<PrintButton auto={autoPrint}/></div>
  <article className="inv">
   {stamp&&<div className={`inv-stamp is-${state}`}>{stamp}</div>}
   <header className="inv-head">
    <div><img src="/zaane-logo.svg" alt="Zaane" className="inv-logo"/><address>{from.map((l,i)=><span key={i} className={i===0?'inv-strong':''}>{l}</span>)}</address></div>
    <div className="inv-meta"><h1>Invoice</h1><dl><dt>Number</dt><dd>{inv.number}</dd><dt>Issued</dt><dd>{fmtDate(inv.issue_date)}</dd><dt>Due</dt><dd>{fmtDate(inv.due_date)}</dd></dl></div>
   </header>
   <section className="inv-to"><p className="inv-label">Billed to</p>{client&&<address><span className="inv-strong">{client.company||client.name}</span>{client.company&&<span>{client.name}</span>}<span>{client.email}</span>{client.phone&&<span>{client.phone}</span>}</address>}</section>
   <table className="inv-table">
    <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
    <tbody>{inv.items.map((i,k)=><tr key={k}><td>{i.description}</td><td>{i.qty}</td><td>{money(i.unit_price,inv.currency)}</td><td>{money(i.qty*i.unit_price,inv.currency)}</td></tr>)}</tbody>
   </table>
   <div className="inv-totals">
    <dl>
     <dt>Subtotal</dt><dd>{money(subtotal,inv.currency)}</dd>
     {Number(inv.discount)>0&&<><dt>Discount</dt><dd>-{money(Number(inv.discount),inv.currency)}</dd></>}
     {Number(inv.tax_rate)>0&&<><dt>Tax ({Number(inv.tax_rate)}%)</dt><dd>{money(tax,inv.currency)}</dd></>}
     <dt className="inv-strong">Total</dt><dd className="inv-strong">{money(total,inv.currency)}</dd>
     {Number(inv.amount_paid)>0&&<><dt>Paid</dt><dd>-{money(Number(inv.amount_paid),inv.currency)}</dd></>}
    </dl>
    <div className="inv-due"><span>Amount due</span><strong>{money(due,inv.currency)}</strong></div>
   </div>
   {acct&&state!=='paid'&&state!=='void'&&<section className="inv-bank"><p className="inv-label">Pay to</p>
    <dl><dt>Bank</dt><dd>{acct.bank}</dd>{acct.account_name&&<><dt>Account name</dt><dd>{acct.account_name}</dd></>}<dt>Account number</dt><dd className="inv-acct">{acct.account_number}</dd>{acct.extra&&<><dt>Other</dt><dd className="inv-extra">{acct.extra}</dd></>}</dl>
    <p className="inv-ref">Please use <b>{inv.number}</b> as the payment reference.</p></section>}
   {((other&&state!=='paid')||inv.notes)&&<section className="inv-notes">
    {other&&state!=='paid'&&<div><p className="inv-label">Payment instructions</p><p>{other}</p></div>}
    {inv.notes&&<div><p className="inv-label">Notes</p><p>{inv.notes}</p></div>}
   </section>}
   <footer className="inv-foot">{settings.invoice_footer||'Thank you for working with Zaane.'}</footer>
  </article>
 </main>;
}
