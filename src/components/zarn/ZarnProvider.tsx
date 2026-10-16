'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {useRouter} from 'next/navigation';
import {browserClient} from '@/lib/supabase/browser';
import type {RealtimePostgresChangesPayload} from '@supabase/supabase-js';
type Change=RealtimePostgresChangesPayload<Record<string,unknown>>;
import {channelHref,channelTitle,type ZChannel,type ZLead,type ZMember,type ZMembership,type ZMessage,type ZReaction} from '@/lib/zarn';
import {plain} from './format';
import {playChime} from '@/lib/zarn-sound';

export type ZEvent={table:'zarn_messages';type:'INSERT'|'UPDATE'|'DELETE';row:ZMessage}|{table:'zarn_reactions';type:'INSERT'|'DELETE';row:ZReaction};
const b64=(k:string)=>{const p='='.repeat((4-k.length%4)%4),r=atob((k+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...r].map(c=>c.charCodeAt(0)));};
// Registers this browser/phone for web push so messages arrive even when ZARN is closed.
async function subscribePush(){
 try{
  const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;if(!key||!('serviceWorker' in navigator)||!('PushManager' in window))return;
  const reg=await navigator.serviceWorker.getRegistration('/zarn');if(!reg)return;
  const sub=(await reg.pushManager.getSubscription())??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(key)});
  await fetch('/api/zarn/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON()})});
 }catch{}
}
type Unread=Record<string,{unread:number;mentions:number}>;
export type ZProject={id:string;name:string;description:string;color:string;created_by:string|null;created_at:string};
export type TodoStatus='todo'|'in_progress'|'done';
export type TodoPriority='low'|'medium'|'high';
export type ZTodo={id:string;body:string;description:string;status:TodoStatus;priority:TodoPriority;message_id:string|null;channel_id:string|null;start_at:string|null;due_at:string|null;done_at:string|null;created_at:string};
export type TodoFields=Partial<Pick<ZTodo,'body'|'description'|'status'|'priority'|'start_at'|'due_at'>>;
export type Me=ZMember&{staffRole:string|null};
type Ctx={
 me:Me;people:Record<string,ZMember>;members:ZMember[];channels:ZChannel[];membership:Record<string,ZMembership>;unread:Unread;online:Set<string>;
 db:ReturnType<typeof browserClient>;reload:()=>Promise<void>;markRead:(channelId:string)=>void;subscribe:(fn:(e:ZEvent)=>void)=>()=>void;
 active:string|null;setActive:(id:string|null)=>void;title:(c:ZChannel)=>string;lead:(id:string)=>ZLead|undefined;loadLead:(id:string,force?:boolean)=>void;
 openDm:(ids:string[])=>Promise<void>;notifyOn:boolean;enableNotify:()=>void;emit:(e:ZEvent)=>void;
 projects:ZProject[]|null;reloadProjects:()=>Promise<void>;
 todos:ZTodo[]|null;saved:Record<string,string>;toggleSaved:(m:{id:string;channel_id:string})=>Promise<void>;addTodo:(fields:TodoFields&{body:string})=>Promise<void>;updateTodo:(id:string,patch:TodoFields)=>Promise<void>;removeTodo:(id:string)=>Promise<void>;
};
const ZarnCtx=createContext<Ctx|null>(null);
export const useZarn=()=>{const c=useContext(ZarnCtx);if(!c)throw new Error('ZARN context missing');return c;};

export default function ZarnProvider({me,initial,children}:{me:Me;initial:{members:ZMember[];channels:ZChannel[];membership:ZMembership[];leads?:ZLead[]};children:React.ReactNode}){
 const db=browserClient(),router=useRouter();
 const [members,setMembers]=useState(initial.members),[channels,setChannels]=useState(initial.channels);
 const [membershipRows,setMembershipRows]=useState(initial.membership);
 const [unread,setUnread]=useState<Unread>({}),[online,setOnline]=useState<Set<string>>(new Set());
 const [active,setActive]=useState<string|null>(null);
 const [leads,setLeads]=useState<Record<string,ZLead>>(()=>Object.fromEntries((initial.leads??[]).map(l=>[l.id,l])));
 const listeners=useRef(new Set<(e:ZEvent)=>void>());
 const activeRef=useRef(active);useEffect(()=>{activeRef.current=active;},[active]);
 const people=useMemo(()=>Object.fromEntries(members.map(m=>[m.user_id,m])),[members]);
 const membership=useMemo(()=>Object.fromEntries(membershipRows.map(m=>[m.channel_id,m])),[membershipRows]);
 const peopleRef=useRef(people),channelsRef=useRef(channels),membershipRef=useRef(membership);
 useEffect(()=>{peopleRef.current=people;channelsRef.current=channels;membershipRef.current=membership;},[people,channels,membership]);

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

 // Marks a conversation read on the server clock; this is also what other people see as "Seen".
 const markRead=useCallback((channelId:string)=>{
  setUnread(u=>u[channelId]?.unread||u[channelId]?.mentions?{...u,[channelId]:{unread:0,mentions:0}}:u);
  void db.rpc('zarn_mark_read',{c:channelId}).then(()=>{});
 },[db]);

 // Lead summaries are fetched once per id (force=true refetches, e.g. after a stage change).
 const requested=useRef(new Set<string>((initial.leads??[]).map(l=>l.id)));
 const loadLead=useCallback((id:string,force?:boolean)=>{
  if(requested.current.has(id)&&!force)return;requested.current.add(id);
  void db.from('zarn_leads').select('*').eq('id',id).maybeSingle().then(({data}:{data:unknown})=>{if(data)setLeads(x=>({...x,[id]:data as ZLead}));else requested.current.delete(id);});
 },[db]);

 const openDm=useCallback(async(ids:string[])=>{
  const {data,error}=await db.rpc('zarn_open_dm',{others:ids});
  if(error||!data)throw new Error('Could not open that conversation.');
  await reload();router.push(`/zarn/c/${data}`);
 },[db,reload,router]);

 const title=useCallback((c:ZChannel)=>{if(c.kind==='client'&&c.lead_id){const l=leads[c.lead_id];return l?(l.company||l.name):'Client';}return channelTitle(c,me.user_id,people);},[me.user_id,people,leads]);
 // Client spaces are named after their client, so keep those leads loaded.
 useEffect(()=>{for(const c of channels)if(c.kind==='client'&&c.lead_id)loadLead(c.lead_id);},[channels,loadLead]);

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
    // Sound for DMs, client spaces and @mentions (not every channel message), unless the conversation is muted.
    {const ch=channelsRef.current.find(x=>x.id===row.channel_id);if((mention||ch?.kind==='dm'||ch?.kind==='client')&&!membershipRef.current[row.channel_id]?.muted)playChime();}
    setUnread(u=>({...u,[row.channel_id]:{unread:(u[row.channel_id]?.unread??0)+1,mentions:(u[row.channel_id]?.mentions??0)+(mention?1:0)}}));
    const c=channelsRef.current.find(x=>x.id===row.channel_id);
    if((mention||c?.kind==='dm')&&document.visibilityState!=='visible'&&'Notification' in window&&Notification.permission==='granted'){
     const who=peopleRef.current[row.user_id??'']?.display_name??'ZARN';
     const n=new Notification(c?.kind==='dm'?who:c?.kind==='client'?`${who} in a client space`:`${who} in #${c?.name??''}`,{body:plain(row.body,peopleRef.current).slice(0,140)||'Sent an attachment',tag:row.id});
     n.onclick=()=>{window.focus();router.push(channelHref(c,row.channel_id));};
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
  const nav=navigator as Navigator&{setAppBadge?:(n?:number)=>Promise<void>;clearAppBadge?:()=>Promise<void>};
  if(total)void nav.setAppBadge?.(total).catch(()=>{});else void nav.clearAppBadge?.().catch(()=>{});
 },[unread,membership]);
 // Desktop notification permission, read from the browser (false during server render).
 const notifyOn=useSyncExternalStore(cb=>{window.addEventListener('zarn-notify',cb);return()=>window.removeEventListener('zarn-notify',cb);},()=>'Notification' in window&&Notification.permission==='granted',()=>false);
 const enableNotify=useCallback(()=>{if('Notification' in window)void Notification.requestPermission().then(async p=>{window.dispatchEvent(new Event('zarn-notify'));if(p==='granted')await subscribePush();});},[]);
 // Keep this device's push subscription registered while notifications are allowed.
 useEffect(()=>{if('Notification' in window&&Notification.permission==='granted')void subscribePush();},[]);

 const subscribe=useCallback((fn:(e:ZEvent)=>void)=>{listeners.current.add(fn);return()=>{listeners.current.delete(fn);};},[]);
 // Projects you belong to (RLS decides), for the sidebar.
 const [projects,setProjects]=useState<ZProject[]|null>(null);
 const reloadProjects=useCallback(async()=>{const {data}=await db.from('zarn_projects').select('id,name,description,color,created_by,created_at').order('created_at');setProjects((data??[]) as ZProject[]);},[db]);
 useEffect(()=>{if(me.account_type!=='guest')void reloadProjects();else setProjects([]);},[reloadProjects,me.account_type]);

 // To-dos and saved messages. Rows are only ever yours (RLS), so they load once and are edited locally.
 const [todos,setTodos]=useState<ZTodo[]|null>(null);
 useEffect(()=>{let live=true;void (async()=>{const {data}=await db.from('zarn_todos').select('id,body,description,status,priority,message_id,channel_id,start_at,due_at,done_at,created_at').eq('user_id',me.user_id).order('created_at',{ascending:false});if(live)setTodos((data??[]) as ZTodo[]);})();return()=>{live=false;};},[db,me.user_id]);
 const saved=useMemo(()=>Object.fromEntries((todos??[]).filter(t=>t.message_id).map(t=>[t.message_id!,t.id])),[todos]);
 const addTodo=useCallback(async(f:TodoFields&{body:string})=>{
  const status=f.status??'todo';
  const {data,error}=await db.from('zarn_todos').insert({user_id:me.user_id,body:f.body.trim().slice(0,500),description:(f.description??'').slice(0,2000),status,priority:f.priority??'medium',start_at:f.start_at||null,due_at:f.due_at||null,done_at:status==='done'?new Date().toISOString():null}).select('id,body,description,status,priority,message_id,channel_id,start_at,due_at,done_at,created_at').single();
  if(error)throw new Error('Could not add that to-do.');setTodos(t=>[data as ZTodo,...(t??[])]);
 },[db,me.user_id]);
 const updateTodo=useCallback(async(id:string,patch:TodoFields)=>{
  // done_at follows status so older code that only reads done_at keeps working.
  const full:Record<string,unknown>={...patch};if(patch.status)full.done_at=patch.status==='done'?new Date().toISOString():null;
  setTodos(t=>(t??[]).map(x=>x.id===id?{...x,...full} as ZTodo:x));
  const {error}=await db.from('zarn_todos').update(full).eq('id',id);
  if(error)throw new Error('Could not update that to-do.');
 },[db]);
 const removeTodo=useCallback(async(id:string)=>{
  setTodos(t=>(t??[]).filter(x=>x.id!==id));await db.from('zarn_todos').delete().eq('id',id);
 },[db]);
 const toggleSaved=useCallback(async(m:{id:string;channel_id:string})=>{
  const existing=saved[m.id];
  if(existing){await removeTodo(existing);return;}
  const {data,error}=await db.from('zarn_todos').insert({user_id:me.user_id,message_id:m.id,channel_id:m.channel_id}).select('id,body,description,status,priority,message_id,channel_id,start_at,due_at,done_at,created_at').single();
  if(!error&&data)setTodos(t=>[data as ZTodo,...(t??[])]);
 },[db,me.user_id,saved,removeTodo]);

 // Local echo: your own messages and reactions show instantly; the realtime copy is de-duplicated by id.
 const emit=useCallback((e:ZEvent)=>{listeners.current.forEach(fn=>fn(e));},[]);
 const value=useMemo<Ctx>(()=>({me,people,members,channels,membership,unread,online,db,reload,markRead,subscribe,active,setActive,title,lead:id=>leads[id],loadLead,openDm,notifyOn,enableNotify,emit,projects,reloadProjects,todos,saved,toggleSaved,addTodo,updateTodo,removeTodo}),
  [me,people,members,channels,membership,unread,online,db,reload,markRead,subscribe,active,title,leads,loadLead,openDm,notifyOn,enableNotify,emit,projects,reloadProjects,todos,saved,toggleSaved,addTodo,updateTodo,removeTodo]);
 return <ZarnCtx.Provider value={value}>{children}</ZarnCtx.Provider>;
}
