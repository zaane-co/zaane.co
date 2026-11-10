'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowUp,Bell,Brain,Check,ChevronLeft,ChevronsLeft,ChevronsRight,Clock,FileText,History,ListChecks,Loader2,MessageSquarePlus,MessagesSquare,Paperclip,Plus,Send,Sparkles,Sun,Trash2,X} from 'lucide-react';
import ZBotMark from './ZBotMark';
import {useZarn} from './ZarnProvider';
import {dayOf} from './format';
import {isFileDrag} from './drop';

type Proposal={tool:string;args:unknown;summary:string};
type Item={id:string;role:'user'|'assistant';content:string;error?:boolean;proposal?:Proposal|null;state?:'pending'|'done'|'cancelled'|null};
type Convo={id:string;title:string;updated_at:string};
type Memory={id:string;fact:string};
type Row={id:string;role:'user'|'assistant';content:string;proposal:Proposal|null;state:'pending'|'done'|'cancelled'|null};
const KEY='zarn:assistant:conversation';
const suggestions:[string,React.ReactNode][]=[['What happened in ZARN this week?',<MessagesSquare key="a" size={18} color="#22c55e"/>],['What needs my attention today?',<Bell key="b" size={18} color="#38bdf8"/>],['What’s overdue for me?',<Clock key="c" size={18} color="#f59e0b"/>],['What did I miss?',<Sparkles key="d" size={18} color="#f10c45"/>]];
const INTRO='zarn:zbot:intro-seen';
const uid=()=>Math.random().toString(36).slice(2);
const MAX_CHARS=60000;
const ATTACH_TYPES='.txt,.md,.markdown,.csv,.json,.html,.log,text/plain';

// Slide-over chat. Conversations and notes are saved, reads happen straight away, and any change shows a confirm card first.
export default function Assistant({onClose}:{onClose:()=>void}){
 const {db,me,refreshDue}=useZarn();
 // Wide by default on desktop, like a full page; collapses to the side panel.
 const [wide,setWide]=useState(()=>{try{return localStorage.getItem('zarn:zbot:wide')!=='0';}catch{return true;}});
 const toggleWide=()=>setWide(w=>{try{localStorage.setItem('zarn:zbot:wide',w?'0':'1');}catch{}return !w;});
 const [intro,setIntro]=useState(()=>{try{return !localStorage.getItem(INTRO);}catch{return false;}});
 const closeIntro=()=>{setIntro(false);try{localStorage.setItem(INTRO,'1');}catch{}};
 const first=(me.display_name||'there').split(' ')[0];
 const [view,setView]=useState<'chat'|'history'|'memory'>('chat');
 const [conversation,setConversation]=useState<string|null>(()=>{try{return sessionStorage.getItem(KEY);}catch{return null;}});
 const [items,setItems]=useState<Item[]>([]),[convos,setConvos]=useState<Convo[]|null>(null),[memories,setMemories]=useState<Memory[]|null>(null);
 const [text,setText]=useState(''),[file,setFile]=useState<{name:string;text:string}|null>(null),[fileError,setFileError]=useState(''),fileInput=useRef<HTMLInputElement>(null),box=useRef<HTMLTextAreaElement>(null),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(!!conversation),end=useRef<HTMLDivElement>(null);

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
  const typed=q.trim(),content=file?`${typed||'Turn this document into tasks.'}\n\n--- ${file.name} ---\n${file.text}`:typed;
  if(!content||busy)return;
  if(content.length>MAX_CHARS){setFileError(`That is ${content.length.toLocaleString('en-GB')} characters. The limit is ${MAX_CHARS.toLocaleString('en-GB')}, so send it in parts.`);return;}
  setItems(n=>[...n,{id:uid(),role:'user',content}]);setText('');setFile(null);setFileError('');setBusy(true);
  try{
   const out=await call({action:'chat',conversation_id:conversation??undefined,message:content});
   if(out.conversation_id&&out.conversation_id!==conversation){setConversation(out.conversation_id);try{sessionStorage.setItem(KEY,out.conversation_id);}catch{/* private mode */}}
   setItems(n=>[...n,{id:out.message_id??uid(),role:'assistant',content:out.reply??'',proposal:out.proposal??null,state:out.proposal?'pending':null}]);
  }catch(e){setItems(n=>[...n,{id:uid(),role:'assistant',content:e instanceof Error?e.message:'Something went wrong.',error:true}]);}
  finally{setBusy(false);}
 }
 async function attach(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];e.target.value='';if(f)await readFile(f);}
 async function readFile(f:File){
  if(f.size>MAX_CHARS*4){setFileError('That file is too big. Paste the part you need instead.');return;}
  const t=(await f.text().catch(()=>'')).replace(/\0/g,'').trim();
  if(!t){setFileError('I could only read plain text files (.txt, .md, .csv). For a PDF or Word file, copy the text and paste it.');return;}
  if(t.length>MAX_CHARS){setFileError(`That file is ${t.length.toLocaleString('en-GB')} characters. The limit is ${MAX_CHARS.toLocaleString('en-GB')}, so send it in parts.`);return;}
  setFile({name:f.name,text:t});setFileError('');box.current?.focus();
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

 const home=!loading&&!items.length;
 const composer=<form className={`zai-form${home?' is-home':''}`} onSubmit={e=>{e.preventDefault();void send(text);}}>
    {(file||fileError)&&<div className="zai-attached">{file&&<span className="zai-file"><Paperclip size={13}/>{file.name} · {file.text.length.toLocaleString('en-GB')} characters<button type="button" aria-label="Remove file" onClick={()=>setFile(null)}><X size={13}/></button></span>}{fileError&&<small role="alert">{fileError}</small>}</div>}
    <div className="zai-row">
     <input ref={fileInput} type="file" accept={ATTACH_TYPES} hidden onChange={e=>void attach(e)}/>
     <button type="button" className="zp-icon-btn" aria-label="Attach a text file" data-tip="Attach a document" disabled={busy} onClick={()=>fileInput.current?.click()}>{home?<Plus size={17}/>:<Paperclip size={16}/>}</button>
     <textarea ref={box} rows={1} value={text} maxLength={MAX_CHARS} placeholder={file?'What should I do with it? (or just send)':home?'Ask anything':'Ask, or paste a document to turn into tasks…'} aria-label="Message the assistant" autoFocus
      onChange={e=>{setText(e.target.value);setFileError('');e.target.style.height='auto';e.target.style.height=`${Math.min(e.target.scrollHeight,160)}px`;}}
      onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send(text);}}}/>
     <button type="submit" className="zai-send" disabled={busy||(!text.trim()&&!file)} aria-label="Send"><ArrowUp size={17}/></button>
    </div>
   </form>;
 return <><button type="button" className="zp-scrim" aria-label="Close Z-BOT" onClick={onClose}/>
  <aside className={`zp-drawer zai${wide?' is-wide':''}`} role="dialog" aria-label="Z-BOT" onDragOver={e=>{if(isFileDrag(e))e.preventDefault();}} onDrop={e=>{if(!isFileDrag(e))return;e.preventDefault();e.stopPropagation();const f=e.dataTransfer.files[0];if(f)void readFile(f);}}>
   <header><button type="button" className="zp-icon-btn zai-expand" aria-label={wide?'Collapse to side panel':'Expand'} data-tip={wide?'Side panel':'Expand'} onClick={toggleWide}>{wide?<ChevronsRight size={17}/>:<ChevronsLeft size={17}/>}</button>{view==='chat'?<b className="zai-title"><ZBotMark size={22}/>Z-BOT</b>:<button type="button" className="zai-back" onClick={()=>setView('chat')}><ChevronLeft size={16}/>{view==='history'?'History':'Memory'}</button>}
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
    {home&&<div className="zbot-home">
     <div className="zbot-hello"><ZBotMark size={44}/><h2>Back at it, {first}!</h2></div>
     <div className="zbot-glow">{composer}</div>
     <small className="zbot-note">Z-BOT is AI and can make mistakes. It always asks before changing or sending anything.</small>
     <p className="zbot-rec">Recommended for you</p>
     <div className="zbot-chips">{suggestions.map(([q,icon])=><button key={q} type="button" onClick={()=>void send(q)}>{icon}<span>{q}</span></button>)}</div>
    </div>}
    {items.map(i=><div key={i.id} className={`zai-msg is-${i.role}${i.error?' is-error':''}`}>
     {i.role==='assistant'?<AiText text={i.content}/>:<UserText text={i.content}/>}
     {i.proposal&&<div className={`zai-proposal is-${i.state}`}>
      <span>{i.proposal.summary}</span>
      {i.state==='pending'?<div><button type="button" className="zn-btn is-primary" disabled={busy} onClick={()=>void confirm(i)}><Check size={14}/>Confirm</button><button type="button" className="zn-btn" disabled={busy} onClick={()=>void cancel(i)}>Cancel</button></div>
       :<small>{i.state==='done'?'Done':'Cancelled'}</small>}
     </div>}
    </div>)}
    {busy&&<div className="zai-msg is-assistant"><p className="zai-typing"><Loader2 size={14} className="zai-spin"/>Thinking…</p></div>}
    <div ref={end}/>
   </div>
   {items.length>0&&composer}</>}
  </aside>
  {intro&&<div className="zn-modal-scrim zbot-intro-scrim" onClick={closeIntro}><div className="zbot-intro" role="dialog" aria-label="Meet Z-BOT" onClick={e=>e.stopPropagation()}>
   <button type="button" className="zbot-intro-x" aria-label="Close" onClick={closeIntro}><X size={22}/></button>
   <ZBotMark size={96}/>
   <h2>Meet Z-BOT, your AI assistant</h2>
   <p>Ask questions, catch up on conversations, and get a head start on your work.</p>
   <ul>
    <li><Sun size={22}/><div><b>Catch up in seconds</b><span>A rundown of the messages, mentions and tasks that need you.</span></div><button type="button" aria-label="Try it" onClick={()=>{closeIntro();void send('What did I miss?');}}><ArrowRight size={18}/></button></li>
    <li><ListChecks size={22}/><div><b>Turn documents into tasks</b><span>Paste a brief or attach a file and Z-BOT breaks it into tasks for the team.</span></div><button type="button" aria-label="Try it" onClick={()=>{closeIntro();fileInput.current?.click();}}><ArrowRight size={18}/></button></li>
    <li><FileText size={22}/><div><b>Message and assign for you</b><span>Ask Z-BOT to message someone or create work. It always checks with you first.</span></div><button type="button" aria-label="Try it" onClick={()=>{closeIntro();setText('Send a message to ');box.current?.focus();}}><ArrowRight size={18}/></button></li>
   </ul>
  </div></div>}
 </>;
}

// A pasted document would fill the whole chat, so long messages show the start and open on tap.
function UserText({text}:{text:string}){
 const [open,setOpen]=useState(false),LIMIT=500;
 if(text.length<=LIMIT)return <p>{text}</p>;
 return <p>{open?text:`${text.slice(0,LIMIT).trimEnd()}…`}<button type="button" className="zai-more" onClick={()=>setOpen(o=>!o)}>{open?'Show less':`Show all ${text.length.toLocaleString('en-GB')} characters`}</button></p>;
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
