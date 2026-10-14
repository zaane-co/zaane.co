'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {useRouter} from 'next/navigation';
import {browserClient} from '@/lib/supabase/browser';
import type {RealtimePostgresChangesPayload} from '@supabase/supabase-js';
type Change=RealtimePostgresChangesPayload<Record<string,unknown>>;
import {channelTitle,type ZChannel,type ZLead,type ZMember,type ZMembership,type ZMessage,type ZReaction} from '@/lib/zarn';
import {plain} from './format';

export type ZEvent={table:'zarn_messages';type:'INSERT'|'UPDATE'|'DELETE';row:ZMessage}|{table:'zarn_reactions';type:'INSERT'|'DELETE';row:ZReaction};
type Unread=Record<string,{unread:number;mentions:number}>;
export type Me=ZMember&{staffRole:string|null};
type Ctx={
 me:Me;people:Record<string,ZMember>;members:ZMember[];channels:ZChannel[];membership:Record<string,ZMembership>;unread:Unread;online:Set<string>;
 db:ReturnType<typeof browserClient>;reload:()=>Promise<void>;markRead:(channelId:string)=>void;subscribe:(fn:(e:ZEvent)=>void)=>()=>void;
 active:string|null;setActive:(id:string|null)=>void;title:(c:ZChannel)=>string;lead:(id:string)=>ZLead|undefined;loadLead:(id:string)=>void;
 openDm:(ids:string[])=>Promise<void>;notifyOn:boolean;enableNotify:()=>void;emit:(e:ZEvent)=>void;
};
const ZarnCtx=createContext<Ctx|null>(null);
export const useZarn=()=>{const c=useContext(ZarnCtx);if(!c)throw new Error('ZARN context missing');return c;};

export default function ZarnProvider({me,initial,children}:{me:Me;initial:{members:ZMember[];channels:ZChannel[];membership:ZMembership[]};children:React.ReactNode}){
 const db=browserClient(),router=useRouter();
 const [members,setMembers]=useState(initial.members),[channels,setChannels]=useState(initial.channels);
 const [membershipRows,setMembershipRows]=useState(initial.membership);
 const [unread,setUnread]=useState<Unread>({}),[online,setOnline]=useState<Set<string>>(new Set());
 const [active,setActive]=useState<string|null>(null);
 const [leads,setLeads]=useState<Record<string,ZLead>>({});
 const listeners=useRef(new Set<(e:ZEvent)=>void>());
 const activeRef=useRef(active);useEffect(()=>{activeRef.current=active;},[active]);
 const people=useMemo(()=>Object.fromEntries(members.map(m=>[m.user_id,m])),[members]);
 const membership=useMemo(()=>Object.fromEntries(membershipRows.map(m=>[m.channel_id,m])),[membershipRows]);
 const peopleRef=useRef(people),channelsRef=useRef(channels);
 useEffect(()=>{peopleRef.current=people;channelsRef.current=channels;},[people,channels]);

 const loadUnread=useCallback(async()=>{const {data}=await db.rpc('zarn_unread');setUnread(Object.fromEntries(((data??[]) as {channel_id:string;unread:number;mentions:number}[]).map(r=>[r.channel_id,{unread:r.unread,mentions:r.mentions}])));},[db]);
 const reload=useCallback(async()=>{
  const [{data:m},{data:c},{data:cm}]=await Promise.all([
   db.from('zarn_members').select('*').order('display_name'),
   db.from('zarn_channels').select('*').order('name'),
   db.from('zarn_channel_members').select('*').eq('user_id',me.user_id),
  ]);
  if(m)setMembers(m as ZMember[]);if(c)setChannels(c as ZChannel[]);if(cm)setMembershipRows(cm as ZMembership[]);
  await loadUnread();
 },[db,me.user_id,loadUnread]);

 const markRead=useCallback((channelId:string)=>{
  const now=new Date().toISOString();
  setUnread(u=>u[channelId]?.unread||u[channelId]?.mentions?{...u,[channelId]:{unread:0,mentions:0}}:u);
  void db.from('zarn_channel_members').update({last_read_at:now}).eq('channel_id',channelId).eq('user_id',me.user_id).then(()=>{});
  void db.from('zarn_mentions').update({read_at:now}).eq('channel_id',channelId).eq('user_id',me.user_id).is('read_at',null).then(()=>{});
 },[db,me.user_id]);

 const loadLead=useCallback((id:string)=>{
  setLeads(l=>{if(l[id])return l;void db.from('zarn_leads').select('*').eq('id',id).maybeSingle().then(({data}:{data:unknown})=>{if(data)setLeads(x=>({...x,[id]:data as ZLead}));});return l;});
 },[db]);

 const openDm=useCallback(async(ids:string[])=>{
  const {data,error}=await db.rpc('zarn_open_dm',{others:ids});
  if(error||!data)throw new Error('Could not open that conversation.');
  await reload();router.push(`/zarn/c/${data}`);
 },[db,reload,router]);

 const title=useCallback((c:ZChannel)=>channelTitle(c,me.user_id,people),[me.user_id,people]);

 // Initial unread + live updates.
 useEffect(()=>{void db.rpc('zarn_unread').then(({data}:{data:unknown})=>setUnread(Object.fromEntries(((data??[]) as {channel_id:string;unread:number;mentions:number}[]).map(r=>[r.channel_id,{unread:r.unread,mentions:r.mentions}]))));},[db]);
 useEffect(()=>{
  const ch=db.channel('zarn-db')
   .on('postgres_changes',{event:'*',schema:'public',table:'zarn_messages'},(p:Change)=>{
    const row=(p.eventType==='DELETE'?p.old:p.new) as unknown as ZMessage;
    listeners.current.forEach(fn=>fn({table:'zarn_messages',type:p.eventType,row}));
    if(p.eventType!=='INSERT'||row.parent_id||row.user_id===me.user_id)return;
    const mention=row.body.includes(`<@${me.user_id}>`)||row.body.includes('<!channel>');
    if(row.channel_id===activeRef.current&&document.visibilityState==='visible')return;
    setUnread(u=>({...u,[row.channel_id]:{unread:(u[row.channel_id]?.unread??0)+1,mentions:(u[row.channel_id]?.mentions??0)+(mention?1:0)}}));
    const c=channelsRef.current.find(x=>x.id===row.channel_id);
    if((mention||c?.kind==='dm')&&document.visibilityState!=='visible'&&'Notification' in window&&Notification.permission==='granted'){
     const who=peopleRef.current[row.user_id??'']?.display_name??'ZARN';
     const n=new Notification(c?.kind==='dm'?who:`${who} in #${c?.name??''}`,{body:plain(row.body,peopleRef.current).slice(0,140)||'Sent an attachment',tag:row.id});
     n.onclick=()=>{window.focus();router.push(`/zarn/c/${row.channel_id}`);};
    }
   })
   .on('postgres_changes',{event:'*',schema:'public',table:'zarn_reactions'},(p:Change)=>{
    const row=(p.eventType==='DELETE'?p.old:p.new) as unknown as ZReaction;
    listeners.current.forEach(fn=>fn({table:'zarn_reactions',type:p.eventType as 'INSERT'|'DELETE',row}));
   })
   .on('postgres_changes',{event:'*',schema:'public',table:'zarn_channel_members',filter:`user_id=eq.${me.user_id}`},()=>{void reload();})
   .on('postgres_changes',{event:'*',schema:'public',table:'zarn_channels'},()=>{void reload();})
   .subscribe();
  const presence=db.channel('zarn-presence',{config:{presence:{key:me.user_id}}});
  presence.on('presence',{event:'sync'},()=>setOnline(new Set(Object.keys(presence.presenceState()))))
   .subscribe(async (status:string)=>{if(status==='SUBSCRIBED')await presence.track({at:Date.now()});});
  const seen=setInterval(()=>{void db.from('zarn_members').update({last_seen_at:new Date().toISOString()}).eq('user_id',me.user_id).then(()=>{});},5*60*1000);
  return()=>{void db.removeChannel(ch);void db.removeChannel(presence);clearInterval(seen);};
 },[db,me.user_id,reload,router]);

 // Unread total in the tab title.
 useEffect(()=>{
  const total=Object.entries(unread).reduce((t,[id,u])=>t+(membership[id]?.muted?u.mentions:u.unread),0);
  document.title=total?`(${total}) ZARN`:'ZARN';
 },[unread,membership]);
 // Desktop notification permission, read from the browser (false during server render).
 const notifyOn=useSyncExternalStore(cb=>{window.addEventListener('zarn-notify',cb);return()=>window.removeEventListener('zarn-notify',cb);},()=>'Notification' in window&&Notification.permission==='granted',()=>false);
 const enableNotify=useCallback(()=>{if('Notification' in window)void Notification.requestPermission().then(()=>window.dispatchEvent(new Event('zarn-notify')));},[]);

 const subscribe=useCallback((fn:(e:ZEvent)=>void)=>{listeners.current.add(fn);return()=>{listeners.current.delete(fn);};},[]);
 // Local echo: your own messages and reactions show instantly; the realtime copy is de-duplicated by id.
 const emit=useCallback((e:ZEvent)=>{listeners.current.forEach(fn=>fn(e));},[]);
 const value=useMemo<Ctx>(()=>({me,people,members,channels,membership,unread,online,db,reload,markRead,subscribe,active,setActive,title,lead:id=>leads[id],loadLead,openDm,notifyOn,enableNotify,emit}),
  [me,people,members,channels,membership,unread,online,db,reload,markRead,subscribe,active,title,leads,loadLead,openDm,notifyOn,enableNotify,emit]);
 return <ZarnCtx.Provider value={value}>{children}</ZarnCtx.Provider>;
}
