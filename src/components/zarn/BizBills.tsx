'use client';
import {useCallback,useEffect,useState} from 'react';
import {CalendarClock,Check,Paperclip,Pencil,Plus,Repeat,Trash2} from 'lucide-react';
import {money,currencies} from '@/lib/crm';
import {outCategories,billRepeats,repeatName,sumBy,type Bill,type BillRepeat} from '@/lib/biz';
import {lagosToday,fmtDay} from '@/lib/zarn-care';
import {Modal} from './Dialogs';
import {useConfirm} from './ConfirmProvider';
import {bizApi,sums} from './BizMoney';

const days=(d:string,today:string)=>Math.round((Date.parse(d)-Date.parse(today))/864e5);
// Bills we pay: what's overdue, what's due soon, what repeats. Paying one logs it in Money with its receipt.
export default function BizBills(){
 const confirm=useConfirm(),today=lagosToday();
 const [bills,setBills]=useState<Bill[]|null>(null),[err,setErr]=useState(''),[edit,setEdit]=useState<Bill|'new'|null>(null),[pay,setPay]=useState<Bill|null>(null),[flash,setFlash]=useState('');
 const load=useCallback(async()=>{try{const d=await bizApi<{bills:Bill[]}>({action:'bills'});setBills(d.bills);setErr('');}catch(e){setErr((e as Error).message);setBills([]);}},[]);
 useEffect(()=>{void (async()=>{await load();})();},[load]);
 const open=(bills??[]).filter(b=>b.due_on),done=(bills??[]).filter(b=>!b.due_on);
 const overdue=open.filter(b=>days(b.due_on!,today)<0),soon=open.filter(b=>{const n=days(b.due_on!,today);return n>=0&&n<=7;}),later=open.filter(b=>days(b.due_on!,today)>7);
 const monthEnd=today.slice(0,8)+'31';
 const dueMonth=open.filter(b=>b.due_on!<=monthEnd);
 const monthly=sumBy((bills??[]).filter(b=>b.repeat!=='none').map(b=>({amount:b.repeat==='weekly'?b.amount*52/12:b.repeat==='yearly'?b.amount/12:b.amount,currency:b.currency})));
 async function remove(b:Bill){if(!await confirm({title:`Delete ${b.title}?`,message:'Payments already logged in Money stay there.',confirm:'Delete',danger:true}))return;await bizApi({action:'bill_delete',id:b.id}).catch(()=>{});void load();}
 const row=(b:Bill)=>{const n=b.due_on?days(b.due_on,today):null;
  return <li key={b.id}>
   <span className={`zb-due-ic${n!==null&&n<0?' is-late':n!==null&&n<=7?' is-soon':''}`}><CalendarClock size={16}/></span>
   <span className="zb-main"><b>{b.title}</b><small>{[b.vendor,b.category,b.repeat!=='none'?repeatName[b.repeat]:''].filter(Boolean).join(' · ')}</small></span>
   <span className="zb-when">{b.due_on?<><b className={n!<0?'zb-out':''}>{n===0?'Due today':n===1?'Due tomorrow':n!<0?`${-n!} day${n===-1?'':'s'} late`:`Due ${fmtDay(b.due_on)}`}</b>{b.last_paid_on&&<small>Last paid {fmtDay(b.last_paid_on)}</small>}</>:<small>Paid {b.last_paid_on?fmtDay(b.last_paid_on):''}</small>}</span>
   <span className="zb-amt">{money(b.amount,b.currency)}</span>
   <span className="zb-row-acts">
    {b.due_on&&<button type="button" className="zn-btn zb-pay" onClick={()=>setPay(b)}><Check size={14}/>Pay</button>}
    <button type="button" className="zb-ic" aria-label="Edit" data-tip="Edit" onClick={()=>setEdit(b)}><Pencil size={15}/></button>
    <button type="button" className="zb-ic" aria-label="Delete" data-tip="Delete" onClick={()=>void remove(b)}><Trash2 size={15}/></button>
   </span></li>;};
 const group=(t:string,l:Bill[])=>l.length>0&&<section className="zb-group"><h3>{t}<small>{l.length}</small></h3><ul className="zb-rows">{l.map(row)}</ul></section>;
 return <div className="zn-page"><div className="zn-scroll" data-lenis-prevent>
  <header className="zn-page-head zb-head"><div><h1><CalendarClock size={20}/>Bills</h1><p>What we owe and when. Admins get a reminder two days before a bill is due.</p></div>
   <div className="zb-acts"><button type="button" className="zn-btn is-primary" onClick={()=>setEdit('new')}><Plus size={15}/>Add bill</button></div></header>
  {err&&<p className="zb-err" role="alert">{err}</p>}{flash&&<p className="zb-flash" role="status">{flash}</p>}
  <div className="zn-crm-stats">
   <div><small>Overdue</small><b className={overdue.length?'zb-out':''}>{overdue.length}</b><span>{overdue.length?sums(sumBy(overdue)):'All caught up'}</span></div>
   <div><small>Due this month</small><b>{sums(sumBy(dueMonth))}</b><span>{dueMonth.length} bills</span></div>
   <div><small>Repeating, per month</small><b>{sums(monthly)}</b><span>{(bills??[]).filter(b=>b.repeat!=='none').length} subscriptions and fixed costs</span></div>
  </div>
  <div className="zb-bills">
   {bills===null?<p className="zn-note">Loading…</p>:!bills.length?<div className="zn-card zb-empty"><Repeat size={22}/><b>No bills yet</b><p className="zn-note">Add rent, salaries, software and anything else you pay. Repeating bills roll to the next date when you pay them.</p><button type="button" className="zn-btn is-primary" onClick={()=>setEdit('new')}><Plus size={15}/>Add bill</button></div>:<>
    {group('Overdue',overdue)}{group('Due in the next 7 days',soon)}{group('Coming up',later)}{group('Paid one-off bills',done)}</>}
  </div>
  {edit&&<BillDialog bill={edit==='new'?null:edit} onClose={()=>setEdit(null)} onDone={()=>{setEdit(null);void load();}}/>}
  {pay&&<PayDialog bill={pay} onClose={()=>setPay(null)} onDone={next=>{setPay(null);setFlash(next?`Paid and logged in Money. Next due ${fmtDay(next)}.`:'Paid and logged in Money.');void load();}}/>}
 </div></div>;
}

function BillDialog({bill,onClose,onDone}:{bill:Bill|null;onClose:()=>void;onDone:()=>void}){
 const [v,setV]=useState({title:bill?.title??'',vendor:bill?.vendor??'',amount:bill?String(bill.amount):'',currency:bill?.currency??'NGN',category:bill?.category??'',due_on:bill?.due_on??lagosToday(),repeat:(bill?.repeat??'monthly') as BillRepeat,note:bill?.note??''});
 const [busy,setBusy]=useState(false),[err,setErr]=useState('');
 const f=(k:keyof typeof v)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>setV(x=>({...x,[k]:e.target.value}));
 async function save(e:React.FormEvent){e.preventDefault();setErr('');setBusy(true);
  try{await bizApi({action:'bill_save',...(bill?{id:bill.id}:{}),...v,amount:Number(v.amount.replace(/,/g,'')),due_on:v.due_on||null});onDone();}catch(x){setErr((x as Error).message);setBusy(false);}}
 return <Modal title={bill?'Edit bill':'Add a bill'} onClose={onClose}><form className="zn-modal-body" onSubmit={save}>
  <label className="zn-label">Bill<input className="zn-input" value={v.title} maxLength={160} onChange={f('title')} placeholder="e.g. Office rent" autoFocus/></label>
  <div className="zn-form-row"><label className="zn-label">Amount<input className="zn-input" inputMode="decimal" value={v.amount} onChange={f('amount')} placeholder="0"/></label>
   <label className="zn-label">Currency<select className="zn-input" value={v.currency} onChange={f('currency')}>{currencies.map(c=><option key={c}>{c}</option>)}</select></label></div>
  <div className="zn-form-row"><label className="zn-label">Next due<input className="zn-input" type="date" value={v.due_on} onChange={f('due_on')}/></label>
   <label className="zn-label">Repeats<select className="zn-input" value={v.repeat} onChange={f('repeat')}>{billRepeats.map(r=><option key={r} value={r}>{repeatName[r]}</option>)}</select></label></div>
  <div className="zn-form-row"><label className="zn-label">Paid to<input className="zn-input" value={v.vendor} maxLength={160} onChange={f('vendor')} placeholder="Vendor or person"/></label>
   <label className="zn-label">Category<select className="zn-input" value={v.category} onChange={f('category')}><option value="">Choose</option>{outCategories.map(c=><option key={c}>{c}</option>)}</select></label></div>
  <label className="zn-label">Note <small>optional, e.g. account details</small><input className="zn-input" value={v.note} maxLength={2000} onChange={f('note')}/></label>
  {err&&<p className="zb-err" role="alert">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="submit" className="zn-btn is-primary" disabled={busy}>{busy?'Saving…':'Save'}</button></div>
 </form></Modal>;
}

function PayDialog({bill,onClose,onDone}:{bill:Bill;onClose:()=>void;onDone:(next:string|null)=>void}){
 const [amount,setAmount]=useState(String(bill.amount)),[paid,setPaid]=useState(lagosToday()),[note,setNote]=useState(''),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 async function save(e:React.FormEvent){e.preventDefault();setErr('');setBusy(true);
  const f=new FormData();Object.entries({kind:'pay_bill',bill_id:bill.id,amount:amount.replace(/,/g,''),paid_on:paid,note}).forEach(([k,v])=>f.append(k,v));if(file)f.append('file',file);
  const r=await fetch('/api/zarn/biz/file',{method:'POST',body:f}).catch(()=>null);const j=await r?.json().catch(()=>({}));
  if(!r?.ok){setErr(j?.error||'Could not save.');setBusy(false);return;}onDone(j.next??null);}
 return <Modal title={`Pay ${bill.title}`} onClose={onClose}><form className="zn-modal-body" onSubmit={save}>
  <p className="zn-note">Record the payment once the money has gone out. It’s logged in Money{bill.repeat!=='none'?' and the bill moves to its next date':''}.</p>
  <div className="zn-form-row"><label className="zn-label">Amount ({bill.currency})<input className="zn-input" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   <label className="zn-label">Paid on<input className="zn-input" type="date" value={paid} onChange={e=>setPaid(e.target.value)}/></label></div>
  <label className="zn-label">Note <small>optional</small><input className="zn-input" value={note} maxLength={2000} onChange={e=>setNote(e.target.value)} placeholder="e.g. transfer reference"/></label>
  <label className="zb-drop"><input type="file" accept="image/*,application/pdf" onChange={e=>setFile(e.target.files?.[0]??null)}/><Paperclip size={16}/>{file?file.name:'Attach the receipt (optional)'}</label>
  {err&&<p className="zb-err" role="alert">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="submit" className="zn-btn is-primary" disabled={busy}>{busy?'Saving…':'Mark as paid'}</button></div>
 </form></Modal>;
}
