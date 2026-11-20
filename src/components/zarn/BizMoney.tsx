'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowDownLeft,ArrowUpRight,Download,FileText,Paperclip,Pencil,Plus,Receipt,Trash2,Wallet} from 'lucide-react';
import {money,currencies} from '@/lib/crm';
import {inCategories,outCategories,sumBy,monthKey,monthName,csv,type Entry} from '@/lib/biz';
import {lagosToday,fmtDay} from '@/lib/zarn-care';
import {Modal} from './Dialogs';
import {useConfirm} from './ConfirmProvider';

type Row=Entry&{counted?:boolean};
export const bizApi=async<T=Record<string,unknown>>(body:object):Promise<T>=>{const r=await fetch('/api/zarn/biz',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;};
export const sums=(m:Record<string,number>)=>Object.keys(m).length?Object.entries(m).map(([c,v])=>money(v,c)).join(' · '):money(0,'NGN');
const yearAgo=()=>{const d=new Date();d.setMonth(d.getMonth()-11,1);return d.toISOString().slice(0,8)+'01';};

// The money book (every naira in and out) and the receipt holder are one list seen two ways.
export default function BizMoney({mode}:{mode:'money'|'receipts'}){
 const confirm=useConfirm();
 const [rows,setRows]=useState<Row[]|null>(null),[clients,setClients]=useState<{id:string;name:string}[]>([]),[err,setErr]=useState('');
 const [month,setMonth]=useState(monthKey(lagosToday())),[dir,setDir]=useState<'all'|'in'|'out'>('all'),[noFile,setNoFile]=useState(false);
 const [edit,setEdit]=useState<Row|'in'|'out'|null>(null);
 const load=useCallback(async()=>{try{const d=await bizApi<{entries:Row[];clients:{id:string;name:string}[]}>({action:'money',from:yearAgo()});setRows(d.entries);setClients(d.clients);setErr('');}catch(e){setErr((e as Error).message);setRows([]);}},[]);
 useEffect(()=>{void (async()=>{await load();})();},[load]);
 const months=useMemo(()=>{const s=new Set<string>([monthKey(lagosToday())]);for(const r of rows??[])s.add(monthKey(r.paid_on));return [...s].sort().reverse();},[rows]);
 const inMonth=useMemo(()=>(rows??[]).filter(r=>month==='year'||monthKey(r.paid_on)===month),[rows,month]);
 const counted=inMonth.filter(r=>r.counted!==false);
 const ins=sumBy(counted.filter(r=>r.direction==='in')),outs=sumBy(counted.filter(r=>r.direction==='out'));
 const net:Record<string,number>={};for(const c of new Set([...Object.keys(ins),...Object.keys(outs)]))net[c]=(ins[c]??0)-(outs[c]??0);
 const cats=(()=>{const m=new Map<string,{amount:number;currency:string}[]>();for(const r of counted.filter(x=>x.direction==='out')){const k=r.category||'Uncategorised';m.set(k,[...(m.get(k)??[]),r]);}
  return [...m.entries()].map(([k,v])=>({k,sum:sumBy(v),n:v.reduce((a,b)=>a+Number(b.amount),0)})).sort((a,b)=>b.n-a.n);})();
 const maxCat=Math.max(1,...cats.map(c=>c.n));
 let list=inMonth.filter(r=>dir==='all'||r.direction===dir);
 if(mode==='receipts')list=list.filter(r=>r.source!=='invoice'&&(noFile?!r.file_name:!!r.file_name));
 async function remove(r:Row){if(!await confirm({title:'Delete this entry?',message:r.file_name?'The receipt file is deleted too.':'This can’t be undone.',confirm:'Delete',danger:true}))return;
  try{await bizApi({action:'entry_delete',id:r.id});void load();}catch(e){setErr((e as Error).message);}}
 function exportCsv(){const out=csv([['Date','Direction','Title','Category','Client','Vendor or payer','Amount','Currency','Note','Receipt'],...list.map(r=>[r.paid_on,r.direction==='in'?'In':'Out',r.title,r.category,r.client??'',r.vendor,r.amount,r.currency,r.note,r.file_name])]);
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([out],{type:'text/csv'}));a.download=`zarn-${mode}-${month}.csv`;a.click();URL.revokeObjectURL(a.href);}
 return <div className="zn-page"><div className="zn-scroll" data-lenis-prevent>
  <header className="zn-page-head zb-head"><div><h1>{mode==='money'?<><Wallet size={20}/>Money</>:<><Receipt size={20}/>Receipts</>}</h1><p>{mode==='money'?'Everything that came in and went out, with invoice payments included.':'Every receipt in one place. Add one with a photo or PDF.'}</p></div>
   <div className="zb-acts">
    <select className="zn-input zb-month" value={month} onChange={e=>setMonth(e.target.value)} aria-label="Period">{months.map(m=><option key={m} value={m}>{monthName(m)}</option>)}<option value="year">Last 12 months</option></select>
    <button type="button" className="zn-btn" onClick={exportCsv} disabled={!list.length}><Download size={15}/>CSV</button>
    {mode==='money'&&<button type="button" className="zn-btn" onClick={()=>setEdit('in')}><ArrowDownLeft size={15}/>Money in</button>}
    <button type="button" className="zn-btn is-primary" onClick={()=>setEdit('out')}><Plus size={15}/>{mode==='money'?'Money out':'Add receipt'}</button>
   </div></header>
  {err&&<p className="zb-err" role="alert">{err}</p>}
  {mode==='money'&&<div className="zn-crm-stats">
   <div><small>Money in</small><b className="zb-in">{sums(ins)}</b><span>{counted.filter(r=>r.direction==='in').length} payments</span></div>
   <div><small>Money out</small><b className="zb-out">{sums(outs)}</b><span>{counted.filter(r=>r.direction==='out').length} expenses</span></div>
   <div><small>Net</small><b>{sums(net)}</b><span>{month==='year'?'last 12 months':monthName(month)}</span></div>
   <div><small>Receipts missing</small><b>{inMonth.filter(r=>r.direction==='out'&&!r.file_name).length}</b><span><Link href="/zarn/business/receipts">Open receipts</Link></span></div>
  </div>}
  <div className={mode==='money'?'zb-grid':'zb-grid is-one'}>
   <section className="zn-card zb-list-card">
    <div className="zb-filter">
     {(['all','in','out'] as const).map(d=><button key={d} type="button" className={dir===d?'is-on':''} onClick={()=>setDir(d)}>{d==='all'?'All':d==='in'?'Money in':'Money out'}</button>)}
     {mode==='receipts'&&<label className="zb-check"><input type="checkbox" checked={noFile} onChange={e=>setNoFile(e.target.checked)}/>Missing a receipt</label>}
    </div>
    {rows===null?<p className="zn-note">Loading…</p>:!list.length?<p className="zn-note">{mode==='receipts'?(noFile?'Every entry here has its receipt.':'No receipts for this period yet.'):'Nothing recorded for this period yet.'}</p>:
     <ul className="zb-rows">{list.map(r=><li key={`${r.source}-${r.id}`} className={r.counted===false?'is-dim':''}>
      <span className={`zb-dir is-${r.direction}`}>{r.direction==='in'?<ArrowDownLeft size={15}/>:<ArrowUpRight size={15}/>}</span>
      <span className="zb-main"><b>{r.title}</b><small>{[fmtDay(r.paid_on),r.category,r.client,r.vendor].filter(Boolean).join(' · ')}{r.counted===false?' · counted in its invoice':''}</small></span>
      <span className={`zb-amt is-${r.direction}`}>{r.direction==='in'?'+':'−'}{money(r.amount,r.currency)}</span>
      <span className="zb-row-acts">
       {r.file_name?<a href={`/api/zarn/biz/file?id=${r.id}`} target="_blank" rel="noreferrer" className="zb-ic" aria-label={`Open ${r.file_name}`} data-tip={r.file_name}><Paperclip size={15}/></a>:r.source==='invoice'?<Link href={`/zarn/business/invoices/${r.invoice_id}`} className="zb-ic" aria-label="Open invoice" data-tip="Open invoice"><FileText size={15}/></Link>:null}
       {r.source!=='invoice'&&<><button type="button" className="zb-ic" aria-label="Edit" data-tip="Edit" onClick={()=>setEdit(r)}><Pencil size={15}/></button>
        <button type="button" className="zb-ic" aria-label="Delete" data-tip="Delete" onClick={()=>void remove(r)}><Trash2 size={15}/></button></>}
      </span></li>)}</ul>}
   </section>
   {mode==='money'&&<section className="zn-card"><h3>Where the money went</h3>
    {cats.length?<div className="zb-cats">{cats.map(c=><div key={c.k}><span><b>{c.k}</b><small>{sums(c.sum)}</small></span><i><em style={{width:`${Math.max(4,c.n/maxCat*100)}%`}}/></i></div>)}</div>:<p className="zn-note">No spending recorded for this period.</p>}
   </section>}
  </div>
  {edit&&<EntryDialog entry={typeof edit==='string'?null:edit} direction={typeof edit==='string'?edit:edit.direction} clients={clients} receipt={mode==='receipts'} onClose={()=>setEdit(null)} onDone={()=>{setEdit(null);void load();}}/>}
 </div></div>;
}

function EntryDialog({entry,direction:d0,clients,receipt,onClose,onDone}:{entry:Row|null;direction:'in'|'out';clients:{id:string;name:string}[];receipt:boolean;onClose:()=>void;onDone:()=>void}){
 const [direction,setDirection]=useState(d0),[title,setTitle]=useState(entry?.title??''),[amount,setAmount]=useState(entry?String(entry.amount):''),[currency,setCurrency]=useState(entry?.currency??'NGN');
 const [paid,setPaid]=useState(entry?.paid_on??lagosToday()),[category,setCategory]=useState(entry?.category??''),[vendor,setVendor]=useState(entry?.vendor??''),[lead,setLead]=useState(entry?.lead_id??''),[note,setNote]=useState(entry?.note??'');
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const cats=direction==='in'?inCategories:outCategories;
 async function save(e:React.FormEvent){e.preventDefault();setErr('');const n=Number(amount.replace(/,/g,''));
  if(!title.trim())return setErr('Say what it was for.');if(!(n>0))return setErr('Enter the amount.');setBusy(true);
  try{
   if(entry)await bizApi({action:'entry_update',id:entry.id,title,amount:n,currency,paid_on:paid,category,vendor,note});
   else{const f=new FormData();Object.entries({direction,title,amount:String(n),currency,paid_on:paid,category,vendor,note,lead_id:lead}).forEach(([k,v])=>f.append(k,v));if(file)f.append('file',file);
    const r=await fetch('/api/zarn/biz/file',{method:'POST',body:f});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Could not save.');}
   onDone();
  }catch(x){setErr((x as Error).message);setBusy(false);}}
 return <Modal title={entry?'Edit entry':receipt?'Add a receipt':direction==='in'?'Money in':'Money out'} onClose={onClose}>
  <form className="zn-modal-body" onSubmit={save}>
   {!entry&&<div className="zb-seg"><button type="button" className={direction==='out'?'is-on':''} onClick={()=>{setDirection('out');setCategory('');}}><ArrowUpRight size={15}/>We paid</button><button type="button" className={direction==='in'?'is-on':''} onClick={()=>{setDirection('in');setCategory('');}}><ArrowDownLeft size={15}/>We were paid</button></div>}
   <label className="zn-label">What for<input className="zn-input" value={title} maxLength={160} onChange={e=>setTitle(e.target.value)} placeholder={direction==='in'?'e.g. Website deposit':'e.g. Figma subscription'} autoFocus/></label>
   <div className="zn-form-row"><label className="zn-label">Amount<input className="zn-input" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></label>
    <label className="zn-label">Currency<select className="zn-input" value={currency} onChange={e=>setCurrency(e.target.value)}>{currencies.map(c=><option key={c}>{c}</option>)}</select></label></div>
   <div className="zn-form-row"><label className="zn-label">Date<input className="zn-input" type="date" value={paid} onChange={e=>setPaid(e.target.value)}/></label>
    <label className="zn-label">Category<select className="zn-input" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Choose</option>{[...new Set([...cats,...(category?[category]:[])])].map(c=><option key={c}>{c}</option>)}</select></label></div>
   <div className="zn-form-row"><label className="zn-label">{direction==='in'?'Paid by':'Paid to'}<input className="zn-input" value={vendor} maxLength={160} onChange={e=>setVendor(e.target.value)} placeholder={direction==='in'?'Who paid':'Vendor or person'}/></label>
    {!entry&&<label className="zn-label">Client <small>optional</small><select className="zn-input" value={lead} onChange={e=>setLead(e.target.value)}><option value="">None</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}</div>
   <label className="zn-label">Note <small>optional</small><input className="zn-input" value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/></label>
   {!entry&&<label className="zb-drop"><input type="file" accept="image/*,application/pdf" onChange={e=>setFile(e.target.files?.[0]??null)}/><Paperclip size={16}/>{file?file.name:'Attach the receipt (photo or PDF, up to 8 MB)'}</label>}
   {err&&<p className="zb-err" role="alert">{err}</p>}
   <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="submit" className="zn-btn is-primary" disabled={busy}>{busy?'Saving…':'Save'}</button></div>
  </form></Modal>;
}
