'use client';
import {Fragment,useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useCall} from './CallProvider';
import {useConfirm} from './ConfirmProvider';
import {Bell,BellOff,Briefcase,FolderKanban,Hash,Info,Lock,Phone,Pin,Star,Trash2,UserPlus,Video,X} from 'lucide-react';
import {zarnApi,type ZChannel,type ZMessage,type ZReaction} from '@/lib/zarn';
import {useZarn,type ZEvent} from './ZarnProvider';
import Message from './Message';
import Composer from './Composer';
import {Avatar,dayOf,renderBody} from './format';
import {PeoplePicker} from './Dialogs';
import {useShell} from './nav';

const PAGE=50;
const sameGroup=(a:ZMessage|undefined,b:ZMessage)=>!!a&&a.kind==='user'&&b.kind==='user'&&a.user_id===b.user_id&&!a.deleted_at&&new Date(b.created_at).getTime()-new Date(a.created_at).getTime()<5*60000&&dayOf(a.created_at)===dayOf(b.created_at);

// embedded: rendered inside a client space or project (no channel header; that page has its own).
export default function ChannelView({id,embedded}:{id:string;embedded?:boolean}){
 const z=useZarn(),{db,me,people,channels,membership,subscribe,markRead,setActive,title}=z,router=useRouter(),{profile}=useShell(),call=useCall();
 const channel=channels.find(c=>c.id===id);
 const [messages,setMessages]=useState<ZMessage[]>([]),[reactions,setReactions]=useState<ZReaction[]>([]);
 const [loading,setLoading]=useState(true),[more,setMore]=useState(false),[thread,setThread]=useState<ZMessage|null>(null);
 const [details,setDetails]=useState(false),[typing,setTyping]=useState<Record<string,{at:number;thread:string|null}>>({});
 const list=useRef<HTMLDivElement>(null),stick=useRef(true),typingCh=useRef<ReturnType<typeof db.channel>|null>(null),lastTyping=useRef(0);
 const joined=!!membership[id];
 // Admins can read and post in client spaces and projects they aren't on.
 const canPost=joined||((channel?.kind==='client'||channel?.kind==='project')&&(me.staffRole==='super_admin'||me.staffRole==='admin'));
 useEffect(()=>{if(channel?.kind==='client'&&!embedded&&channel.lead_id)router.replace(`/zarn/clients/${channel.lead_id}`);if(channel?.kind==='project'&&!embedded&&channel.project_id)router.replace(`/zarn/projects/${channel.project_id}?view=chat`);},[channel,embedded,router]);
 const counted=useRef(new Set<string>());
 // Read receipts: each member's last_read_at in this channel, kept live.
 const [reads,setReads]=useState<Record<string,string>>({}),[delivs,setDelivs]=useState<Record<string,string>>({});

 const load=useCallback(async(before?:string)=>{
  let q=db.from('zarn_messages').select('*').eq('channel_id',id).is('parent_id',null).order('created_at',{ascending:false}).limit(PAGE);
  if(before)q=q.lt('created_at',before);
  const {data}=await q;const rows=((data??[]) as ZMessage[]).reverse();
  if(rows.length){const {data:r}=await db.from('zarn_reactions').select('*').in('message_id',rows.map(m=>m.id));setReactions(x=>[...x.filter(y=>!rows.some(m=>m.id===y.message_id)),...((r??[]) as ZReaction[])]);}
  setMore(rows.length===PAGE);return rows;
 },[db,id]);
 // The page remounts this view per channel (key=id), so first load starts from fresh state.
 // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves, not synchronously
 useEffect(()=>{void load().then(rows=>{setMessages(rows);setLoading(false);});},[load]);
 // Safety net for live updates: phones drop the realtime socket when the app is backgrounded or the network blips, and anything
 // sent meanwhile (new messages, edits, deletes) is never replayed. Re-read the latest page on return/reconnect and every 20s while visible.
 useEffect(()=>{
  const sync=()=>{if(document.visibilityState!=='visible')return;void load().then(rows=>setMessages(cur=>{
   const byId=new Map(rows.map(r=>[r.id,r])),have=new Set(cur.map(x=>x.id));
   const stale=(x:ZMessage,r?:ZMessage)=>!!r&&(r.body!==x.body||r.edited_at!==x.edited_at||r.deleted_at!==x.deleted_at||r.reply_count!==x.reply_count||r.pinned_at!==x.pinned_at);
   const fresh=rows.filter(r=>!have.has(r.id));
   if(!fresh.length&&!cur.some(x=>stale(x,byId.get(x.id))))return cur;
   return cur.map(x=>stale(x,byId.get(x.id))?byId.get(x.id)!:x).concat(fresh).sort((a,b)=>a.created_at<b.created_at?-1:1);
  }));};
  const t=setInterval(sync,20000);
  document.addEventListener('visibilitychange',sync);window.addEventListener('online',sync);window.addEventListener('focus',sync);
  return()=>{clearInterval(t);document.removeEventListener('visibilitychange',sync);window.removeEventListener('online',sync);window.removeEventListener('focus',sync);};
 },[load]);
 useEffect(()=>{setActive(id);if(joined)markRead(id);return()=>setActive(null);},[id,joined,markRead,setActive]);
 // Tells the app which thread is on screen, so replies you're already reading don't ring or notify.
 useEffect(()=>{z.setActiveThread(thread?.id??null);return()=>z.setActiveThread(null);},[thread?.id]); // eslint-disable-line react-hooks/exhaustive-deps

 // Live updates for this channel.
 useEffect(()=>subscribe((e:ZEvent)=>{
  if(e.table==='zarn_messages'){
   const m=e.row;if(m.channel_id!==id)return;
   // Replies arrive twice (local echo + realtime), so each reply id bumps its parent's count once.
   if(m.parent_id){if(e.type==='INSERT'&&!counted.current.has(m.id)){counted.current.add(m.id);setMessages(list=>list.map(x=>x.id===m.parent_id?{...x,reply_count:x.reply_count+1,last_reply_at:m.created_at}:x));}
    if(e.type==='DELETE'&&counted.current.delete(m.id))setMessages(list=>list.map(x=>x.id===m.parent_id?{...x,reply_count:Math.max(0,x.reply_count-1)}:x));return;}
   if(e.type==='INSERT'){setMessages(list=>list.some(x=>x.id===m.id)?list.map(x=>x.id===m.id?m:x):[...list,m]);if(document.visibilityState==='visible'&&joined)markRead(id);}
   else if(e.type==='UPDATE')setMessages(list=>list.map(x=>x.id===m.id?{...x,...m}:x));
   else setMessages(list=>list.filter(x=>x.id!==m.id));
   setThread(t=>t&&t.id===m.id?{...t,...m}:t);
  }else{
   const r=e.row;
   if(e.type==='INSERT'){if(r.channel_id===id)setReactions(x=>x.some(y=>y.message_id===r.message_id&&y.user_id===r.user_id&&y.emoji===r.emoji)?x:[...x,r]);}
   else setReactions(x=>x.filter(y=>!(y.message_id===r.message_id&&y.user_id===r.user_id&&y.emoji===r.emoji)));
  }
 }),[subscribe,id,joined,markRead]);
 useEffect(()=>{
  void db.from('zarn_channel_members').select('user_id,last_read_at,delivered_at').eq('channel_id',id).then(({data}:{data:{user_id:string;last_read_at:string;delivered_at:string}[]|null})=>{setReads(Object.fromEntries((data??[]).map(r=>[r.user_id,r.last_read_at])));setDelivs(Object.fromEntries((data??[]).map(r=>[r.user_id,r.delivered_at])));});
  const ch=db.channel(`zarn-reads-${id}`).on('postgres_changes',{event:'*',schema:'public',table:'zarn_channel_members',filter:`channel_id=eq.${id}`},(p:{eventType:string;new:Record<string,string>;old:Record<string,string>})=>{
   if(p.eventType==='DELETE')setReads(r=>{const n={...r};delete n[p.old.user_id!];return n;});
   else{setReads(r=>({...r,[p.new.user_id!]:p.new.last_read_at!}));setDelivs(r=>({...r,[p.new.user_id!]:p.new.delivered_at as string}));}
  }).subscribe();
  return()=>{void db.removeChannel(ch);};
 },[db,id]);
 const others=Object.keys(reads).filter(u=>u!==me.user_id);
 const receipt=(m:ZMessage)=>m.user_id!==me.user_id||m.kind!=='user'||m.deleted_at?undefined:{pending:!!m.pending,seen:others.filter(u=>reads[u]!>=m.created_at).map(u=>({id:u,at:reads[u]!})),unseen:others.filter(u=>!(reads[u]!>=m.created_at)),delivered:others.filter(u=>!(reads[u]!>=m.created_at)&&delivs[u]!>=m.created_at)};
 // Typing indicator over a broadcast channel (no database writes).
 useEffect(()=>{
  const ch=db.channel(`zarn-typing-${id}`).on('broadcast',{event:'typing'},({payload}:{payload:{user:string;thread?:string|null}})=>{if(payload.user!==me.user_id)setTyping(t=>({...t,[payload.user]:{at:Date.now(),thread:payload.thread??null}}));}).subscribe();
  typingCh.current=ch;const tick=setInterval(()=>setTyping(t=>{const now=Date.now(),n=Object.fromEntries(Object.entries(t).filter(([,v])=>now-v.at<4000));return Object.keys(n).length===Object.keys(t).length?t:n;}),1500);
  return()=>{clearInterval(tick);void db.removeChannel(ch);typingCh.current=null;};
 },[db,id,me.user_id]);
 const onTyping=(thread:string|null=null)=>{const now=Date.now();if(now-lastTyping.current>2500){lastTyping.current=now;void typingCh.current?.send({type:'broadcast',event:'typing',payload:{user:me.user_id,thread}});}};
 useEffect(()=>{const on=()=>{if(document.visibilityState==='visible'&&joined)markRead(id);};document.addEventListener('visibilitychange',on);return()=>document.removeEventListener('visibilitychange',on);},[id,joined,markRead]);

 // Keep pinned to the bottom unless the reader scrolled up.
 useLayoutEffect(()=>{const el=list.current;if(el&&stick.current)el.scrollTop=el.scrollHeight;},[messages,loading]);
 async function onScroll(){
  const el=list.current!;stick.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;
  if(el.scrollTop<60&&more&&!loading&&messages[0]){
   setLoading(true);const h=el.scrollHeight;const older=await load(messages[0].created_at);
   setMessages(list=>[...older,...list]);setLoading(false);requestAnimationFrame(()=>{el.scrollTop=el.scrollHeight-h;});
  }
 }
 async function join(){await db.from('zarn_channel_members').insert({channel_id:id,user_id:me.user_id});await z.reload();}

 if(!channel)return <div className="zn-empty-state"><h2>Channel not found</h2><p>It may have been deleted, or you don’t have access.</p><button type="button" className="zn-btn" onClick={()=>router.push('/zarn')}>Back to ZARN</button></div>;
 // The channel line shows people typing in the main box; the thread panel shows people typing a reply to that thread.
 const typersIn=(thread:string|null)=>Object.entries(typing).filter(([,v])=>v.thread===thread).map(([u])=>people[u]?.display_name).filter(Boolean) as string[];
 const typers=typersIn(null);
 const pinned=messages.filter(m=>m.pinned_at&&!m.deleted_at);
 return <div className={`zn-channel${thread?' has-thread':''}`}>
  <div className="zn-chan-main">
   {!embedded&&<header className="zn-chan-head">
    <button type="button" className="zn-chan-title" onClick={()=>{const other=channel.kind==='dm'?(channel.dm_key??'').split(',').filter(u=>u!==me.user_id):[];if(other.length===1)profile(other[0]!);else setDetails(true);}}>{channel.kind==='dm'?null:channel.kind==='private'?<Lock size={16}/>:<Hash size={17}/>}<h1>{title(channel)}</h1></button>
    {(()=>{
     const dmOther=channel.kind==='dm'?(channel.dm_key??'').split(',').find(u=>u!==me.user_id):undefined;
     if(typers.length)return <p className="zn-topic is-typing">{channel.kind==='dm'?'typing':`${typers.join(', ')} ${typers.length>1?'are':'is'} typing`}<i className="zn-dots"><b/><b/><b/></i></p>;
     if(dmOther)return <p className="zn-topic">{z.online.has(dmOther)?<span className="zn-online">online</span>:lastSeen(people[dmOther]?.last_seen_at)}</p>;
     return channel.topic?<p className="zn-topic" title={channel.topic}>{channel.topic}</p>:null;
    })()}
    <div className="zn-head-actions">
     {(()=>{const o=channel.kind==='dm'?(channel.dm_key??'').split(',').filter(u=>u!==me.user_id):[];return o.length===1&&joined&&!!people[o[0]!]&&!people[o[0]!]?.deactivated_at?<button type="button" aria-label="Voice call" data-tip={call.busy?'You’re on a call':'Voice call'} disabled={call.busy} onClick={()=>void call.start(channel.id,o[0]!)}><Phone size={16}/></button>:null;})()}
     {(()=>{const o=channel.kind==='dm'?(channel.dm_key??'').split(',').filter(u=>u!==me.user_id):[];return o.length===1&&joined&&!!people[o[0]!]&&!people[o[0]!]?.deactivated_at?<button type="button" aria-label="Video call" data-tip={call.busy?'You’re on a call':'Video call'} disabled={call.busy} onClick={()=>void call.start(channel.id,o[0]!,{video:true})}><Video size={16}/></button>:null;})()}
     {pinned.length>0&&<button type="button" data-tip="Pinned messages" onClick={()=>setDetails(true)}><Pin size={16}/><span>{pinned.length}</span></button>}
     {joined&&<button type="button" aria-label={membership[id]?.starred?'Unstar':'Star'} data-tip={membership[id]?.starred?'Unstar':'Star'} className={membership[id]?.starred?'is-on':''} onClick={async()=>{await db.from('zarn_channel_members').update({starred:!membership[id]?.starred}).eq('channel_id',id).eq('user_id',me.user_id);await z.reload();}}><Star size={16}/></button>}
     <button type="button" aria-label="Channel details" data-tip="Details" onClick={()=>setDetails(true)}><Info size={16}/></button>
    </div>
   </header>}
   <div className="zn-messages" ref={list} onScroll={()=>void onScroll()} data-lenis-prevent>
    {!more&&!loading&&<ChannelIntro c={channel}/>}
    {loading&&!messages.length?<div className="zn-loading">Loading messages…</div>:messages.map((m,i)=>{
     const prev=messages[i-1],newDay=!prev||dayOf(prev.created_at)!==dayOf(m.created_at);
     return <Fragment key={m.id}>{newDay&&<div className="zn-day"><span>{dayOf(m.created_at)}</span></div>}
      <Message m={m} reactions={reactions.filter(r=>r.message_id===m.id)} compact={!newDay&&sameGroup(prev,m)} onThread={setThread} receipt={receipt(m)}/></Fragment>;
    })}
   </div>
   <div className="zn-typing">{typers.length>0&&<>{`${typers.join(', ')} ${typers.length>1?'are':'is'} typing`}<i className="zn-dots"><b/><b/><b/></i></>}</div>
   {canPost?<Composer channelId={id} placeholder={`Message ${channel.kind==='dm'?title(channel):channel.kind==='client'?`the ${title(channel)} team`:channel.kind==='project'?`the ${channel.name??'project'} team`:'#'+channel.name}`} onSent={()=>{stick.current=true;}} onTyping={()=>onTyping(null)} disabled={channel.archived_at?'This channel is archived.':channel.kind==='dm'&&(channel.dm_key??'').split(',').some(u=>u!==me.user_id&&(!people[u]||people[u]?.deactivated_at))?'This person’s account was deactivated, so you can’t message them.':undefined}/>
    :<div className="zn-join"><p>You’re previewing <b>#{channel.name}</b>.</p><button type="button" className="zn-btn is-primary" onClick={()=>void join()}>Join channel</button></div>}
  </div>
  {thread&&<Thread parent={thread} typers={typersIn(thread.id)} onTyping={()=>onTyping(thread.id)} onClose={()=>setThread(null)}/>}
  {details&&<Details c={channel} pinned={pinned} onClose={()=>setDetails(false)} onJump={mid=>{setDetails(false);document.getElementById(`m-${mid}`)?.scrollIntoView({block:'center',behavior:'smooth'});}}/>}
 </div>;
}

function ChannelIntro({c}:{c:ZChannel}){
 const {title}=useZarn();
 return <div className="zn-intro"><span className="zn-intro-icon">{c.kind==='dm'?'@':c.kind==='client'?<Briefcase size={22}/>:c.kind==='project'?<FolderKanban size={22}/>:c.kind==='private'?<Lock size={22}/>:<Hash size={24}/>}</span>
  <h2>{c.kind==='dm'?title(c):c.kind==='client'?`${title(c)} team chat`:c.kind==='project'?`${c.name} team chat`:`Welcome to #${c.name}`}</h2>
  <p>{c.kind==='client'?'Private to this client’s team and admins. Nobody else on ZARN can see it.':c.kind==='project'?'Everyone on this project is here. Add people to the project and they join the chat too.':c.kind==='dm'?'This is the start of your direct conversation.':c.crm_feed?`CRM updates (${c.crm_feed==='leads'?'new leads and stage changes':'invoices sent and paid'}) are posted here automatically.`:c.topic||'This is the very beginning of the channel.'}</p></div>;
}

function Thread({parent,typers,onTyping,onClose}:{parent:ZMessage;typers:string[];onTyping:()=>void;onClose:()=>void}){
 const {db,subscribe,me,people}=useZarn();
 const [replies,setReplies]=useState<ZMessage[]>([]),[reactions,setReactions]=useState<ZReaction[]>([]);
 const end=useRef<HTMLDivElement>(null);
 const loadReplies=useCallback(async()=>{
  const {data}=await db.from('zarn_messages').select('*').eq('parent_id',parent.id).order('created_at');const rows=(data??[]) as ZMessage[];
  // Keep replies still being sent (not in the database yet); take everything else as the database has it.
  setReplies(cur=>{const ids=new Set(rows.map(r=>r.id));const next=[...rows,...cur.filter(x=>x.pending&&!ids.has(x.id))];
   return next.length===cur.length&&next.every((x,i)=>x.id===cur[i].id&&x.body===cur[i].body&&x.edited_at===cur[i].edited_at&&x.deleted_at===cur[i].deleted_at)?cur:next;});
  const ids=[parent.id,...rows.map(r=>r.id)];const {data:r}=await db.from('zarn_reactions').select('*').in('message_id',ids);setReactions((r??[]) as ZReaction[]);
 },[db,parent.id]);
 useEffect(()=>{void loadReplies();},[loadReplies]);
 // Same safety net as the channel: the realtime socket drops in the background and misses are never replayed.
 useEffect(()=>{
  const sync=()=>{if(document.visibilityState==='visible')void loadReplies();};
  const t=setInterval(sync,20000);
  document.addEventListener('visibilitychange',sync);window.addEventListener('online',sync);window.addEventListener('focus',sync);
  return()=>{clearInterval(t);document.removeEventListener('visibilitychange',sync);window.removeEventListener('online',sync);window.removeEventListener('focus',sync);};
 },[loadReplies]);
 useEffect(()=>subscribe(e=>{
  if(e.table==='zarn_messages'){const m=e.row;if(m.parent_id!==parent.id)return;
   if(e.type==='INSERT')setReplies(l=>l.some(x=>x.id===m.id)?l.map(x=>x.id===m.id?m:x):[...l,m]);else if(e.type==='DELETE')setReplies(l=>l.filter(x=>x.id!==m.id));else setReplies(l=>l.map(x=>x.id===m.id?{...x,...m}:x));}
  else{const r=e.row;if(e.type==='INSERT')setReactions(x=>x.some(y=>y.message_id===r.message_id&&y.user_id===r.user_id&&y.emoji===r.emoji)?x:[...x,r]);else setReactions(x=>x.filter(y=>!(y.message_id===r.message_id&&y.user_id===r.user_id&&y.emoji===r.emoji)));}
 }),[subscribe,parent.id]);
 useEffect(()=>{end.current?.scrollIntoView({block:'end'});},[replies.length]);
 return <aside className="zn-thread">
  <header><div><h2>Thread</h2><small>{parent.kind==='crm'?'CRM update':people[parent.user_id??'']?.display_name??''}</small></div><button type="button" aria-label="Close thread" onClick={onClose}><X size={18}/></button></header>
  <div className="zn-thread-body" data-lenis-prevent>
   <Message m={parent} reactions={reactions.filter(r=>r.message_id===parent.id)} compact={false} inThread/>
   <div className="zn-thread-count"><span>{replies.length} repl{replies.length===1?'y':'ies'}</span></div>
   {replies.map((m,i)=><Message key={m.id} m={m} reactions={reactions.filter(r=>r.message_id===m.id)} compact={sameGroup(replies[i-1],m)} inThread/>)}
   <div ref={end}/>
  </div>
  <div className="zn-typing">{typers.length>0&&<>{`${typers.join(', ')} ${typers.length>1?'are':'is'} typing`}<i className="zn-dots"><b/><b/><b/></i></>}</div>
  <Composer channelId={parent.channel_id} parentId={parent.id} placeholder="Reply…" onTyping={onTyping}/>
  <span hidden>{me.user_id}</span>
 </aside>;
}

function Details({c,pinned,onClose,onJump}:{c:ZChannel;pinned:ZMessage[];onClose:()=>void;onJump:(id:string)=>void}){
 const {profile:profileOf}=useShell();
 const z=useZarn(),{db,me,people,membership,title,online}=z,router=useRouter(),confirm=useConfirm();
 const [tab,setTab]=useState<'about'|'members'|'pins'>('about'),[ids,setIds]=useState<string[]>([]),[pending,setPending]=useState<string[]>([]),[topic,setTopic]=useState(c.topic),[adding,setAdding]=useState(false),[msg,setMsg]=useState(''),[confirmDel,setConfirmDel]=useState(false),[deleting,setDeleting]=useState(false);
 useEffect(()=>{
  void db.from('zarn_channel_members').select('user_id').eq('channel_id',c.id).then(({data}:{data:{user_id:string}[]|null})=>setIds((data??[]).map(r=>r.user_id)));
  // People who were invited to a private channel but haven't accepted yet.
  if(c.kind==='private')void zarnApi<{pending:string[]}>('/api/zarn',{action:'invite_list',id:c.id}).then(r=>setPending(r.pending)).catch(()=>{});
 },[db,c.id,c.kind,adding]);
 const mine=membership[c.id];
 const saveTopic=async()=>{try{await zarnApi('/api/zarn',{action:'topic',id:c.id,topic});setMsg('Topic updated.');await z.reload();}catch(e){setMsg(e instanceof Error?e.message:'Could not save.');}};
 const staff=me.staffRole==='super_admin'||me.staffRole==='admin';
 const canDelete=(c.kind==='public'||c.kind==='private')&&(staff||(c.created_by===me.user_id&&!c.is_default&&!c.crm_feed));
 const remove=async()=>{setDeleting(true);try{await zarnApi('/api/zarn',{action:'channel_delete',id:c.id});await z.reload();router.push('/zarn');}catch(e){setMsg(e instanceof Error?e.message:'Could not delete the channel.');setConfirmDel(false);}finally{setDeleting(false);}};
 const leave=async()=>{await db.from('zarn_channel_members').delete().eq('channel_id',c.id).eq('user_id',me.user_id);await z.reload();router.push('/zarn');};
 return <div className="zn-modal-scrim" onClick={onClose}><div className="zn-modal zn-modal-lg" role="dialog" aria-label="Channel details" onClick={e=>e.stopPropagation()}>
  <div className="zn-modal-head"><h2>{c.kind==='dm'?title(c):`#${c.name}`}</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
  <div className="zn-tabs">{(c.kind==='dm'?['members','pins']:['about','members','pins']).map(t=><button key={t} type="button" className={tab===t||(c.kind==='dm'&&tab==='about'&&t==='members')?'is-on':''} onClick={()=>setTab(t as typeof tab)}>{t==='about'?'About':t==='members'?`Members ${ids.length}`:`Pinned ${pinned.length}`}</button>)}</div>
  {tab==='about'&&c.kind!=='dm'?<div className="zn-modal-body">
   <label className="zn-label">Topic<textarea className="zn-input" rows={2} maxLength={250} value={topic} disabled={!mine} onChange={e=>setTopic(e.target.value)}/></label>
   {mine&&topic!==c.topic&&<button type="button" className="zn-btn is-primary" onClick={()=>void saveTopic()}>Save topic</button>}
   {msg&&<p className="zn-note">{msg}</p>}
   <p className="zn-note">{c.kind==='private'?'Private: only members can see this channel.':'Public: anyone on ZARN can find and join it.'}{c.crm_feed&&' CRM updates post here automatically.'}</p>
   {mine&&<div className="zn-row"><button type="button" className="zn-btn" onClick={async()=>{await db.from('zarn_channel_members').update({muted:!mine.muted}).eq('channel_id',c.id).eq('user_id',me.user_id);await z.reload();}}>{mine.muted?<><Bell size={14}/>Unmute</>:<><BellOff size={14}/>Mute</>}</button>
    {!c.is_default&&<button type="button" className="zn-btn is-danger" onClick={()=>void leave()}>Leave channel</button>}</div>}
   {canDelete&&(confirmDel
    ?<div className="zn-note"><p>Delete #{c.name} and every message in it? This can’t be undone.</p><div className="zn-row"><button type="button" className="zn-btn" disabled={deleting} onClick={()=>setConfirmDel(false)}>Cancel</button><button type="button" className="zn-btn is-danger" disabled={deleting} onClick={()=>void remove()}>{deleting?'Deleting…':'Yes, delete channel'}</button></div></div>
    :<div className="zn-row"><button type="button" className="zn-btn is-danger" onClick={()=>setConfirmDel(true)}><Trash2 size={14}/>Delete channel</button></div>)}
  </div>
  :tab==='pins'?<div className="zn-modal-body">{pinned.length?pinned.map(m=><button key={m.id} type="button" className="zn-pin-row" onClick={()=>onJump(m.id)}><b>{people[m.user_id??'']?.display_name??'CRM'}</b><span>{renderBody(m.body.slice(0,240),people,me.user_id)}</span></button>):<p className="zn-note">Nothing pinned yet. Hover a message and click the pin.</p>}</div>
  :<div className="zn-modal-body">
   {mine&&c.kind!=='dm'&&<button type="button" className="zn-btn" onClick={()=>setAdding(true)}><UserPlus size={14}/>Add people</button>}
   <ul className="zn-list">{ids.map(u=>people[u]).filter(Boolean).map(p=><li key={p!.user_id}><div className="zn-person is-click" role="button" tabIndex={0} onClick={()=>{onClose();profileOf(p!.user_id);}}><Avatar m={p} size={32} online={online.has(p!.user_id)}/><span><b>{p!.display_name}{p!.user_id===me.user_id&&' (you)'}</b><small>{p!.title||p!.email}</small></span>{c.kind==='private'&&(staff||c.created_by===me.user_id)&&p!.user_id!==me.user_id&&p!.user_id!==c.created_by&&<button type="button" className="zn-remove" onClick={async e=>{e.stopPropagation();if(!await confirm({title:`Remove ${p!.display_name}?`,message:'They will lose access to this channel. You can invite them again later.',confirm:'Remove',danger:true}))return;try{await zarnApi('/api/zarn',{action:'channel_remove',id:c.id,user_id:p!.user_id});setIds(x=>x.filter(y=>y!==p!.user_id));}catch(err){setMsg(err instanceof Error?err.message:'Could not remove them.');}}}>Remove</button>}</div></li>)}</ul>
  {pending.length>0&&<div className="zn-pending"><p className="zn-section-label">Invited · {pending.length}</p><ul className="zn-list">{pending.map(u=>people[u]).filter(Boolean).map(p=><li key={p!.user_id}><div className="zn-person"><Avatar m={p} size={32}/><span><b>{p!.display_name}</b><small>Waiting to accept the invitation</small></span>{mine&&<button type="button" className="zn-remove" onClick={async()=>{await zarnApi('/api/zarn',{action:'invite_cancel',id:c.id,user_id:p!.user_id});setPending(x=>x.filter(y=>y!==p!.user_id));}}>Cancel</button>}</div></li>)}</ul></div>}
  </div>}
  {adding&&<PeoplePicker title="Add people" exclude={[...ids,...pending]} confirm="Add" onClose={()=>setAdding(false)} onPick={async sel=>{await zarnApi('/api/zarn',{action:'channel_add',id:c.id,members:sel});setAdding(false);}}/>}
 </div></div>;
}

// WhatsApp-style "last seen today at 15:10" / "last seen yesterday" / "last seen 3 Oct".
function lastSeen(at?:string|null){
 if(!at)return 'offline';
 const d=new Date(at),t=new Date(),y=new Date();y.setDate(t.getDate()-1);
 const time=d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
 if(d.toDateString()===t.toDateString())return `last seen today at ${time}`;
 if(d.toDateString()===y.toDateString())return `last seen yesterday at ${time}`;
 return `last seen ${d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`;
}
