'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {useRouter} from 'next/navigation';
import {browserClient} from '@/lib/supabase/browser';
import type {RealtimePostgresChangesPayload} from '@supabase/supabase-js';
type Change=RealtimePostgresChangesPayload<Record<string,unknown>>;
import {channelHref,channelTitle,type ZChannel,type ZLead,type ZMember,type ZMembership,type ZMessage,type ZReaction} from '@/lib/zarn';
import {plain} from './format';
import {playChime,getSound} from '@/lib/zarn-sound';
import {subscribePush} from '@/lib/zarn-push-client';

export type ZEvent={table:'zarn_messages';type:'INSERT'|'UPDATE'|'DELETE';row:ZMessage}|{table:'zarn_reactions';type:'INSERT'|'DELETE';row:ZReaction};
type Unread=Record<string,{unread:number;mentions:number}>;
export type ZProject={id:string;name:string;description:string;color:string;created_by:string|null;created_at:string};
export type TodoStatus='todo'|'in_progress'|'done';
export type TodoPriority='low'|'medium'|'high';
export type ZTodo={id:string;body:string;description:string;status:TodoStatus;priority:TodoPriority;message_id:string|null;channel_id:string|null;start_at:string|null;due_at:string|null;done_at:string|null;created_at:string};
export type TodoFields=Partial<Pick<ZTodo,'body'|'description'|'status'|'priority'|'start_at'|'due_at'>>;
export type Me=ZMember&{staffRole:string|null};
export type ZInvite={channel_id:string;name:string|null;topic:string;inviter:string;created_at:string};
type Ctx={
 invites:ZInvite[];reloadInvites:()=>Promise<void>;
 me:Me;people:Record<string,ZMember>;members:ZMember[];channels:ZChannel[];membership:Record<string,ZMembership>;unread:Unread;online:Set<string>;
 db:ReturnType<typeof browserClient>;reload:()=>Promise<void>;markRead:(channelId:string)=>void;subscribe:(fn:(e:ZEvent)=>void)=>()=>void;
 active:string|null;setActive:(id:string|null)=>void;title:(c:ZChannel)=>string;lead:(id:string)=>ZLead|undefined;loadLead:(id:string,force?:boolean)=>void;
 openDm:(ids:string[])=>Promise<void>;notifyOn:boolean;enableNotify:()=>void;emit:(e:ZEvent)=>void;
 projects:ZProject[]|null;reloadProjects:()=>Promise<void>;dueTasks:number;refreshDue:()=>Promise<void>;
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
 const unreadReady=useRef(false),memberTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const activeRef=useRef(active);useEffect(()=>{activeRef.current=active;},[active]);
 const people=useMemo(()=>Object.fromEntries(members.map(m=>[m.user_id,m])),[members]);
 const membership=useMemo(()=>Object.fromEntries(membershipRows.map(m=>[m.channel_id,m])),[membershipRows]);
 const peopleRef=useRef(people),channelsRef=useRef(channels),membershipRef=useRef(membership);
 useEffect(()=>{peopleRef.current=people;channelsRef.current=channels;membershipRef.current=membership;},[people,channels,membership]);

 const loadUnread=useCallback(async()=>{
  const {data}=await db.rpc('zarn_unread');
  const map=Object.fromEntries(((data??[]) as {channel_id:string;unread:number;mentions:number}[]).map(r=>[r.channel_id,{unread:r.unread,mentions:r.mentions}]));
  // The conversation on screen is never unread: if a refresh raced the read mark, mark it read again.
  const open=activeRef.current;
  if(open&&document.visibilityState==='visible'&&(map[open]?.unread||map[open]?.mentions)){map[open]={unread:0,mentions:0};void db.rpc('zarn_mark_read',{c:open}).then(()=>{});}
  setUnread(map);unreadReady.current=true;
 },[db]);
 const [invites,setInvites]=useState<ZInvite[]>([]);
 const reloadInvites=useCallback(async()=>{
  try{const r=await fetch('/api/zarn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invites'})});const d=await r.json();if(r.ok)setInvites(d.invites??[]);}catch{}
 },[]);
 useEffect(()=>{
  void reloadInvites();
  const ch=db.channel(`zarn-invites-${me.user_id}`).on('postgres_changes',{event:'*',schema:'public',table:'zarn_channel_invites',filter:`user_id=eq.${me.user_id}`},()=>{void reloadInvites();}).subscribe();
  return()=>{void db.removeChannel(ch);};
 // eslint-disable-next-line react-hooks/set-state-in-effect
 },[db,me.user_id,reloadInvites]);
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

 // Anything sent while this person was offline counts as delivered once ZARN is open again.
 useEffect(()=>{
  const mark=()=>{if(document.visibilityState==='visible')void db.rpc('zarn_mark_delivered',{c:null});};
  mark();document.addEventListener('visibilitychange',mark);window.addEventListener('online',mark);
  return()=>{document.removeEventListener('visibilitychange',mark);window.removeEventListener('online',mark);};
 },[db]);
 // Initial unread + live updates.
 // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves, not synchronously
 useEffect(()=>{void loadUnread();},[loadUnread]);
 useEffect(()=>{
  const ch=db.channel('zarn-db')
   .on('postgres_changes',{event:'*',schema:'public',table:'zarn_messages'},(p:Change)=>{
    const row=(p.eventType==='DELETE'?p.old:p.new) as unknown as ZMessage;
    listeners.current.forEach(fn=>fn({table:'zarn_messages',type:p.eventType,row}));
    if(p.eventType!=='INSERT'||row.parent_id||row.user_id===me.user_id)return;
    // This app has the message, so the sender's tick moves from Sent to Delivered.
    if(membershipRef.current[row.channel_id])void db.rpc('zarn_mark_delivered',{c:row.channel_id});
    const mention=row.body.includes(`<@${me.user_id}>`)||row.body.includes('<!channel>');
    if(row.channel_id===activeRef.current&&document.visibilityState==='visible')return;
    // Sound for DMs, client spaces and @mentions (not every channel message), unless the conversation is muted.
    {const ch=channelsRef.current.find(x=>x.id===row.channel_id);if((mention||ch?.kind==='dm'||ch?.kind==='client'||getSound().scope==='all')&&!membershipRef.current[row.channel_id]?.muted)playChime();}
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
   .on('postgres_changes',{event:'*',schema:'public',table:'zarn_channel_members',filter:`user_id=eq.${me.user_id}`},(p:Change)=>{
    // Reading and delivery stamps change this row constantly; only a real change (joined, left, muted, starred) needs a reload.
    if(p.eventType==='UPDATE'&&p.old&&p.new&&p.old.muted===p.new.muted&&p.old.starred===p.new.starred)return;
    void reload();
   })
   .on('postgres_changes',{event:'*',schema:'public',table:'zarn_channels'},()=>{void reload();})
   .on('postgres_changes',{event:'*',schema:'public',table:'zarn_members'},(p:Change)=>{
    // Heartbeat updates (last seen) fire constantly; only a real change to a person needs a refresh of the team list.
    if(p.eventType==='UPDATE'&&p.old&&p.new){const {last_seen_at:_a,...before}=p.old as Record<string,unknown>,{last_seen_at:_b,...after}=p.new as Record<string,unknown>;void _a;void _b;if(JSON.stringify(before)===JSON.stringify(after))return;}
    if(memberTimer.current)clearTimeout(memberTimer.current);
    memberTimer.current=setTimeout(()=>{void reload();},400);
   })
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
 // Notifications that were sent for a conversation disappear from the phone's notification list once it has been read.
 useEffect(()=>{
  if(!unreadReady.current||!('serviceWorker' in navigator))return;
  void navigator.serviceWorker.getRegistration('/zarn').then(reg=>reg?.getNotifications()).then(list=>{
   list?.forEach(n=>{const c=(n.data as {channel?:string}|undefined)?.channel;if(!c)return;const u=unread[c];const pending=membership[c]?.muted?(u?.mentions??0):(u?.unread??0);if(!pending)n.close();});
  }).catch(()=>{});
 },[unread,membership]);
 // Desktop notification permission, read from the browser (false during server render).
 const notifyOn=useSyncExternalStore(cb=>{window.addEventListener('zarn-notify',cb);return()=>window.removeEventListener('zarn-notify',cb);},()=>'Notification' in window&&Notification.permission==='granted',()=>false);
 const enableNotify=useCallback(()=>{if(!('Notification' in window)){void subscribePush();return;}void Notification.requestPermission().then(async()=>{window.dispatchEvent(new Event('zarn-notify'));await subscribePush();});},[]);
 // Keep this device's push subscription registered while notifications are allowed.
 useEffect(()=>{if('Notification' in window&&Notification.permission==='granted')void subscribePush();},[]);

 const subscribe=useCallback((fn:(e:ZEvent)=>void)=>{listeners.current.add(fn);return()=>{listeners.current.delete(fn);};},[]);
 // Projects you belong to (RLS decides), for the sidebar.
 const [projects,setProjects]=useState<ZProject[]|null>(null);
 const reloadProjects=useCallback(async()=>{const {data}=await db.from('zarn_projects').select('id,name,description,color,created_by,created_at').order('created_at');setProjects((data??[]) as ZProject[]);},[db]);
 useEffect(()=>{if(me.account_type!=='guest')void reloadProjects();else setProjects([]);},[reloadProjects,me.account_type]);

 // Open tasks assigned to you that are due today or already late, for the sidebar badge.
 const [dueTasks,setDueTasks]=useState(0);
 const refreshDue=useCallback(async()=>{
  const {data:a}=await db.from('zarn_task_assignees').select('task_id').eq('user_id',me.user_id);
  const ids=((a??[]) as {task_id:string}[]).map(x=>x.task_id).slice(0,500);
  if(!ids.length){setDueTasks(0);return;}
  const {count}=await db.from('zarn_tasks').select('id',{count:'exact',head:true}).in('id',ids).neq('status','done').lte('due_at',new Date().toISOString().slice(0,10));
  setDueTasks(count??0);
 },[db,me.user_id]);
 useEffect(()=>{if(me.account_type!=='guest')void refreshDue();},[refreshDue,me.account_type]);

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
 const value=useMemo<Ctx>(()=>({invites,reloadInvites,me,people,members,channels,membership,unread,online,db,reload,markRead,subscribe,active,setActive,title,lead:id=>leads[id],loadLead,openDm,notifyOn,enableNotify,emit,projects,reloadProjects,dueTasks,refreshDue,todos,saved,toggleSaved,addTodo,updateTodo,removeTodo}),
  [invites,reloadInvites,me,people,members,channels,membership,unread,online,db,reload,markRead,subscribe,active,title,leads,loadLead,openDm,notifyOn,enableNotify,emit,projects,reloadProjects,dueTasks,refreshDue,todos,saved,toggleSaved,addTodo,updateTodo,removeTodo]);
 return <ZarnCtx.Provider value={value}>{children}</ZarnCtx.Provider>;
}
