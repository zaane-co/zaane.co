'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {ArrowLeft,Forward,Inbox,Mail as MailIcon,Paperclip,PenSquare,RefreshCw,Reply,ReplyAll,Search,Unplug} from 'lucide-react';
import MailCompose,{type ComposeInit} from './MailCompose';
import {useConfirm} from './ConfirmProvider';

type Folder={id:string;name:string;type:string;path:string;unread:number};
type Row={id:string;folderId:string;subject:string;summary:string;from:string;fromAddress:string;to:string;at:number;unread:boolean;attach:boolean};
type Full={html:string;subject:string;from:string;fromAddress:string;to:string;cc:string;replyTo:string;at:number;files:{id:string;name:string;size:number}[]};

async function api<T>(body:object):Promise<T>{
 const r=await fetch('/api/zarn/mail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const j=await r.json().catch(()=>({error:'Something went wrong.'}));
 if(!r.ok)throw Object.assign(new Error(j.error??'Something went wrong.'),{status:r.status});
 return j as T;
}
const errors:Record<string,string>={setup:'Zoho Mail isn’t set up on this site yet. Ask an admin.',denied:'You cancelled the Zoho sign-in.',expired:'That sign-in took too long. Try again.',zoho:'Zoho didn’t let us in. Try again.',save:'Couldn’t save your mailbox. Try again.'};
const order=['inbox','drafts','sent','spam','trash'];
const when=(t:number)=>{if(!t)return '';const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):d.getFullYear()===n.getFullYear()?d.toLocaleDateString([],{day:'numeric',month:'short'}):d.toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'});};
const size=(b:number)=>b<1024*1024?`${Math.max(1,Math.round(b/1024))} KB`:`${(b/1024/1024).toFixed(1)} MB`;
const nameOf=(s:string)=>s.replace(/<[^>]*>/g,'').replace(/&lt;.*?&gt;/g,'').replace(/"/g,'').trim()||s;
const addr=(s:string)=>{const m=s.match(/<([^>]+)>|&lt;(.+?)&gt;/);return (m?.[1]??m?.[2]??s).trim();};
const re=(s:string,p:string)=>new RegExp(`^${p}:`,'i').test(s)?s:`${p}: ${s}`;

export default function Mail(){
 const params=useSearchParams(),confirm=useConfirm();
 const [st,setSt]=useState<{ready:boolean;connected:boolean;email:string|null}|null>(null);
 const [folders,setFolders]=useState<Folder[]>([]),[folder,setFolder]=useState<string>('');
 const [rows,setRows]=useState<Row[]|null>(null),[more,setMore]=useState(false),[q,setQ]=useState(''),[search,setSearch]=useState('');
 const [open,setOpen]=useState<Row|null>(null),[full,setFull]=useState<Full|null>(null);
 const [draft,setDraft]=useState<(ComposeInit&{n:number})|null>(null),[err,setErr]=useState(params.get('error')?errors[params.get('error')!]??'':''),[onlyUnread,setOnlyUnread]=useState(false),[sig,setSig]=useState('');
 const seq=useRef(0);
 const lost=useCallback((e:unknown)=>{if((e as {status?:number}).status===409||(e as {status?:number}).status===401)setSt(s=>s?{...s,connected:false}:s);setErr((e as Error).message);},[]);

 useEffect(()=>{void (async()=>{try{setSt(await api({action:'status'}));}catch(e){setErr((e as Error).message);setSt({ready:false,connected:false,email:null});}})();},[]);
 useEffect(()=>{if(!st?.connected)return;void (async()=>{try{
  const {folders:f}=await api<{folders:Folder[]}>({action:'folders'});
  const sorted=[...f].sort((a,b)=>{const i=order.indexOf(a.type.toLowerCase()),j=order.indexOf(b.type.toLowerCase());return (i<0?99:i)-(j<0?99:j)||a.path.localeCompare(b.path);});
  setFolders(sorted);setFolder(sorted.find(x=>x.type.toLowerCase()==='inbox')?.id??sorted[0]?.id??'');
 }catch(e){lost(e);}})();},[st?.connected,lost]);

 useEffect(()=>{if(!st?.connected)return;void api<{html:string}>({action:'signature'}).then(r=>setSig(r.html)).catch(()=>0);},[st?.connected]);
 const load=useCallback(async(start=1,quiet=false)=>{
  if(!folder)return;const n=++seq.current;if(!quiet&&start===1)setRows(null);
  try{const r=await api<{messages:Row[];more:boolean;unreadCount?:number}>({action:'list',folderId:folder,start,q:search,unread:onlyUnread});
   if(n!==seq.current)return;setRows(x=>start===1?r.messages:[...(x??[]),...r.messages]);setMore(r.more);
   if(r.unreadCount!=null)setFolders(l=>l.map(f=>f.id===folder?{...f,unread:r.unreadCount!}:f));}
  catch(e){if(n===seq.current){lost(e);setRows(x=>x??[]);}}
 },[folder,search,onlyUnread,lost]);
 useEffect(()=>{void (async()=>{await load();})();},[load]);
 // New mail: check every minute while the page is open and visible.
 useEffect(()=>{const t=setInterval(()=>{if(document.visibilityState==='visible')void load(1,true);},60_000);return()=>clearInterval(t);},[load]);

 async function read(r:Row){
  setOpen(r);setFull(null);setErr('');
  if(r.unread){setRows(x=>x?.map(m=>m.id===r.id?{...m,unread:false}:m)??null);setFolders(l=>l.map(f=>f.id===r.folderId?{...f,unread:Math.max(0,f.unread-1)}:f));}
  try{setFull(await api<Full>({action:'read',folderId:r.folderId,messageId:r.id}));}catch(e){lost(e);}
 }
 function reply(mode:'reply'|'replyall'|'forward'){
  if(!open||!full)return;
  const me=(st?.email??'').toLowerCase();
  const to=mode==='forward'?'':addr(full.replyTo||full.fromAddress||full.from);
  const cc=mode==='replyall'?[...new Set([...full.to.split(','),...full.cc.split(',')].map(addr).filter(x=>x&&x.toLowerCase()!==me&&x.toLowerCase()!==to.toLowerCase()))]:[];
  setDraft({n:Date.now(),to:to?[to]:[],cc,subject:re(full.subject,mode==='forward'?'Fwd':'Re'),reply:{folderId:open.folderId,messageId:open.id,mode},files:mode==='forward'?full.files:undefined});
 }
 // A draft opens back in the compose window; sending or saving it replaces the copy in Drafts.
 function editDraft(){if(!open||!full)return;const split=(s:string)=>s.split(',').map(addr).filter(Boolean);
  setDraft({n:Date.now(),to:split(full.to),cc:split(full.cc),subject:full.subject,html:full.html,draftOf:{folderId:open.folderId,messageId:open.id}});}
 const inDrafts=folders.find(f=>f.id===folder)?.type.toLowerCase()==='drafts';
 async function disconnect(){
  if(!await confirm({title:'Disconnect Zoho Mail?',message:'Your emails stay in Zoho. You can connect again any time.',confirm:'Disconnect',danger:true}))return;
  await api({action:'disconnect'}).catch(()=>0);setSt(s=>s?{...s,connected:false,email:null}:s);setRows(null);setFolders([]);setOpen(null);
 }

 const head=<header className="zn-page-head"><div><h1><MailIcon size={20}/>Mail</h1><p>{st?.connected?st.email:'Your Zoho mailbox, inside ZARN'}</p></div>
  {st?.connected&&<div className="zm-acts"><button type="button" className="zn-btn" onClick={()=>void load(1,true)} aria-label="Check for new mail"><RefreshCw size={15}/></button>
   <button type="button" className="zn-btn" onClick={()=>void disconnect()} aria-label="Disconnect Zoho Mail"><Unplug size={15}/></button>
   <button type="button" className="zn-btn is-primary" onClick={()=>setDraft({n:Date.now(),to:[],cc:[],subject:''})}><PenSquare size={15}/>New email</button></div>}</header>;

 if(!st)return <div className="zn-page">{head}<p className="zn-note zm-pad">Loading…</p></div>;
 if(!st.connected)return <div className="zn-page">{head}<div className="zn-empty-state"><h2>Connect your Zoho Mail</h2>
  <p>Read and reply to your @zaane.co email right here. Emails still go out from your own address and show in Zoho’s Sent folder. Only you can see your mailbox.</p>
  {err&&<p className="zb-err" role="alert">{err}</p>}
  {st.ready?<a className="zn-btn is-primary" href="/api/zarn/zoho/connect"><MailIcon size={15}/>Connect Zoho Mail</a>:<p className="zn-note">Zoho Mail isn’t set up on this site yet.</p>}</div></div>;

 return <div className="zn-page">{head}
  {err&&<p className="zb-err zm-err" role="alert">{err}</p>}
  <div className={`zm-wrap${open?' is-reading':''}`}>
   <nav className="zm-folders" data-lenis-prevent>{folders.map(f=><button type="button" key={f.id} className={f.id===folder?'is-on':''} style={{paddingLeft:10+Math.max(0,f.path.split('/').length-2)*12}} onClick={()=>{setFolder(f.id);setOpen(null);setSearch('');setQ('');}}>
    {f.type.toLowerCase()==='inbox'?<Inbox size={15}/>:null}<span>{f.name}</span>{f.unread>0&&<em>{f.unread}</em>}</button>)}</nav>
   <section className="zm-list">
    <form className="zm-search" onSubmit={e=>{e.preventDefault();setOpen(null);setSearch(q.trim());}}><Search size={14}/><input value={q} onChange={e=>{setQ(e.target.value);if(!e.target.value&&search)setSearch('');}} placeholder="Search mail"/></form>
    <div className="zm-filter" role="tablist">{([[false,'All'],[true,'Unread']] as const).map(([v,l])=><button key={l} type="button" role="tab" aria-selected={onlyUnread===v} className={onlyUnread===v?'is-on':''} onClick={()=>{setOnlyUnread(v);setOpen(null);}}>{l}{v&&(folders.find(f=>f.id===folder)?.unread??0)>0?` (${folders.find(f=>f.id===folder)!.unread})`:''}</button>)}</div>
    <select className="zn-input zm-folder-pick" value={folder} onChange={e=>{setFolder(e.target.value);setOpen(null);}}>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>
    <div className="zn-scroll" data-lenis-prevent>
     {rows===null?<p className="zn-note zm-pad">Loading…</p>:rows.length===0?<p className="zn-note zm-pad">{search?'Nothing matches.':onlyUnread?'No unread emails here.':'No emails here.'}</p>:
     rows.map(r=><button type="button" key={r.id} className={`zm-row${r.unread?' is-unread':''}${open?.id===r.id?' is-on':''}`} onClick={()=>void read(r)}>
      <span className="zm-row-top"><b>{nameOf(r.from)}</b><small>{when(r.at)}</small></span>
      <span className="zm-row-sub">{r.attach&&<Paperclip size={12}/>}{r.subject||'(no subject)'}</span>
      <span className="zm-row-sum">{r.summary}</span></button>)}
     {more&&<button type="button" className="zn-btn zm-more" onClick={()=>void load((rows?.length??0)+1)}>Load more</button>}
    </div>
   </section>
   <section className="zm-read">
    {!open?<p className="zn-note zm-pad zm-pick">Pick an email to read it.</p>:<>
     <div className="zm-read-head"><button type="button" className="zn-btn zm-back" onClick={()=>setOpen(null)} aria-label="Back to the list"><ArrowLeft size={15}/></button>
      <div><h2>{full?.subject||open.subject||'(no subject)'}</h2>
       <p><b>{nameOf(full?.from??open.from)}</b> <span>{addr(full?.fromAddress??open.fromAddress)}</span></p>
       {full&&<p className="zm-to">To {full.to.split(',').map(nameOf).join(', ')}{full.cc?` · Cc ${full.cc.split(',').map(nameOf).join(', ')}`:''} · {new Date(full.at||open.at).toLocaleString()}</p>}</div></div>
     {full&&inDrafts&&<div className="zm-read-acts"><button type="button" className="zn-btn is-primary" onClick={editDraft}><PenSquare size={15}/>Edit draft</button></div>}
     {full&&!inDrafts&&<div className="zm-read-acts"><button type="button" className="zn-btn" onClick={()=>reply('reply')}><Reply size={15}/>Reply</button>
      <button type="button" className="zn-btn" onClick={()=>reply('replyall')}><ReplyAll size={15}/>Reply all</button>
      <button type="button" className="zn-btn" onClick={()=>reply('forward')}><Forward size={15}/>Forward</button></div>}
     {full&&full.files.length>0&&<div className="zm-files">{full.files.map(f=><a key={f.id} href={`/api/zarn/mail?f=${open.folderId}&m=${open.id}&a=${f.id}&n=${encodeURIComponent(f.name)}`}><Paperclip size={13}/>{f.name}<small>{size(f.size)}</small></a>)}</div>}
     {full?<iframe className="zm-body" title="Email" sandbox="allow-popups allow-popups-to-escape-sandbox"
      srcDoc={`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:"><base target="_blank"><style>body{margin:16px;font:14px/1.5 Arial,sans-serif;color:#111;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}</style>${full.html}`}/>
      :<p className="zn-note zm-pad">Loading…</p>}
    </>}
   </section>
  </div>
  {draft&&<MailCompose key={draft.n} init={draft} from={st.email??''} onClose={()=>setDraft(null)} signature={sig} onSent={d=>{const t=folders.find(f=>f.id===folder)?.type.toLowerCase();if(draft?.draftOf)setOpen(null);setDraft(null);if(t==='sent'||t==='drafts'||d&&t==='drafts')void load(1,true);}}/>}
 </div>;
}
