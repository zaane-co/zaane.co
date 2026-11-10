'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {MessagesSquare,Phone,PhoneIncoming,PhoneMissed,PhoneOutgoing,Send,Trash2,Video} from 'lucide-react';
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
const dur=(c:Call)=>{if(!c.answered_at||!c.ended_at)return '';const s=Math.max(0,Math.round((+new Date(c.ended_at)-+new Date(c.answered_at))/1000));return s<60?`${s}s`:`${Math.floor(s/60)}m ${s%60}s`;};
// Your call history: voice and video calls you made or received.
export function HuddlesPage(){
 const {db,me,people,channels}=useZarn();
 const [rows,setRows]=useState<Call[]|null>(null);
 useEffect(()=>{let live=true;void db.from('zarn_calls').select('*').or(`caller_id.eq.${me.user_id},callee_id.eq.${me.user_id}`).order('created_at',{ascending:false}).limit(80).then(({data}:{data:Call[]|null})=>{if(live)setRows(data??[]);});return()=>{live=false;};},[db,me.user_id]);
 return <Page icon={<Phone size={20}/>} title="Calls" sub="Voice and video calls you made or received.">
  {rows===null?<p className="zn-loading">Loading…</p>:!rows.length?<Empty title="No calls yet" text="Start a call from the phone or video button in any DM."/>:
  <div className="zp-saved">{rows.map(c=>{const out=c.caller_id===me.user_id,other=people[out?c.callee_id:c.caller_id],missed=c.status==='missed'||c.status==='declined',ch=channels.find(x=>x.id===c.channel_id);
   const Icon=missed?PhoneMissed:out?PhoneOutgoing:PhoneIncoming;
   return <div key={c.id} className="zp-saved-row zn-call-row"><Link href={channelHref(ch,c.channel_id)}>
    <span className="zn-todo-who"><Avatar m={other} size={34}/><span className="zn-call-txt"><b>{other?.display_name??'Someone'}</b><small className={missed?'is-missed':''}><Icon size={13}/>{missed?(out?'No answer':'Missed'):out?'Outgoing':'Incoming'} {c.video?'video':'voice'} call{dur(c)&&` · ${dur(c)}`}</small></span><time>{dayOf(c.created_at)} {timeOf(c.created_at)}</time>{c.video?<Video size={16}/>:<Phone size={16}/>}</span>
   </Link></div>;})}</div>}
 </Page>;
}

// Unsent drafts (saved on this device as you type) and the messages you sent.
export function DraftsPage(){
 const {db,me,people,channels}=useZarn(),where=useWhere();
 const [tab,setTab]=useState<'drafts'|'sent'>('drafts'),[drafts,setDrafts]=useState<{key:string;channel:string;parent:string;text:string}[]>([]),[sent,setSent]=useState<ZMessage[]|null>(null);
 useEffect(()=>{const list:typeof drafts=[];try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)??'',m=k.match(/^zarn-draft-([0-9a-f-]{36})-(.*)$/);const t=m&&localStorage.getItem(k);if(m&&t?.trim())list.push({key:k,channel:m[1]!,parent:m[2]!,text:t});}}catch{}
  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable on the client
  setDrafts(list);},[]);
 useEffect(()=>{if(tab!=='sent'||sent)return;void db.from('zarn_messages').select('*').eq('user_id',me.user_id).is('deleted_at',null).order('created_at',{ascending:false}).limit(60).then(({data}:{data:ZMessage[]|null})=>setSent(data??[]));},[tab,sent,db,me.user_id]);
 const drop=(k:string)=>{try{localStorage.removeItem(k);}catch{}setDrafts(d=>d.filter(x=>x.key!==k));};
 const shown=drafts.filter(d=>channels.some(c=>c.id===d.channel));
 return <Page icon={<Send size={20}/>} title="Drafts & sent" sub="Messages you haven’t sent yet, and the ones you have.">
  <div className="zn-seg zn-inbox-seg"><button type="button" className={`zn-seg-btn${tab==='drafts'?' is-on':''}`} onClick={()=>setTab('drafts')}>Drafts{shown.length?` · ${shown.length}`:''}</button><button type="button" className={`zn-seg-btn${tab==='sent'?' is-on':''}`} onClick={()=>setTab('sent')}>Sent</button></div>
  {tab==='drafts'?(!shown.length?<Empty title="No drafts" text="Start typing in any chat and leave it unsent. It’s kept here until you send it."/>:
   <div className="zp-saved">{shown.map(d=>{const c=channels.find(x=>x.id===d.channel);const href=channelHref(c,d.channel);return <div key={d.key} className="zp-saved-row"><Link href={d.parent?withThread(href,d.parent):href}>
    <span className="zn-todo-from"><Send size={12}/>{d.parent?'Thread reply in ':''}{where(c)}</span><span className="zn-todo-body zn-clamp2">{d.text}</span></Link>
    <button type="button" className="zn-todo-del" aria-label="Delete draft" data-tip="Delete draft" onClick={()=>drop(d.key)}><Trash2 size={15}/></button></div>;})}</div>)
  :sent===null?<p className="zn-loading">Loading…</p>:!sent.length?<Empty title="Nothing sent yet" text="Messages you send show up here."/>:
   <div className="zp-saved">{sent.map(m=>{const c=channels.find(x=>x.id===m.channel_id),href=channelHref(c,m.channel_id);return <div key={m.id} className="zp-saved-row"><Link href={m.parent_id?withThread(href,m.parent_id):`${href}#m-${m.id}`}>
    <span className="zn-todo-from"><Send size={12}/>{m.parent_id?'Thread reply in ':'To '}{where(c)}<time className="zn-inbox-time">{dayOf(m.created_at)} {timeOf(m.created_at)}</time></span>
    <span className="zn-todo-body zn-clamp2">{plain(m.body||(m.attachments.length?'Shared a file':''),people)}</span></Link></div>;})}</div>}
 </Page>;
}
