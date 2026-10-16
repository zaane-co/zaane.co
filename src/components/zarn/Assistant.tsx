'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Brain,Check,ChevronLeft,History,Loader2,MessageSquarePlus,Plus,Send,Sparkles,Trash2,X} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {dayOf} from './format';

type Proposal={tool:string;args:unknown;summary:string};
type Item={id:string;role:'user'|'assistant';content:string;error?:boolean;proposal?:Proposal|null;state?:'pending'|'done'|'cancelled'|null};
type Convo={id:string;title:string;updated_at:string};
type Memory={id:string;fact:string};
type Row={id:string;role:'user'|'assistant';content:string;proposal:Proposal|null;state:'pending'|'done'|'cancelled'|null};
const KEY='zarn:assistant:conversation';
const suggestions=['What did I miss?','What’s overdue for me?','Find my chat with Isaac about the pricing page','Send Isaac a message asking if the homepage is ready'];
const uid=()=>Math.random().toString(36).slice(2);

// Slide-over chat. Conversations and notes are saved, reads happen straight away, and any change shows a confirm card first.
export default function Assistant({onClose}:{onClose:()=>void}){
 const {db,me,refreshDue}=useZarn();
 const [view,setView]=useState<'chat'|'history'|'memory'>('chat');
 const [conversation,setConversation]=useState<string|null>(()=>{try{return sessionStorage.getItem(KEY);}catch{return null;}});
 const [items,setItems]=useState<Item[]>([]),[convos,setConvos]=useState<Convo[]|null>(null),[memories,setMemories]=useState<Memory[]|null>(null);
 const [text,setText]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(!!conversation),end=useRef<HTMLDivElement>(null);

 const open=useCallback(async(id:string|null)=>{
  setConversation(id);setView('chat');
  try{if(id)sessionStorage.setItem(KEY,id);else sessionStorage.removeItem(KEY);}catch{/* private mode */}
  if(!id){setItems([]);setLoading(false);return;}
  setLoading(true);
  const {data}=await db.from('zarn_ai_messages').select('id,role,content,proposal,state').eq('conversation_id',id).order('created_at');
  setItems(((data??[]) as Row[]).map(r=>({id:r.id,role:r.role,content:r.content,proposal:r.proposal,state:r.state})));setLoading(false);
 },[db]);
 useEffect(()=>{if(conversation)void open(conversation);},[]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{end.current?.scrollIntoView({block:'end'});},[items,view,busy]);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose]);
 useEffect(()=>{
  if(view==='history'){void (async()=>{const {data}=await db.from('zarn_ai_conversations').select('id,title,updated_at').order('updated_at',{ascending:false}).limit(60);setConvos((data??[]) as Convo[]);})();}
  if(view==='memory'){void (async()=>{const {data}=await db.from('zarn_ai_memories').select('id,fact').order('created_at');setMemories((data??[]) as Memory[]);})();}
 },[view,db]);

 async function call(payload:object){
  const r=await fetch('/api/zarn/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const out=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(out.error||'Something went wrong.');
  return out as {conversation_id?:string;message_id?:string;reply?:string;proposal?:Proposal;posted?:string};
 }
 async function send(q:string){
  const content=q.trim();if(!content||busy)return;
  setItems(n=>[...n,{id:uid(),role:'user',content}]);setText('');setBusy(true);
  try{
   const out=await call({action:'chat',conversation_id:conversation??undefined,message:content});
   if(out.conversation_id&&out.conversation_id!==conversation){setConversation(out.conversation_id);try{sessionStorage.setItem(KEY,out.conversation_id);}catch{/* private mode */}}
   setItems(n=>[...n,{id:out.message_id??uid(),role:'assistant',content:out.reply??'',proposal:out.proposal??null,state:out.proposal?'pending':null}]);
  }catch(e){setItems(n=>[...n,{id:uid(),role:'assistant',content:e instanceof Error?e.message:'Something went wrong.',error:true}]);}
  finally{setBusy(false);}
 }
 async function confirm(item:Item){
  setBusy(true);
  try{
   const out=await call({action:'confirm',message_id:item.id});
   setItems(n=>[...n.map(i=>i.id===item.id?{...i,state:'done' as const}:i),{id:out.message_id??uid(),role:'assistant',content:out.reply??'Done.'}]);
   void refreshDue();
   // Messages sent from here notify the recipient the same way a normal send does.
   if(out.posted)void fetch('/api/zarn/push/notify',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({message_id:out.posted})}).catch(()=>{});
  }catch(e){setItems(n=>[...n,{id:uid(),role:'assistant',content:e instanceof Error?e.message:'Could not do that.',error:true}]);}
  finally{setBusy(false);}
 }
 async function cancel(item:Item){setItems(n=>n.map(i=>i.id===item.id?{...i,state:'cancelled' as const}:i));try{await call({action:'cancel',message_id:item.id});}catch{/* the card is already dismissed here */}}
 async function removeConvo(id:string){setConvos(c=>(c??[]).filter(x=>x.id!==id));await db.from('zarn_ai_conversations').delete().eq('id',id);if(id===conversation)void open(null);}
 async function addMemory(e:React.FormEvent){
  e.preventDefault();const fact=note.trim();if(!fact)return;
  const {data,error}=await db.from('zarn_ai_memories').insert({user_id:me.user_id,fact:fact.slice(0,300)}).select('id,fact').single();
  if(!error&&data){setMemories(m=>[...(m??[]),data as Memory]);setNote('');}
 }
 async function removeMemory(id:string){setMemories(m=>(m??[]).filter(x=>x.id!==id));await db.from('zarn_ai_memories').delete().eq('id',id);}

 return <><button type="button" className="zp-scrim" aria-label="Close assistant" onClick={onClose}/>
  <aside className="zp-drawer zai" role="dialog" aria-label="Assistant">
   <header>{view==='chat'?<b className="zai-title"><Sparkles size={16}/>Assistant</b>:<button type="button" className="zai-back" onClick={()=>setView('chat')}><ChevronLeft size={16}/>{view==='history'?'History':'Memory'}</button>}
    <div className="zp-drawer-actions">
     <button type="button" className="zp-icon-btn" aria-label="New chat" data-tip="New chat" onClick={()=>void open(null)}><MessageSquarePlus size={16}/></button>
     <button type="button" className="zp-icon-btn" aria-label="Past chats" data-tip="History" onClick={()=>setView('history')}><History size={16}/></button>
     <button type="button" className="zp-icon-btn" aria-label="What I remember" data-tip="Memory" onClick={()=>setView('memory')}><Brain size={16}/></button>
     <button type="button" className="zp-icon-btn" aria-label="Close" onClick={onClose}><X size={17}/></button></div></header>

   {view==='history'&&<div className="zp-drawer-body" data-lenis-prevent>
    {convos===null?<p className="zn-loading">Loading…</p>:convos.length?convos.map(c=><div key={c.id} className={`zai-convo${c.id===conversation?' is-on':''}`}>
     <button type="button" onClick={()=>void open(c.id)}><b>{c.title}</b><small>{dayOf(c.updated_at)}</small></button>
     <button type="button" className="zp-icon-btn" aria-label={`Delete ${c.title}`} data-tip="Delete" onClick={()=>void removeConvo(c.id)}><Trash2 size={15}/></button></div>)
     :<div className="zai-empty"><History size={26}/><h2>No past chats</h2><p>Your conversations are saved here so you can come back to them.</p></div>}
   </div>}

   {view==='memory'&&<div className="zp-drawer-body" data-lenis-prevent>
    <p className="zp-muted">Things I remember about how you work. I use these in every chat. You can also say “remember that…” in a conversation.</p>
    <form className="zai-note" onSubmit={addMemory}><input value={note} maxLength={300} placeholder="e.g. Isaac handles all design work" onChange={e=>setNote(e.target.value)} aria-label="Add a memory"/><button type="submit" className="zn-btn is-primary" disabled={!note.trim()} aria-label="Add"><Plus size={15}/></button></form>
    {memories===null?<p className="zn-loading">Loading…</p>:memories.length?memories.map(m=><div key={m.id} className="zai-memory"><span>{m.fact}</span><button type="button" className="zp-icon-btn" aria-label="Forget this" data-tip="Forget" onClick={()=>void removeMemory(m.id)}><Trash2 size={15}/></button></div>)
     :<p className="zp-muted">Nothing yet.</p>}
   </div>}

   {view==='chat'&&<><div className="zp-drawer-body zai-body" data-lenis-prevent>
    {loading&&<p className="zn-loading">Loading…</p>}
    {!loading&&!items.length&&<div className="zai-empty"><Sparkles size={26}/><h2>How can I help?</h2><p>Ask what you missed, find an old chat, message someone, or have me create and assign work. I always ask before changing or sending anything.</p>
     <div className="zai-chips">{suggestions.map(s=><button key={s} type="button" onClick={()=>void send(s)}>{s}</button>)}</div></div>}
    {items.map(i=><div key={i.id} className={`zai-msg is-${i.role}${i.error?' is-error':''}`}>
     {i.role==='assistant'?<AiText text={i.content}/>:<p>{i.content}</p>}
     {i.proposal&&<div className={`zai-proposal is-${i.state}`}>
      <span>{i.proposal.summary}</span>
      {i.state==='pending'?<div><button type="button" className="zn-btn is-primary" disabled={busy} onClick={()=>void confirm(i)}><Check size={14}/>Confirm</button><button type="button" className="zn-btn" disabled={busy} onClick={()=>void cancel(i)}>Cancel</button></div>
       :<small>{i.state==='done'?'Done':'Cancelled'}</small>}
     </div>}
    </div>)}
    {busy&&<div className="zai-msg is-assistant"><p className="zai-typing"><Loader2 size={14} className="zai-spin"/>Thinking…</p></div>}
    <div ref={end}/>
   </div>
   <form className="zai-form" onSubmit={e=>{e.preventDefault();void send(text);}}>
    <input value={text} maxLength={2000} placeholder="Ask or tell me what to do…" onChange={e=>setText(e.target.value)} aria-label="Message the assistant" autoFocus/>
    <button type="submit" className="zn-btn is-primary" disabled={busy||!text.trim()} aria-label="Send"><Send size={15}/></button>
   </form></>}
  </aside></>;
}

// Replies come back with light markdown (bold and bullet lists). Show that as formatting instead of stars.
function AiText({text}:{text:string}){
 const bold=(t:string)=>t.split(/(\*\*[^*]+\*\*)/g).map((part,k)=>/^\*\*[^*]+\*\*$/.test(part)?<strong key={k}>{part.slice(2,-2)}</strong>:part);
 const blocks:React.ReactNode[]=[];let list:string[]=[];
 const flush=()=>{if(list.length){blocks.push(<ul key={`u${blocks.length}`} className="zai-list">{list.map((x,k)=><li key={k}>{bold(x)}</li>)}</ul>);list=[];}};
 for(const line of text.split('\n')){
  const m=line.match(/^\s*[*-]\s+(.*)$/);
  if(m){list.push(m[1]!);continue;}
  flush();if(line.trim())blocks.push(<p key={`p${blocks.length}`}>{bold(line)}</p>);
 }
 flush();
 return <>{blocks}</>;
}
