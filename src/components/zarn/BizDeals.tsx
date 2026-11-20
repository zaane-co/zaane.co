'use client';
import {useCallback,useEffect,useState} from 'react';
import {CalendarDays,KanbanSquare,Plus,Search,Trash2} from 'lucide-react';
import {money,currencies} from '@/lib/crm';
import {dealStages,sumBy,contactName,type Deal,type DealStage} from '@/lib/biz';
import {fmtDay,lagosToday} from '@/lib/zarn-care';
import {Modal} from './Dialogs';
import {useConfirm} from './ConfirmProvider';
import {bizApi,sums} from './BizMoney';

const stamp=()=>Date.now();
type C={id:string;name:string;company:string;company_id:string|null;email:string};
// Deals on a board: drag a card to move it. Won makes the contact a customer.
export default function BizDeals(){
 const confirm=useConfirm();
 const [deals,setDeals]=useState<Deal[]|null>(null),[contacts,setContacts]=useState<C[]>([]),[err,setErr]=useState(''),[q,setQ]=useState('');
 const [edit,setEdit]=useState<Deal|{stage:DealStage}|null>(null),[drag,setDrag]=useState<string|null>(null),[over,setOver]=useState<string|null>(null);
 const load=useCallback(async()=>{try{const d=await bizApi<{deals:Deal[];contacts:C[]}>({action:'deals'});setDeals(d.deals);setContacts(d.contacts);setErr('');}catch(e){setErr((e as Error).message);setDeals([]);}},[]);
 useEffect(()=>{void (async()=>{await load();})();},[load]);
 const byId=new Map(contacts.map(c=>[c.id,c]));
 const t=q.trim().toLowerCase();
 const shown=(deals??[]).filter(d=>{if(!t)return true;const c=d.contact_id?byId.get(d.contact_id):null;return `${d.title} ${c?.name??''} ${c?.company??''}`.toLowerCase().includes(t);});
 const col=(s:DealStage)=>shown.filter(d=>d.stage===s).sort((a,b)=>a.position-b.position);
 const open=(deals??[]).filter(d=>d.stage!=='won'&&d.stage!=='lost');
 async function move(id:string,stage:DealStage,before:string|null){
  const list=col(stage).filter(d=>d.id!==id),i=before?list.findIndex(d=>d.id===before):list.length;
  const prev=list[i-1]?.position,next=list[i]?.position;
  const position=prev==null&&next==null?stamp():prev==null?next!-1000:next==null?prev+1000:(prev+next)/2;
  const was=deals?.find(d=>d.id===id);if(!was||(was.stage===stage&&was.position===position))return;
  setDeals(l=>l?.map(d=>d.id===id?{...d,stage,position}:d)??null);
  try{await bizApi({action:'deal_move',id,stage,position});}catch(e){setErr((e as Error).message);void load();}
 }
 async function remove(d:Deal){if(!await confirm({title:`Delete ${d.title}?`,message:'This can’t be undone.',confirm:'Delete',danger:true}))return;await bizApi({action:'deal_delete',id:d.id}).catch(()=>{});void load();}
 return <div className="zn-page"><div className="zn-scroll zb-board-scroll" data-lenis-prevent>
  <header className="zn-page-head zb-head"><div><h1><KanbanSquare size={20}/>Deals</h1><p>Drag a deal across as it moves. Won makes the contact a customer.</p></div>
   <div className="zb-acts"><label className="zb-search"><Search size={14}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search deals"/></label>
    <button type="button" className="zn-btn is-primary" onClick={()=>setEdit({stage:'new'})}><Plus size={15}/>New deal</button></div></header>
  {err&&<p className="zb-err" role="alert">{err}</p>}
  <div className="zn-crm-stats">
   <div><small>Open deals</small><b>{sums(sumBy(open.filter(d=>d.value).map(d=>({amount:Number(d.value),currency:d.currency}))))}</b><span>{open.length} in play</span></div>
   <div><small>Won this month</small><b className="zb-in">{sums(sumBy((deals??[]).filter(d=>d.stage==='won'&&d.won_at&&d.won_at.slice(0,7)===lagosToday().slice(0,7)&&d.value).map(d=>({amount:Number(d.value),currency:d.currency}))))}</b><span>{(deals??[]).filter(d=>d.stage==='won').length} won in total</span></div>
  </div>
  {deals===null?<p className="zn-note zb-pad">Loading…</p>:
  <div className="zb-board">{dealStages.map(s=>{const list=col(s.key),total=sumBy(list.filter(d=>d.value).map(d=>({amount:Number(d.value),currency:d.currency})));
   return <section key={s.key} className={`zb-col${over===s.key?' is-over':''}`} onDragOver={e=>{e.preventDefault();setOver(s.key);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOver(null);}}
    onDrop={e=>{e.preventDefault();setOver(null);const id=e.dataTransfer.getData('text/plain')||drag;if(id)void move(id,s.key,null);setDrag(null);}}>
    <header><span className="zb-col-dot" style={{background:s.color}}/><b>{s.label}</b><small>{list.length}</small></header>
    {Object.keys(total).length>0&&<p className="zb-col-sum">{sums(total)}</p>}
    <div className="zb-cards">{list.map(d=>{const c=d.contact_id?byId.get(d.contact_id):null;const late=d.close_on&&d.close_on<lagosToday()&&d.stage!=='won'&&d.stage!=='lost';
     return <article key={d.id} className={`zb-deal${drag===d.id?' is-drag':''}`} draggable onDragStart={e=>{e.dataTransfer.setData('text/plain',d.id);e.dataTransfer.effectAllowed='move';setDrag(d.id);}} onDragEnd={()=>{setDrag(null);setOver(null);}}
      onDragOver={e=>{e.preventDefault();e.stopPropagation();setOver(s.key);}} onDrop={e=>{e.preventDefault();e.stopPropagation();setOver(null);const id=e.dataTransfer.getData('text/plain')||drag;if(id&&id!==d.id)void move(id,s.key,d.id);setDrag(null);}}
      onClick={()=>setEdit(d)} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')setEdit(d);}}>
      <b>{d.title}</b>
      {c&&<small>{contactName(c)}</small>}
      <div className="zb-deal-foot">{d.value!=null&&<span className="zb-deal-val">{money(Number(d.value),d.currency)}</span>}{d.close_on&&<span className={late?'zb-out':''}><CalendarDays size={12}/>{fmtDay(d.close_on)}</span>}</div>
      <select className="zb-deal-move" value={d.stage} onClick={e=>e.stopPropagation()} onChange={e=>void move(d.id,e.target.value as DealStage,null)} aria-label={`Move ${d.title}`}>{dealStages.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}</select>
     </article>;})}
     <button type="button" className="zb-col-add" onClick={()=>setEdit({stage:s.key})}><Plus size={14}/>Add deal</button>
    </div>
   </section>;})}</div>}
  {edit&&<DealDialog deal={'id' in edit?edit:null} stage={edit.stage} contacts={contacts} onDelete={'id' in edit?()=>{const d=edit;setEdit(null);void remove(d);}:undefined} onClose={()=>setEdit(null)} onDone={()=>{setEdit(null);void load();}}/>}
 </div></div>;
}

function DealDialog({deal,stage,contacts,onDelete,onClose,onDone}:{deal:Deal|null;stage:DealStage;contacts:C[];onDelete?:()=>void;onClose:()=>void;onDone:()=>void}){
 const [v,setV]=useState({title:deal?.title??'',contact_id:deal?.contact_id??'',stage:deal?.stage??stage,value:deal?.value!=null?String(deal.value):'',currency:deal?.currency??'NGN',close_on:deal?.close_on??'',note:deal?.note??''});
 const [nc,setNc]=useState<{name:string;email:string;company:string}|null>(null),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const f=(k:keyof typeof v)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setV(x=>({...x,[k]:e.target.value}));
 async function save(e:React.FormEvent){e.preventDefault();setErr('');
  if(nc&&!nc.name.trim())return setErr('Enter the contact’s name.');
  setBusy(true);
  try{
   const cid=nc?(await bizApi<{id:string}>({action:'contact_save',...nc})).id:v.contact_id||null;
   const value=v.value.trim()?Number(v.value.replace(/,/g,'')):null;
   const title=v.title.trim()||(nc?(nc.company||nc.name):contacts.find(c=>c.id===cid)?.company||contacts.find(c=>c.id===cid)?.name||'');
   if(!title){setErr('Name the deal.');setBusy(false);return;}
   await bizApi({action:'deal_save',...(deal?{id:deal.id}:{}),title,contact_id:cid,stage:v.stage,value:value!=null&&value>=0?value:null,currency:v.currency,close_on:v.close_on||null,note:v.note});
   onDone();
  }catch(x){setErr((x as Error).message);setBusy(false);}}
 return <Modal title={deal?deal.title:'New deal'} onClose={onClose}><form className="zn-modal-body" onSubmit={save}>
  <label className="zn-label">Deal<input className="zn-input" value={v.title} maxLength={200} onChange={f('title')} placeholder="e.g. Bola Foods website" autoFocus={!deal}/></label>
  {nc?<div className="zn-label">New contact <small>saved to Contacts{nc.company?', company saved to Companies':''}</small>
   <div className="zn-form-row"><input className="zn-input" placeholder="Name" value={nc.name} onChange={e=>setNc({...nc,name:e.target.value})}/><input className="zn-input" placeholder="Company" value={nc.company} onChange={e=>setNc({...nc,company:e.target.value})}/></div>
   <input className="zn-input" type="email" placeholder="Email (optional)" value={nc.email} onChange={e=>setNc({...nc,email:e.target.value})}/>
   <button type="button" className="zn-link zb-linkbtn" onClick={()=>setNc(null)}>Pick an existing contact instead</button></div>:
   <label className="zn-label">Contact<select className="zn-input" value={v.contact_id} onChange={f('contact_id')}><option value="">No contact yet</option>{contacts.map(c=><option key={c.id} value={c.id}>{contactName(c)}</option>)}</select>
    <button type="button" className="zn-link zb-linkbtn" onClick={()=>setNc({name:'',email:'',company:''})}>+ New contact</button></label>}
  <div className="zn-form-row"><label className="zn-label">Value<input className="zn-input" inputMode="decimal" value={v.value} onChange={f('value')} placeholder="0"/></label>
   <label className="zn-label">Currency<select className="zn-input" value={v.currency} onChange={f('currency')}>{currencies.map(c=><option key={c}>{c}</option>)}</select></label></div>
  <div className="zn-form-row"><label className="zn-label">Stage<select className="zn-input" value={v.stage} onChange={f('stage')}>{dealStages.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
   <label className="zn-label">Expected close<input className="zn-input" type="date" value={v.close_on} onChange={f('close_on')}/></label></div>
  <label className="zn-label">Notes<textarea className="zn-input zb-area" value={v.note} maxLength={5000} onChange={f('note')} placeholder="Scope, next step, who decides"/></label>
  {err&&<p className="zb-err" role="alert">{err}</p>}
  <div className="zn-modal-foot">{onDelete&&<button type="button" className="zn-btn zb-danger-text zb-left" onClick={onDelete}><Trash2 size={15}/>Delete</button>}<button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="submit" className="zn-btn is-primary" disabled={busy}>{busy?'Saving…':'Save'}</button></div>
 </form></Modal>;
}
