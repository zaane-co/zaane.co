'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,Loader2,Send,Sparkles,Trash2,X} from 'lucide-react';
import {useZarn} from './ZarnProvider';

type Proposal={tool:'create_task'|'update_task';args:unknown;summary:string};
type Item={id:string;role:'user'|'assistant';content:string;error?:boolean;proposal?:Proposal;state?:'pending'|'done'|'cancelled'};
const KEY='zarn:assistant';
const suggestions=['What did I miss?','What’s overdue for me?','Create a task to review the homepage copy, due Friday','Which tasks are due this week?'];
const uid=()=>Math.random().toString(36).slice(2);

// Slide-over chat. Reads happen straight away; any change shows a confirm card first.
export default function Assistant({onClose}:{onClose:()=>void}){
 const {refreshDue}=useZarn();
 const [items,setItems]=useState<Item[]>(()=>{try{return JSON.parse(sessionStorage.getItem(KEY)||'[]') as Item[];}catch{return [];}});
 const [text,setText]=useState(''),[busy,setBusy]=useState(false),end=useRef<HTMLDivElement>(null);
 useEffect(()=>{try{sessionStorage.setItem(KEY,JSON.stringify(items.slice(-40)));}catch{/* private mode */}end.current?.scrollIntoView({block:'end'});},[items]);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose]);

 async function call(payload:object){
  const r=await fetch('/api/zarn/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const out=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(out.error||'Something went wrong.');
  return out as {reply:string;proposal?:Proposal};
 }
 async function send(q:string){
  const content=q.trim();if(!content||busy)return;
  const next:Item[]=[...items,{id:uid(),role:'user',content}];
  setItems(next);setText('');setBusy(true);
  try{
   const history=next.filter(i=>!i.error&&i.content).slice(-16).map(i=>({role:i.role,content:i.content}));
   const out=await call({action:'chat',messages:history});
   setItems(n=>[...n,{id:uid(),role:'assistant',content:out.reply,proposal:out.proposal,state:out.proposal?'pending':undefined}]);
  }catch(e){setItems(n=>[...n,{id:uid(),role:'assistant',content:e instanceof Error?e.message:'Something went wrong.',error:true}]);}
  finally{setBusy(false);}
 }
 async function confirm(item:Item){
  if(!item.proposal)return;setBusy(true);
  try{
   const out=await call({action:'confirm',tool:item.proposal.tool,args:item.proposal.args});
   setItems(n=>[...n.map(i=>i.id===item.id?{...i,state:'done' as const}:i),{id:uid(),role:'assistant',content:out.reply}]);void refreshDue();
  }catch(e){setItems(n=>[...n,{id:uid(),role:'assistant',content:e instanceof Error?e.message:'Could not do that.',error:true}]);}
  finally{setBusy(false);}
 }
 const cancel=(item:Item)=>setItems(n=>n.map(i=>i.id===item.id?{...i,state:'cancelled' as const}:i));

 return <><button type="button" className="zp-scrim" aria-label="Close assistant" onClick={onClose}/>
  <aside className="zp-drawer zai" role="dialog" aria-label="Assistant">
   <header><b className="zai-title"><Sparkles size={16}/>Assistant</b>
    <div className="zp-drawer-actions">{items.length>0&&<button type="button" className="zp-icon-btn" aria-label="Clear conversation" data-tip="Clear" onClick={()=>setItems([])}><Trash2 size={16}/></button>}<button type="button" className="zp-icon-btn" aria-label="Close" onClick={onClose}><X size={17}/></button></div></header>
   <div className="zp-drawer-body zai-body" data-lenis-prevent>
    {!items.length&&<div className="zai-empty"><Sparkles size={26}/><h2>How can I help?</h2><p>Ask what you missed, look up your tasks, or have me create and assign work. I always ask before changing anything.</p>
     <div className="zai-chips">{suggestions.map(s=><button key={s} type="button" onClick={()=>void send(s)}>{s}</button>)}</div></div>}
    {items.map(i=><div key={i.id} className={`zai-msg is-${i.role}${i.error?' is-error':''}`}>
     <p>{i.content}</p>
     {i.proposal&&<div className={`zai-proposal is-${i.state}`}>
      <span>{i.proposal.summary}</span>
      {i.state==='pending'?<div><button type="button" className="zn-btn is-primary" disabled={busy} onClick={()=>void confirm(i)}><Check size={14}/>Confirm</button><button type="button" className="zn-btn" disabled={busy} onClick={()=>cancel(i)}>Cancel</button></div>
       :<small>{i.state==='done'?'Done':'Cancelled'}</small>}
     </div>}
    </div>)}
    {busy&&<div className="zai-msg is-assistant"><p className="zai-typing"><Loader2 size={14} className="zai-spin"/>Thinking…</p></div>}
    <div ref={end}/>
   </div>
   <form className="zai-form" onSubmit={e=>{e.preventDefault();void send(text);}}>
    <input value={text} maxLength={2000} placeholder="Ask or tell me what to do…" onChange={e=>setText(e.target.value)} aria-label="Message the assistant" autoFocus/>
    <button type="submit" className="zn-btn is-primary" disabled={busy||!text.trim()} aria-label="Send"><Send size={15}/></button>
   </form>
  </aside></>;
}
