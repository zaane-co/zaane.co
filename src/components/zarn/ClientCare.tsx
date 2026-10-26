'use client';
import {useCallback,useEffect,useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,Bell,ChevronDown,FileText,Mail,PackageCheck,Paperclip,Pencil,Plus,ReceiptText,Trash2,User,Users} from 'lucide-react';
import Dropdown from '@/components/ui/Dropdown';
import {currencies,money} from '@/lib/crm';
import {deliverableRepeats,dueText,dueTone,fmtDay,reminderRepeats,repeatLabel,repeatOption,type Repeat} from '@/lib/zarn-care';
import {useZarn} from './ZarnProvider';
import {useConfirm} from './ConfirmProvider';
import {Modal} from './Dialogs';

type Reminder={id:string;title:string;note:string;repeat:Repeat;every_n:number;start_on:string;next_on:string|null;audience:'team'|'me';email:boolean;created_by:string|null};
type Deliverable={id:string;title:string;note:string;repeat:Repeat;every_n:number;start_on:string|null;next_on:string|null;created_by:string|null};
type Delivery={id:string;deliverable_id:string;due_on:string|null;delivered_on:string;note:string;file_name:string;file_size:number;delivered_by:string|null};
type Receipt={id:string;direction:'in'|'out';title:string;amount:number;currency:string;paid_on:string;invoice_id:string|null;note:string;file_name:string;file_size:number;file_type:string;created_by:string|null};
type Care={today:string;admin:boolean;me:string;reminders:Reminder[];deliverables:Deliverable[];log:Delivery[];receipts:Receipt[]|null;invoices:{id:string;number:string}[]|null};
const api=async(body:object)=>{const r=await fetch('/api/zarn/care',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;};
const upload=async(form:FormData)=>{const r=await fetch('/api/zarn/care/file',{method:'POST',body:form});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Could not save.');};
const toneColor={late:'#dc2626',today:'#d97706',later:'#52525b',none:'#52525b'};

function useCare(leadId:string){
 const [data,setData]=useState<Care|null>(null),[err,setErr]=useState('');
 const load=useCallback(async()=>{try{setData(await api({action:'list',lead_id:leadId}));setErr('');}catch(e){setErr(e instanceof Error?e.message:'Could not load.');}},[leadId]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves, not synchronously
 useEffect(()=>{void load();},[load]);
 return {data,err,setErr,load};
}
function Due({d,today}:{d:string|null;today:string}){return <span className="zn-stage" style={{background:toneColor[dueTone(d,today)]}}>{dueText(d,today)}</span>;}

// Reminders: a nudge on a date, once or on repeat (e.g. restart their Supabase every week, chase the monthly payment).
export function ClientReminders({leadId}:{leadId:string}){
 const {data,err,setErr,load}=useCare(leadId),{people}=useZarn(),confirm=useConfirm();
 const [editing,setEditing]=useState<Reminder|'new'|null>(null);
 async function remove(r:Reminder){
  if(!await confirm({title:`Delete “${r.title}”?`,message:'The reminder stops for everyone on this client.',confirm:'Delete',danger:true}))return;
  try{await api({action:'reminder_delete',id:r.id});void load();}catch(e){setErr(e instanceof Error?e.message:'Could not delete it.');}
 }
 const active=data?.reminders.filter(r=>r.next_on)??[],finished=data?.reminders.filter(r=>!r.next_on)??[];
 return <div className="zn-pane"><div className="zn-pane-inner">
  <div className="zn-card-head"><h3><Bell size={15}/> Reminders</h3><button type="button" className="zn-btn is-primary" onClick={()=>setEditing('new')}><Plus size={14}/>New reminder</button></div>
  <p className="zn-note">On the day, the team gets an email and a pop-up in ZARN.</p>
  {err&&<p className="zn-error" role="alert">{err}</p>}
  {!data?<p className="zn-loading">Loading…</p>:data.reminders.length?<>
   <ul className="zn-rows">{active.map(r=><li key={r.id}>
    <Bell size={15} className="zc-ico"/>
    <span><b>{r.title}</b><small>{repeatLabel(r.repeat,r.every_n)}{r.note?` · ${r.note}`:''}</small></span>
    <span className="zc-flags">{r.audience==='me'?<span data-tip="Only you"><User size={13}/></span>:<span data-tip="Whole client team"><Users size={13}/></span>}{r.email&&<span data-tip="Also emailed"><Mail size={13}/></span>}</span>
    <Due d={r.next_on} today={data.today}/>
    <span className="zc-actions"><button type="button" aria-label="Edit" data-tip="Edit" onClick={()=>setEditing(r)}><Pencil size={14}/></button><button type="button" aria-label="Delete" data-tip="Delete" className="is-danger" onClick={()=>void remove(r)}><Trash2 size={14}/></button></span>
   </li>)}</ul>
   {finished.length>0&&<><p className="zn-section-label">Done</p><ul className="zn-rows zc-done">{finished.map(r=><li key={r.id}><span><b>{r.title}</b><small>Was due {fmtDay(r.start_on)}{r.created_by?` · set by ${people[r.created_by]?.display_name??'someone'}`:''}</small></span><span className="zc-actions"><button type="button" aria-label="Set again" data-tip="Set again" onClick={()=>setEditing(r)}><Pencil size={14}/></button><button type="button" aria-label="Delete" data-tip="Delete" className="is-danger" onClick={()=>void remove(r)}><Trash2 size={14}/></button></span></li>)}</ul></>}
  </>:<div className="zn-empty-state"><Bell size={26}/><h2>No reminders yet</h2><p>Set reminders for things that come round, like restarting their Supabase every week or reminding them a payment is due each month.</p></div>}
  {editing&&data&&<ReminderForm leadId={leadId} today={data.today} item={editing==='new'?null:editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);void load();}}/>}
 </div></div>;
}

function RepeatFields({repeat,setRepeat,n,setN,options,deliverable}:{repeat:Repeat;setRepeat:(r:Repeat)=>void;n:number;setN:(n:number)=>void;options:Repeat[];deliverable?:boolean}){
 return <div className="zc-two">
  <label className="zn-label">{deliverable?'Schedule':'Repeat'}<Dropdown label="Repeat" value={repeat} onChange={v=>setRepeat(v as Repeat)} options={options.map(r=>({value:r,label:repeatOption(r,deliverable)}))}/></label>
  {repeat==='every_n'&&<label className="zn-label">Every how many days<input className="zn-input" type="number" min={1} max={365} required value={n} onChange={e=>setN(Math.max(1,Math.min(365,Number(e.target.value)||1)))}/></label>}
 </div>;
}

function ReminderForm({leadId,today,item,onClose,onSaved}:{leadId:string;today:string;item:Reminder|null;onClose:()=>void;onSaved:()=>void}){
 const [title,setTitle]=useState(item?.title??''),[note,setNote]=useState(item?.note??''),[repeat,setRepeat]=useState<Repeat>(item?.repeat??'none'),[n,setN]=useState(item?.every_n??14);
 const [start,setStart]=useState(item?.next_on??item?.start_on??today),[audience,setAudience]=useState<'team'|'me'>(item?.audience??'team'),[email,setEmail]=useState(item?.email??true);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{await api({action:'reminder_save',lead_id:leadId,...(item?{id:item.id}:{}),title,note,repeat,every_n:n,start_on:start,audience,email});onSaved();}
  catch(err){setError(err instanceof Error?err.message:'Could not save.');setBusy(false);}
 }
 return <Modal title={item?'Edit reminder':'New reminder'} onClose={onClose}><form className="zn-modal-body" onSubmit={save}>
  <label className="zn-label">Remind us to<input className="zn-input" autoFocus required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Restart their Supabase project, Tell them hosting is due"/></label>
  <RepeatFields repeat={repeat} setRepeat={setRepeat} n={n} setN={setN} options={reminderRepeats}/>
  <label className="zn-label">{repeat==='none'?'On':'Starting'}<input className="zn-input" type="date" required value={start} onChange={e=>setStart(e.target.value)}/></label>
  <div className="zn-label">Who gets it<div className="zv-kinds" role="radiogroup" aria-label="Who gets it">
   <button type="button" role="radio" aria-checked={audience==='team'} className={audience==='team'?'is-on':''} onClick={()=>setAudience('team')}><Users size={14}/>Client team</button>
   <button type="button" role="radio" aria-checked={audience==='me'} className={audience==='me'?'is-on':''} onClick={()=>setAudience('me')}><User size={14}/>Only me</button>
  </div></div>
  <label className="zc-check"><input type="checkbox" checked={email} onChange={e=>setEmail(e.target.checked)}/>Email it too, not just the pop-up in ZARN</label>
  <label className="zn-label">Note (optional)<textarea className="zn-input" rows={2} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Steps, links, what to say…"/></label>
  {error&&<p className="zn-error" role="alert">{error}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy||!title.trim()}>{busy?'Saving…':'Save'}</button></div>
 </form></Modal>;
}

// Deliverables: what we hand over to the client on a schedule (monthly, every few days, one date or ad hoc), with a delivery history.
export function ClientDeliverables({leadId}:{leadId:string}){
 const {data,err,setErr,load}=useCare(leadId),{people,me}=useZarn(),confirm=useConfirm();
 const [editing,setEditing]=useState<Deliverable|'new'|null>(null),[delivering,setDelivering]=useState<Deliverable|null>(null),[open,setOpen]=useState<string|null>(null);
 async function remove(d:Deliverable){
  if(!await confirm({title:`Delete “${d.title}”?`,message:'Its delivery history and files are deleted too. This can’t be undone.',confirm:'Delete',danger:true}))return;
  try{await api({action:'deliverable_delete',id:d.id});void load();}catch(e){setErr(e instanceof Error?e.message:'Could not delete it.');}
 }
 async function removeDelivery(x:Delivery){
  if(!await confirm({title:'Remove this delivery?',message:'It comes off the history. The due date doesn’t change back.',confirm:'Remove',danger:true}))return;
  try{await api({action:'delivery_delete',id:x.id});void load();}catch(e){setErr(e instanceof Error?e.message:'Could not remove it.');}
 }
 return <div className="zn-pane"><div className="zn-pane-inner">
  <div className="zn-card-head"><h3><PackageCheck size={15}/> Deliverables</h3><button type="button" className="zn-btn is-primary" onClick={()=>setEditing('new')}><Plus size={14}/>New deliverable</button></div>
  <p className="zn-note">What we deliver to this client and how often. The team is reminded when one is due, and marking it delivered moves it to the next date.</p>
  {err&&<p className="zn-error" role="alert">{err}</p>}
  {!data?<p className="zn-loading">Loading…</p>:data.deliverables.length?<ul className="zc-list">{data.deliverables.map(d=>{
   const hist=data.log.filter(l=>l.deliverable_id===d.id),last=hist[0];
   return <li key={d.id} className="zn-card">
    <div className="zc-head">
     <PackageCheck size={16} className="zc-ico"/>
     <span className="zc-title"><b>{d.title}</b><small>{repeatLabel(d.repeat,d.every_n,true)}{last?` · last delivered ${fmtDay(last.delivered_on)}`:''}</small></span>
     {d.repeat==='adhoc'?<span className="zn-stage" style={{background:'#52525b'}}>Ad hoc</span>:d.next_on?<Due d={d.next_on} today={data.today}/>:<span className="zn-stage" style={{background:'#16a34a'}}>Delivered</span>}
     <button type="button" className="zn-btn" onClick={()=>setDelivering(d)}><PackageCheck size={14}/>Mark delivered</button>
     <span className="zc-actions"><button type="button" aria-label="Edit" data-tip="Edit" onClick={()=>setEditing(d)}><Pencil size={14}/></button><button type="button" aria-label="Delete" data-tip="Delete" className="is-danger" onClick={()=>void remove(d)}><Trash2 size={14}/></button></span>
    </div>
    {d.note&&<p className="zn-note">{d.note}</p>}
    {hist.length>0&&<button type="button" className="zc-toggle" aria-expanded={open===d.id} onClick={()=>setOpen(o=>o===d.id?null:d.id)}><ChevronDown size={14}/>{hist.length} deliver{hist.length===1?'y':'ies'}</button>}
    {open===d.id&&<ol className="zc-history">{hist.map(x=><li key={x.id}>
     <time>{fmtDay(x.delivered_on)}</time>
     <span><b>{x.delivered_by?people[x.delivered_by]?.display_name??'Former member':'Someone'}</b>{x.due_on&&x.due_on!==x.delivered_on?<small> (was due {fmtDay(x.due_on)})</small>:null}{x.note&&<p>{x.note}</p>}</span>
     {x.file_name&&<a href={`/api/zarn/care/file?kind=delivery&id=${x.id}`} target="_blank" rel="noopener noreferrer"><Paperclip size={13}/>{x.file_name}</a>}
     {(x.delivered_by===me.user_id||data.admin)&&<button type="button" aria-label="Remove" data-tip="Remove" className="is-danger" onClick={()=>void removeDelivery(x)}><Trash2 size={13}/></button>}
    </li>)}</ol>}
   </li>;})}</ul>
   :<div className="zn-empty-state"><PackageCheck size={26}/><h2>No deliverables yet</h2><p>Add what you hand over regularly, like a monthly report, four social posts a week or a quarterly backup.</p></div>}
  {editing&&data&&<DeliverableForm leadId={leadId} today={data.today} item={editing==='new'?null:editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);void load();}}/>}
  {delivering&&data&&<DeliverForm item={delivering} today={data.today} onClose={()=>setDelivering(null)} onSaved={()=>{setOpen(delivering.id);setDelivering(null);void load();}}/>}
 </div></div>;
}

function DeliverableForm({leadId,today,item,onClose,onSaved}:{leadId:string;today:string;item:Deliverable|null;onClose:()=>void;onSaved:()=>void}){
 const [title,setTitle]=useState(item?.title??''),[note,setNote]=useState(item?.note??''),[repeat,setRepeat]=useState<Repeat>(item?.repeat??'monthly'),[n,setN]=useState(item?.every_n??14);
 const [start,setStart]=useState(item?.start_on??today),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{await api({action:'deliverable_save',lead_id:leadId,...(item?{id:item.id}:{}),title,note,repeat,every_n:n,start_on:repeat==='adhoc'?null:start});onSaved();}
  catch(err){setError(err instanceof Error?err.message:'Could not save.');setBusy(false);}
 }
 return <Modal title={item?'Edit deliverable':'New deliverable'} onClose={onClose}><form className="zn-modal-body" onSubmit={save}>
  <label className="zn-label">What we deliver<input className="zn-input" autoFocus required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Monthly analytics report, 4 Instagram posts"/></label>
  <RepeatFields repeat={repeat} setRepeat={setRepeat} n={n} setN={setN} options={deliverableRepeats} deliverable/>
  {repeat!=='adhoc'&&<label className="zn-label">{repeat==='none'?'Due on':'First due'}<input className="zn-input" type="date" required value={start} onChange={e=>setStart(e.target.value)}/></label>}
  <label className="zn-label">Details (optional)<textarea className="zn-input" rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="What's included, where it goes, who signs off…"/></label>
  {error&&<p className="zn-error" role="alert">{error}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy||!title.trim()}>{busy?'Saving…':'Save'}</button></div>
 </form></Modal>;
}

function DeliverForm({item,today,onClose,onSaved}:{item:Deliverable;today:string;onClose:()=>void;onSaved:()=>void}){
 const [on,setOn]=useState(today),[note,setNote]=useState(''),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  const form=new FormData();form.set('kind','delivery');form.set('deliverable_id',item.id);form.set('delivered_on',on);form.set('note',note);if(file)form.set('file',file);
  try{await upload(form);onSaved();}catch(err){setError(err instanceof Error?err.message:'Could not save.');setBusy(false);}
 }
 return <Modal title={`Delivered: ${item.title}`} onClose={onClose}><form className="zn-modal-body" onSubmit={save}>
  {item.next_on&&<p className="zn-note">This one was due {fmtDay(item.next_on)}.{item.repeat!=='none'&&item.repeat!=='adhoc'?' It moves to the next date once you save.':''}</p>}
  <label className="zn-label">Delivered on<input className="zn-input" type="date" required value={on} max={today} onChange={e=>setOn(e.target.value)}/></label>
  <label className="zn-label">Note (optional)<textarea className="zn-input" rows={2} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Link, what was sent, any feedback…"/></label>
  <label className="zn-label">File (optional, up to 4 MB)<input className="zn-input" type="file" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
  {error&&<p className="zn-error" role="alert">{error}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy}>{busy?'Saving…':'Mark delivered'}</button></div>
 </form></Modal>;
}

// Receipts: proof of money in (the client paid us) and out (we paid something for them). Admins only.
export function ClientReceipts({leadId,currency}:{leadId:string;currency:string}){
 const {data,err,setErr,load}=useCare(leadId),confirm=useConfirm();
 const [adding,setAdding]=useState(false),[filter,setFilter]=useState<'all'|'in'|'out'>('all');
 async function remove(r:Receipt){
  if(!await confirm({title:`Delete “${r.title}”?`,message:'The receipt and its file are deleted. This can’t be undone.',confirm:'Delete',danger:true}))return;
  try{await api({action:'receipt_delete',id:r.id});void load();}catch(e){setErr(e instanceof Error?e.message:'Could not delete it.');}
 }
 const list=data?.receipts??[],shown=list.filter(r=>filter==='all'||r.direction===filter);
 const totals=(dir:'in'|'out')=>{const m=new Map<string,number>();for(const r of list)if(r.direction===dir)m.set(r.currency,(m.get(r.currency)??0)+Number(r.amount));return [...m].map(([c,v])=>money(v,c)).join(' + ')||money(0,currency);};
 const invNo=(id:string|null)=>id?data?.invoices?.find(i=>i.id===id)?.number:null;
 return <div className="zn-pane"><div className="zn-pane-inner">
  <div className="zn-card-head"><h3><ReceiptText size={15}/> Receipts</h3><button type="button" className="zn-btn is-primary" onClick={()=>setAdding(true)}><Plus size={14}/>Add receipt</button></div>
  <p className="zn-note">Only admins can see this tab.</p>
  {err&&<p className="zn-error" role="alert">{err}</p>}
  {!data?<p className="zn-loading">Loading…</p>:<>
   <div className="zc-totals"><div><small><ArrowDownLeft size={13}/>Client paid us</small><b>{totals('in')}</b></div><div><small><ArrowUpRight size={13}/>We paid for client</small><b>{totals('out')}</b></div></div>
   {list.length>0&&<div className="zv-kinds" role="radiogroup" aria-label="Show">{([['all','All'],['in','Client paid us'],['out','We paid']] as const).map(([k,l])=><button key={k} type="button" role="radio" aria-checked={filter===k} className={filter===k?'is-on':''} onClick={()=>setFilter(k)}>{l}</button>)}</div>}
   {shown.length?<ul className="zn-rows">{shown.map(r=><li key={r.id}>
    <span className="zn-stage" style={{background:r.direction==='in'?'#16a34a':'#ea580c'}}>{r.direction==='in'?'Client paid':'We paid'}</span>
    <span><b>{r.title}</b><small>{fmtDay(r.paid_on)}{invNo(r.invoice_id)?` · Invoice ${invNo(r.invoice_id)}`:''}{r.note?` · ${r.note}`:''}</small></span>
    <b>{money(Number(r.amount),r.currency)}</b>
    {r.file_name?<a href={`/api/zarn/care/file?kind=receipt&id=${r.id}`} target="_blank" rel="noopener noreferrer" data-tip={r.file_name}><FileText size={14}/>Receipt</a>:<small>No file</small>}
    <span className="zc-actions"><button type="button" aria-label="Delete" data-tip="Delete" className="is-danger" onClick={()=>void remove(r)}><Trash2 size={14}/></button></span>
   </li>)}</ul>:list.length?<p className="zn-note">Nothing here for this filter.</p>
    :<div className="zn-empty-state"><ReceiptText size={26}/><h2>No receipts yet</h2><p>Upload proof of payments from this client, and anything we paid on their behalf like hosting, domains or subscriptions.</p></div>}
  </>}
  {adding&&data&&<ReceiptForm leadId={leadId} today={data.today} currency={currency} invoices={data.invoices??[]} onClose={()=>setAdding(false)} onSaved={()=>{setAdding(false);void load();}}/>}
 </div></div>;
}

function ReceiptForm({leadId,today,currency,invoices,onClose,onSaved}:{leadId:string;today:string;currency:string;invoices:{id:string;number:string}[];onClose:()=>void;onSaved:()=>void}){
 const [dir,setDir]=useState<'in'|'out'>('in'),[title,setTitle]=useState(''),[amount,setAmount]=useState(''),[cur,setCur]=useState(currency||'NGN'),[on,setOn]=useState(today),[invoice,setInvoice]=useState(''),[note,setNote]=useState(''),[file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  const form=new FormData();
  for(const [k,v] of Object.entries({kind:'receipt',lead_id:leadId,direction:dir,title,amount,currency:cur,paid_on:on,invoice_id:dir==='in'?invoice:'',note}))form.set(k,v);
  if(file)form.set('file',file);
  try{await upload(form);onSaved();}catch(err){setError(err instanceof Error?err.message:'Could not save.');setBusy(false);}
 }
 return <Modal title="Add receipt" onClose={onClose}><form className="zn-modal-body" onSubmit={save}>
  <div className="zv-kinds" role="radiogroup" aria-label="Who paid">
   <button type="button" role="radio" aria-checked={dir==='in'} className={dir==='in'?'is-on':''} onClick={()=>setDir('in')}><ArrowDownLeft size={14}/>Client paid us</button>
   <button type="button" role="radio" aria-checked={dir==='out'} className={dir==='out'?'is-on':''} onClick={()=>setDir('out')}><ArrowUpRight size={14}/>We paid for client</button>
  </div>
  <label className="zn-label">What for<input className="zn-input" autoFocus required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder={dir==='in'?'e.g. October retainer, Website deposit':'e.g. Supabase Pro plan, Domain renewal'}/></label>
  <div className="zc-two">
   <label className="zn-label">Amount<input className="zn-input" type="number" inputMode="decimal" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   <label className="zn-label">Currency<Dropdown label="Currency" value={cur} onChange={setCur} options={currencies.map(c=>({value:c,label:c}))}/></label>
  </div>
  <label className="zn-label">Paid on<input className="zn-input" type="date" required value={on} onChange={e=>setOn(e.target.value)}/></label>
  {dir==='in'&&invoices.length>0&&<label className="zn-label">For invoice (optional)<Dropdown label="Invoice" value={invoice} onChange={setInvoice} options={[{value:'',label:'None'},...invoices.map(i=>({value:i.id,label:i.number}))]}/></label>}
  <label className="zn-label">Receipt file (image or PDF, up to 4 MB)<input className="zn-input" type="file" accept="image/*,application/pdf" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
  <label className="zn-label">Note (optional)<textarea className="zn-input" rows={2} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>
  {error&&<p className="zn-error" role="alert">{error}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy||!title.trim()||!amount}>{busy?'Saving…':'Save receipt'}</button></div>
 </form></Modal>;
}
