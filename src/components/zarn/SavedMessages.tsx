'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Bookmark,Trash2} from 'lucide-react';
import {channelHref,type ZMessage} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {Avatar,dayOf,renderBody,timeOf} from './format';

// Messages you saved for later (the bookmark on any message).
export default function SavedMessages(){
 const {db,me,people,channels,title,todos,removeTodo}=useZarn();
 const [messages,setMessages]=useState<Record<string,ZMessage>>({});
 const saved=(todos??[]).filter(t=>t.message_id);
 const ids=saved.map(t=>t.message_id).join(',');
 useEffect(()=>{const list=ids?ids.split(','):[];if(!list.length)return;let live=true;void (async()=>{
  const {data}=await db.from('zarn_messages').select('*').in('id',list);
  if(live)setMessages(Object.fromEntries(((data??[]) as ZMessage[]).map(m=>[m.id,m])));
 })();return()=>{live=false;};},[db,ids]);
 if(todos===null)return <p className="zn-loading">Loading…</p>;
 if(!saved.length)return <div className="zn-empty-state"><h2>Nothing saved</h2><p>Hover a message and tap the bookmark to keep it here for later.</p></div>;
 return <div className="zp-saved">{saved.map(t=>{
  const m=t.message_id?messages[t.message_id]:undefined,c=channels.find(x=>x.id===t.channel_id);
  return <div key={t.id} className="zp-saved-row">
   <Link href={channelHref(c,t.channel_id??'')}>
    <span className="zn-todo-from"><Bookmark size={12}/>Saved from {c?(c.kind==='dm'||c.kind==='client'?title(c):`#${c.name}`):'a conversation'}</span>
    {m?<><span className="zn-todo-who"><Avatar m={people[m.user_id??'']} size={18}/><b>{people[m.user_id??'']?.display_name??'Someone'}</b><time>{dayOf(m.created_at)} {timeOf(m.created_at)}</time></span><span className="zn-todo-body">{m.deleted_at?<em>Deleted message</em>:renderBody(m.body||(m.attachments.length?'Shared a file':''),people,me.user_id)}</span></>:<span className="zn-todo-body"><em>Message unavailable</em></span>}
   </Link>
   <button type="button" className="zn-todo-del" aria-label="Remove from saved" data-tip="Remove" onClick={()=>void removeTodo(t.id)}><Trash2 size={15}/></button>
  </div>;})}</div>;
}
