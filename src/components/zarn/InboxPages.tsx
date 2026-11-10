'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ChevronDown,MessageSquare,MessagesSquare,Mic,MoreVertical,Phone,PhoneCall,PhoneIncoming,PhoneMissed,PhoneOff,PhoneOutgoing,PencilLine,Plus,Search,Trash2,Video,X} from 'lucide-react';
import {useCall} from './CallProvider';
import {channelHref,type ZChannel,type ZMessage} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {Avatar,dayOf,plain,timeOf} from './format';

function Page({icon,title,sub,children}:{icon:React.ReactNode;title:string;sub:string;children:React.ReactNode}){
 return <div className="zn-page"><header className="zn-page-head"><div><h1>{icon}{title}</h1><p>{sub}</p></div></header><div className="zn-saved-page" data-lenis-prevent>{children}</div></div>;
}
const Empty=({title,text}:{title:string;text:string})=><div className="zn-empty-state"><h2>{title}</h2><p>{text}</p></div>;
function useWhere(){const {title}=useZarn();return (c?:ZChannel)=>c?(c.kind==='dm'||c.kind==='client'||c.kind==='project'?title(c):`#${c.name}`):'a conversation';}
const withThread=(href:string,id:string)=>`${href}${href.includes('?')?'&':'?'}thread=${id}`;

// Threads you started or replied to, newest reply first.
export function ThreadsPage(){
 const {db,me,people,channels}=useZarn(),where=useWhere();
 const [rows,setRows]=useState<ZMessage[]|null>(null);
 useEffect(()=>{let live=true;void (async()=>{
  const [{data:mine},{data:replies}]=await Promise.all([
   db.from('zarn_messages').select('*').eq('user_id',me.user_id).is('parent_id',null).gt('reply_count',0).is('deleted_at',null).order('last_reply_at',{ascending:false}).limit(60),
   db.from('zarn_messages').select('parent_id').eq('user_id',me.user_id).not('parent_id','is',null).order('created_at',{ascending:false}).limit(300)]);
  const have=new Set(((mine??[]) as ZMessage[]).map(m=>m.id)),need=[...new Set(((replies??[]) as {parent_id:string}[]).map(r=>r.parent_id))].filter(id=>!have.has(id)).slice(0,100);
  const {data:parents}=need.length?await db.from('zarn_messages').select('*').in('id',need):{data:[]};
  const all=[...((mine??[]) as ZMessage[]),...((parents??[]) as ZMessage[])].sort((a,b)=>(b.last_reply_at??b.created_at).localeCompare(a.last_reply_at??a.created_at));
  if(live)setRows(all);
 })();return()=>{live=false;};},[db,me.user_id]);
 return <Page icon={<MessagesSquare size={20}/>} title="Threads" sub="Conversations you started or replied to.">
  {rows===null?<p className="zn-loading">Loading…</p>:!rows.length?<Empty title="No threads yet" text="Reply to a message in a thread and it shows up here."/>:
  <div className="zp-saved">{rows.map(m=>{const c=channels.find(x=>x.id===m.channel_id),p=people[m.user_id??''];return <div key={m.id} className="zp-saved-row"><Link href={withThread(channelHref(c,m.channel_id),m.id)}>
   <span className="zn-todo-from"><MessagesSquare size={12}/>{where(c)}</span>
   <span className="zn-todo-who"><Avatar m={p} size={18}/><b>{p?.display_name??'Someone'}</b><time>{dayOf(m.created_at)} {timeOf(m.created_at)}</time></span>
   <span className="zn-todo-body zn-clamp2">{m.deleted_at?<em>Deleted message</em>:plain(m.body||(m.attachments.length?'Shared a file':''),people)}</span>
   <span className="zn-inbox-foot"><b>{m.reply_count} {m.reply_count===1?'reply':'replies'}</b>{m.last_reply_at&&<>Last reply {dayOf(m.last_reply_at)} {timeOf(m.last_reply_at)}</>}</span>
  </Link></div>;})}</div>}
 </Page>;
}

type Call={id:string;channel_id:string;caller_id:string;callee_id:string;status:string;created_at:string;answered_at:string|null;ended_at:string|null;video:boolean};
const secs=(c:Call)=>c.answered_at&&c.ended_at?Math.max(0,Math.round((+new Date(c.ended_at)-+new Date(c.answered_at))/1000)):0;
const dur=(c:Call)=>{const s=secs(c);if(!s)return '';const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h}h ${m}m`:m?`${m} min`:`${s}s`;};
const ago=(iso:string)=>{const d=(Date.now()-+new Date(iso))/1000;if(d<60)return 'Just now';if(d<3600)return `${Math.floor(d/60)}m ago`;if(d<86400)return `${Math.floor(d/3600)}h ago`;if(d<7*86400)return `${Math.floor(d/86400)}d ago`;return dayOf(iso);};
const HIDE_INTRO='zarn-calls-intro-hidden';
type CallFilter='all'|'missed'|'incoming'|'outgoing';

// Calls: start a voice or video call with anyone, and your call history with filters.
export function CallsPage(){
 const {db,me,people,channels,members,online}=useZarn(),call=useCall();
 const [rows,setRows]=useState<Call[]|null>(null),[filter,setFilter]=useState<CallFilter>('all'),[withId,setWithId]=useState(''),[picking,setPicking]=useState(false),[menu,setMenu]=useState<string|null>(null);
 const [intro,setIntro]=useState(true);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a per-device preference
 useEffect(()=>{try{if(localStorage.getItem(HIDE_INTRO))setIntro(false);}catch{}},[]);
 // Reloads when a call starts or ends (busy flips) and when the window regains focus, so new calls show up straight away.
 useEffect(()=>{let live=true;const load=()=>void db.from('zarn_calls').select('*').or(`caller_id.eq.${me.user_id},callee_id.eq.${me.user_id}`).order('created_at',{ascending:false}).limit(200).then(({data}:{data:Call[]|null})=>{if(live)setRows(data??[]);});
  load();const later=setTimeout(load,1500);window.addEventListener('focus',load);return()=>{live=false;clearTimeout(later);window.removeEventListener('focus',load);};},[db,me.user_id,call.busy]);
 const peer=(c:Call)=>c.caller_id===me.user_id?c.callee_id:c.caller_id;
 const missed=(c:Call)=>c.status==='missed'||c.status==='declined';
 const match:Record<CallFilter,(c:Call)=>boolean>={all:()=>true,missed:c=>missed(c)&&c.callee_id===me.user_id,incoming:c=>c.callee_id===me.user_id,outgoing:c=>c.caller_id===me.user_id};
 const list=(rows??[]).filter(c=>match[filter](c)&&(!withId||peer(c)===withId));
 const partners=[...new Set((rows??[]).map(peer))].filter(id=>people[id]).sort((a,b)=>people[a]!.display_name.localeCompare(people[b]!.display_name));
 const talked=(rows??[]).reduce((t,c)=>t+secs(c),0);
 async function ring(userId:string,video:boolean){
  setPicking(false);setMenu(null);
  const {data}=await db.rpc('zarn_open_dm',{others:[userId]});if(data)await call.start(String(data),userId,{video});
 }
 const hideIntro=()=>{setIntro(false);try{localStorage.setItem(HIDE_INTRO,'1');}catch{}};
 const tabs:[CallFilter,string][]=[['all','All calls'],['missed','Missed'],['incoming','Incoming'],['outgoing','Outgoing']];
 const live=(id:string)=>!!people[id]&&!people[id]!.deactivated_at;
 return <div className="zn-page">
  <header className="zn-page-head"><div><h1><Phone size={20}/>Calls</h1><p>Voice and video calls with anyone on the team.</p></div>
   <button type="button" className="zn-btn is-primary" disabled={call.busy} onClick={()=>setPicking(true)}><Plus size={15}/>New call</button></header>
  <div className="zn-calls" data-lenis-prevent>
   {intro&&<section className="zn-calls-hero">
    <div className="zn-calls-hero-text"><h2>Talk it out, instantly</h2><p>Jump on a voice or video call with anyone at Zaane. Calls ring on their phone too, and every call is logged here and in your chat.</p>
     <div className="zn-calls-hero-act"><button type="button" className="zn-btn is-primary" disabled={call.busy} onClick={()=>setPicking(true)}><Phone size={15}/>Start a call</button>
      {rows&&rows.length>0&&<span>{rows.length} {rows.length===1?'call':'calls'}{talked?` · ${Math.round(talked/60)} min talked`:''}</span>}</div></div>
    <div className="zn-calls-art" aria-hidden><div className="zn-calls-win"><div className="zn-calls-win-top"><i/><i/><i/></div>
     <div className="zn-calls-win-faces">{members.filter(m=>m.user_id!==me.user_id&&!m.deactivated_at).slice(0,3).map(m=><Avatar key={m.user_id} m={m} size={52}/>)}</div>
     <div className="zn-calls-win-bar"><span><Mic size={14}/></span><span><Video size={14}/></span><b><PhoneOff size={14}/></b></div></div></div>
    <button type="button" className="zn-calls-hero-x" aria-label="Hide" onClick={hideIntro}><X size={16}/></button>
   </section>}
   <section className="zn-calls-recent">
    <div className="zn-calls-bar"><h2>Recent calls</h2>
     <div className="zn-calls-filters">
      <div className="zn-seg">{tabs.map(([k,l])=><button key={k} type="button" className={`zn-seg-btn${filter===k?' is-on':''}`} onClick={()=>setFilter(k)}>{l}</button>)}</div>
      {partners.length>0&&<label className="zn-calls-with"><span>With</span><select value={withId} onChange={e=>setWithId(e.target.value)}><option value="">Anyone</option>{partners.map(id=><option key={id} value={id}>{people[id]!.display_name}</option>)}</select><ChevronDown size={14}/></label>}
     </div></div>
    {rows===null?<p className="zn-loading">Loading…</p>:!list.length?<div className="zn-calls-empty"><span><PhoneCall size={22}/></span><h3>{rows.length?'No calls match':'No calls yet'}</h3><p>{rows.length?'Try another filter.':'Start one with the button above, or from the phone or video button in any DM.'}</p></div>:
    <div className="zn-calls-list">{list.map(c=>{const id=peer(c),p=people[id],out=c.caller_id===me.user_id,miss=missed(c),ch=channels.find(x=>x.id===c.channel_id);
     const Icon=miss?PhoneMissed:out?PhoneOutgoing:PhoneIncoming;
     return <div key={c.id} className="zn-calls-row">
      <span className={`zn-calls-ico${miss?' is-missed':''}`}>{c.video?<Video size={17}/>:<Icon size={17}/>}</span>
      <Link href={channelHref(ch,c.channel_id)} className="zn-calls-main"><b>{p?.display_name??'Former member'}</b>
       <small className={miss?'is-missed':''}>{miss?(out?'No answer':'Missed'):out?'Outgoing':'Incoming'} {c.video?'video':'voice'} call · {ago(c.created_at)}{dur(c)&&` · ${dur(c)}`}</small></Link>
      <Avatar m={p} size={30} online={online.has(id)}/>
      {live(id)&&<span className="zn-calls-quick"><button type="button" aria-label="Voice call" data-tip="Voice call" disabled={call.busy} onClick={()=>void ring(id,false)}><Phone size={15}/></button><button type="button" aria-label="Video call" data-tip="Video call" disabled={call.busy} onClick={()=>void ring(id,true)}><Video size={15}/></button></span>}
      <span className="zn-calls-more"><button type="button" aria-label="More" onClick={()=>setMenu(menu===c.id?null:c.id)}><MoreVertical size={16}/></button>
       {menu===c.id&&<><div className="zn-menu-scrim" onClick={()=>setMenu(null)}/><div className="zn-calls-menu" role="menu"><Link href={channelHref(ch,c.channel_id)} role="menuitem"><MessageSquare size={14}/>Open chat</Link>{live(id)&&<button type="button" role="menuitem" onClick={()=>void ring(id,false)}><Phone size={14}/>Call back</button>}{live(id)&&<button type="button" role="menuitem" onClick={()=>void ring(id,true)}><Video size={14}/>Video call</button>}</div></>}</span>
     </div>;})}</div>}
   </section>
  </div>
  {picking&&<CallPicker onClose={()=>setPicking(false)} onRing={ring}/>}
 </div>;
}

function CallPicker({onClose,onRing}:{onClose:()=>void;onRing:(id:string,video:boolean)=>void}){
 const {members,me,online}=useZarn(),[q,setQ]=useState('');
 const list=members.filter(m=>m.user_id!==me.user_id&&!m.deactivated_at&&m.joined_at&&`${m.display_name} ${m.title} ${m.username??''}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>Number(online.has(b.user_id))-Number(online.has(a.user_id))||a.display_name.localeCompare(b.display_name));
 return <div className="zn-modal-scrim" onClick={onClose}><div className="zn-modal zn-call-pick" role="dialog" aria-label="New call" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')onClose();}}>
  <div className="zn-modal-head"><h2>New call</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
  <label className="zn-call-pick-search"><Search size={15}/><input autoFocus placeholder="Search people" value={q} onChange={e=>setQ(e.target.value)}/></label>
  <ul className="zn-call-pick-list" data-lenis-prevent>{list.map(m=><li key={m.user_id}><Avatar m={m} size={34} online={online.has(m.user_id)}/><span><b>{m.display_name}</b><small>{online.has(m.user_id)?'Online':m.title||'Offline'}</small></span>
   <button type="button" aria-label={`Voice call ${m.display_name}`} data-tip="Voice" onClick={()=>onRing(m.user_id,false)}><Phone size={15}/></button><button type="button" aria-label={`Video call ${m.display_name}`} data-tip="Video" onClick={()=>onRing(m.user_id,true)}><Video size={15}/></button></li>)}
   {!list.length&&<li className="zn-empty-row">Nobody matches.</li>}</ul>
 </div></div>;
}

// Unsent drafts, saved as you type and synced across your devices.
type Draft={key:string;channel:string;parent:string;text:string;at:string};
export function DraftsPage(){
 const {db,channels}=useZarn(),where=useWhere();
 const [drafts,setDrafts]=useState<Draft[]|null>(null);
 useEffect(()=>{let live=true;void (async()=>{
  const {data}=await db.from('zarn_drafts').select('channel_id,parent_key,body,updated_at').order('updated_at',{ascending:false});
  const map=new Map<string,Draft>();
  for(const d of (data??[]) as {channel_id:string;parent_key:string;body:string;updated_at:string}[])map.set(`zarn-draft-${d.channel_id}-${d.parent_key}`,{key:`zarn-draft-${d.channel_id}-${d.parent_key}`,channel:d.channel_id,parent:d.parent_key,text:d.body,at:d.updated_at});
  // This device's copy is the freshest.
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)??'',m=k.match(/^zarn-draft-([0-9a-f-]{36})-(.*)$/),t=m&&localStorage.getItem(k);if(m&&t?.trim())map.set(k,{key:k,channel:m[1]!,parent:m[2]!,text:t,at:map.get(k)?.at??new Date().toISOString()});}}catch{}
  if(live)setDrafts([...map.values()].filter(d=>d.text.trim()).sort((a,b)=>b.at.localeCompare(a.at)));
 })();return()=>{live=false;};},[db]);
 const drop=(d:Draft)=>{try{localStorage.removeItem(d.key);}catch{}void db.from('zarn_drafts').delete().eq('channel_id',d.channel).eq('parent_key',d.parent).then(()=>{});setDrafts(l=>(l??[]).filter(x=>x.key!==d.key));};
 const shown=(drafts??[]).filter(d=>channels.some(c=>c.id===d.channel));
 return <Page icon={<PencilLine size={20}/>} title="Drafts" sub="Messages you started but haven’t sent. They follow you to every device.">
  {drafts===null?<p className="zn-loading">Loading…</p>:!shown.length?<Empty title="No drafts" text="Start typing in any chat and leave it unsent. It’s kept here until you send it."/>:
   <div className="zp-saved">{shown.map(d=>{const c=channels.find(x=>x.id===d.channel);const href=channelHref(c,d.channel);return <div key={d.key} className="zp-saved-row"><Link href={d.parent?withThread(href,d.parent):href}>
    <span className="zn-todo-from"><PencilLine size={12}/>{d.parent?'Thread reply in ':''}{where(c)}<time className="zn-inbox-time">{dayOf(d.at)} {timeOf(d.at)}</time></span><span className="zn-todo-body zn-clamp2">{d.text}</span></Link>
    <button type="button" className="zn-todo-del" aria-label="Delete draft" data-tip="Delete draft" onClick={()=>drop(d)}><Trash2 size={15}/></button></div>;})}</div>}
 </Page>;
}
