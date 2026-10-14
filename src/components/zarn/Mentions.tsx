'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {AtSign} from 'lucide-react';
import {channelHref,type ZMessage} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {Avatar,dayOf,renderBody,timeOf} from './format';

// Everywhere you were @mentioned, newest first.
export default function Mentions(){
 const {db,me,people,channels,title}=useZarn();
 const [rows,setRows]=useState<(ZMessage&{read_at:string|null})[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{void (async()=>{
  const {data:m}=await db.from('zarn_mentions').select('message_id,read_at').eq('user_id',me.user_id).order('created_at',{ascending:false}).limit(100);
  const ids=((m??[]) as {message_id:string;read_at:string|null}[]);
  if(!ids.length){setLoading(false);return;}
  const {data}=await db.from('zarn_messages').select('*').in('id',ids.map(x=>x.message_id));
  const byId=Object.fromEntries(((data??[]) as ZMessage[]).map(x=>[x.id,x]));
  setRows(ids.map(x=>byId[x.message_id]&&{...byId[x.message_id]!,read_at:x.read_at}).filter(Boolean) as (ZMessage&{read_at:string|null})[]);setLoading(false);
 })();},[db,me.user_id]);
 return <div className="zn-page">
  <header className="zn-page-head"><div><h1><AtSign size={20}/>Mentions</h1><p>Messages where someone @mentioned you or the channel.</p></div></header>
  <div className="zn-crm-list" data-lenis-prevent>
   {loading?<p className="zn-loading">Loading…</p>:rows.length?rows.map(m=>{const c=channels.find(x=>x.id===m.channel_id);return <Link key={m.id} href={channelHref(c,m.channel_id)} className={`zn-mention-row${m.read_at?'':' is-unread'}`}>
    <Avatar m={people[m.user_id??'']} size={34}/><div><p className="zn-msg-head"><b>{people[m.user_id??'']?.display_name??'Someone'}</b><span className="zn-in">in {c?(c.kind==='dm'||c.kind==='client'?title(c):`#${c.name}`):'a channel'}</span><time>{dayOf(m.created_at)} {timeOf(m.created_at)}</time></p>
    <div className="zn-body">{m.deleted_at?<em>Deleted message</em>:renderBody(m.body,people,me.user_id)}</div></div></Link>;})
   :<div className="zn-empty-state"><h2>No mentions yet</h2><p>When someone @mentions you, it shows up here.</p></div>}
  </div>
 </div>;
}
