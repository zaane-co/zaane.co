'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {Check,Link2,Maximize2,Mic,MicOff,Minimize2,MonitorOff,MonitorUp,Phone,Search,Shrink,UserPlus,Users,Video,VideoOff,Volume2,X} from 'lucide-react';
import {createPortal} from 'react-dom';
import type {RealtimeChannel} from '@supabase/supabase-js';
import {useZarn} from './ZarnProvider';
import {Avatar} from './format';
import {startRing} from '@/lib/zarn-sound';
import CallLobby,{type LobbyResult} from './CallLobby';

// Voice and video calls for any number of people. The server only records who is in a call (zarn_calls, zarn_call_people);
// people find each other through a Supabase realtime channel named after the call, and media goes straight between each pair.
// In each pair the side with the smaller session id makes the offer, so two people never offer at once.
type Phase='idle'|'incoming'|'room';
type Room={id:string;channel:string;video:boolean;kind:string;caller:string};
type Pres={user:string;video:boolean;screen:boolean;muted:boolean};
type Peer={pc:RTCPeerConnection;user:string;offerer:boolean;pending:RTCIceCandidateInit[];vSender:RTCRtpSender|null};
type Sig={from:string;to:string;user:string;desc?:RTCSessionDescriptionInit;cand?:RTCIceCandidateInit};
type Ringee={user_id:string;status:string};
type Lobby={mode:'start';channelId:string;video:boolean;userIds?:string[]}|{mode:'join';callId:string};
const RING_TIMEOUT=45_000,BEAT_MS=25_000;
const Ctx=createContext<{start:(channelId:string,opts?:{video?:boolean;userIds?:string[]})=>Promise<void>;join:(callId:string)=>void;busy:boolean;roomId:string|null}>({start:async()=>{},join:()=>{},busy:false,roomId:null});
export const useCall=()=>useContext(Ctx);
const fmt=(s:number)=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
async function api(body:object){
 const r=await fetch('/api/zarn/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;
}
const audioOpts={echoCancellation:true,noiseSuppression:true,autoGainControl:true};
const camOpts={facingMode:'user',width:{ideal:1280},height:{ideal:720}};
const newSession=()=>crypto.randomUUID().replace(/-/g,'').slice(0,16);
const nowMs=()=>Date.now();
// The theme colours are defined on the .zarn root, so the call UI renders inside it (light and dark both work).
const portal=(node:React.ReactNode)=>createPortal(node,document.querySelector('.zarn')??document.body);

function Vid({stream,className}:{stream:MediaStream|null;className?:string}){
 const ref=useRef<HTMLVideoElement>(null);
 useEffect(()=>{const el=ref.current;if(el&&el.srcObject!==stream){el.srcObject=stream;void el.play().catch(()=>{});}},[stream]);
 return <video ref={ref} className={className} autoPlay playsInline muted/>;
}
// Each person's sound plays from its own element, kept mounted while the call is minimised.
function PeerAudio({stream,sink}:{stream:MediaStream|null;sink:string}){
 const ref=useRef<HTMLAudioElement>(null);
 useEffect(()=>{const el=ref.current;if(el&&el.srcObject!==stream){el.srcObject=stream;void el.play().catch(()=>{});}},[stream]);
 useEffect(()=>{const el=ref.current as (HTMLAudioElement&{setSinkId?:(id:string)=>Promise<void>})|null;if(el?.setSinkId&&sink)void el.setSinkId(sink).catch(()=>{});},[sink]);
 return <audio ref={ref} autoPlay playsInline/>;
}

export default function CallProvider({children}:{children:React.ReactNode}){
 const {db,me,people,members,channels,title:chTitle}=useZarn();
 const [phase,setPhase]=useState<Phase>('idle'),[room,setRoom]=useState<Room|null>(null),[incoming,setIncoming]=useState<Room|null>(null),[lobby,setLobby]=useState<Lobby|null>(null);
 const [pres,setPres]=useState<Record<string,Pres>>({}),[streams,setStreams]=useState<Record<string,MediaStream>>({}),[ringees,setRingees]=useState<Ringee[]>([]);
 const [muted,setMuted]=useState(false),[camOn,setCamOn]=useState(false),[sharing,setSharing]=useState(false),[local,setLocal]=useState<MediaStream|null>(null);
 const [secs,setSecs]=useState(0),[notice,setNotice]=useState(''),[mini,setMini]=useState(false),[fs,setFs]=useState(false),[adding,setAdding]=useState(false);
 const [outs,setOuts]=useState<MediaDeviceInfo[]|null>(null),[outId,setOutId]=useState('');
 const phaseRef=useRef<Phase>('idle'),roomRef=useRef<Room|null>(null),incomingRef=useRef<Room|null>(null),session=useRef('');
 const sig=useRef<RealtimeChannel|null>(null),watch=useRef<RealtimeChannel|null>(null),peers=useRef(new Map<string,Peer>()),ice=useRef<RTCIceServer[]>([]);
 const stream=useRef<MediaStream|null>(null),camTrack=useRef<MediaStreamTrack|null>(null),screenTrack=useRef<MediaStreamTrack|null>(null),mutedRef=useRef(false);
 const stopRing=useRef<(()=>void)|null>(null),timers=useRef<ReturnType<typeof setTimeout>[]>([]),beat=useRef<ReturnType<typeof setInterval>|null>(null),tick=useRef<ReturnType<typeof setInterval>|null>(null);
 const callEl=useRef<HTMLDivElement>(null),startedAt=useRef(0);
 const go=(p:Phase)=>{phaseRef.current=p;setPhase(p);};
 const say=useCallback((m:string,ms=4000)=>{setNotice(m);timers.current.push(setTimeout(()=>setNotice(''),ms));},[]);
 const hush=()=>{stopRing.current?.();stopRing.current=null;};

 const cleanup=useCallback((msg='')=>{
  stopRing.current?.();stopRing.current=null;timers.current.forEach(clearTimeout);timers.current=[];
  if(beat.current)clearInterval(beat.current);beat.current=null;if(tick.current)clearInterval(tick.current);tick.current=null;
  peers.current.forEach(p=>p.pc.close());peers.current.clear();
  stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;camTrack.current?.stop();camTrack.current=null;screenTrack.current?.stop();screenTrack.current=null;
  if(sig.current){void db.removeChannel(sig.current);sig.current=null;}
  if(watch.current){void db.removeChannel(watch.current);watch.current=null;}
  if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});
  roomRef.current=null;incomingRef.current=null;startedAt.current=0;mutedRef.current=false;
  setRoom(null);setIncoming(null);setPres({});setStreams({});setRingees([]);setMuted(false);setCamOn(false);setSharing(false);setLocal(null);setSecs(0);setMini(false);setOuts(null);setAdding(false);go('idle');
  if(msg){setNotice(msg);timers.current.push(setTimeout(()=>setNotice(''),4000));}
 },[db]);

 // What I'm sending as video: the screen while sharing, else the camera, else nothing.
 const videoTrack=()=>screenTrack.current??camTrack.current??null;
 const showLocal=()=>{const t=videoTrack();setLocal(t?new MediaStream([t]):null);setCamOn(!!camTrack.current);setSharing(!!screenTrack.current);};
 const announce=()=>{void sig.current?.track({user:me.user_id,video:!!videoTrack(),screen:!!screenTrack.current,muted:mutedRef.current} satisfies Pres);};
 const send=(to:string,m:Omit<Sig,'from'|'to'|'user'>)=>{void sig.current?.send({type:'broadcast',event:'sig',payload:{...m,from:session.current,to,user:me.user_id}});};

 function dropPeer(key:string){const p=peers.current.get(key);if(!p)return;p.pc.close();peers.current.delete(key);setStreams(s=>{const n={...s};delete n[key];return n;});}
 function makePeer(key:string,user:string,offerer:boolean){
  const pc=new RTCPeerConnection({iceServers:ice.current});
  const p:Peer={pc,user,offerer,pending:[],vSender:null};peers.current.set(key,p);
  if(offerer){
   // Audio plus a video slot that is always there, so cameras and screens switch without a new offer.
   const a=stream.current?.getAudioTracks()[0];if(a)pc.addTrack(a,stream.current!);else pc.addTransceiver('audio',{direction:'sendrecv'});
   p.vSender=pc.addTransceiver('video',{direction:'sendrecv'}).sender;void p.vSender.replaceTrack(videoTrack());
   pc.onnegotiationneeded=async()=>{try{await pc.setLocalDescription();send(key,{desc:pc.localDescription!.toJSON()});}catch{/* retried on the next change */}};
  }
  pc.onicecandidate=e=>{if(e.candidate)send(key,{cand:e.candidate.toJSON()});};
  pc.ontrack=e=>{setStreams(s=>{const old=s[key]?.getTracks().filter(t=>t.kind!==e.track.kind)??[];return {...s,[key]:new MediaStream([...old,e.track])};});};
  pc.onconnectionstatechange=()=>{
   if(pc.connectionState==='connected'){hush();if(!startedAt.current){startedAt.current=nowMs();tick.current=setInterval(()=>setSecs(Math.floor((nowMs()-startedAt.current)/1000)),1000);}}
   if(pc.connectionState==='failed'&&offerer)pc.restartIce();
  };
  return p;
 }
 async function onSig(m:Sig){
  if(m.to!==session.current)return;
  let p=peers.current.get(m.from);
  if(m.desc){
   if(m.desc.type==='offer'){
    if(!p)p=makePeer(m.from,m.user,false);
    const pc=p.pc;
    await pc.setRemoteDescription(m.desc);
    // Answer with my microphone and the video slot the offer made.
    for(const t of pc.getTransceivers()){
     if(t.receiver.track.kind==='audio'&&!t.sender.track){const a=stream.current?.getAudioTracks()[0];if(a)await t.sender.replaceTrack(a);t.direction='sendrecv';}
     if(t.receiver.track.kind==='video'){p.vSender=t.sender;await t.sender.replaceTrack(videoTrack());t.direction='sendrecv';}
    }
    await pc.setLocalDescription();send(m.from,{desc:pc.localDescription!.toJSON()});
   }else if(p&&m.desc.type==='answer'&&p.pc.signalingState==='have-local-offer')await p.pc.setRemoteDescription(m.desc);
   if(p)for(const c of p.pending.splice(0))await p.pc.addIceCandidate(c).catch(()=>{});
  }else if(m.cand){
   if(p?.pc.remoteDescription)await p.pc.addIceCandidate(m.cand).catch(()=>{});
   else if(p)p.pending.push(m.cand);
   else{p=makePeer(m.from,m.user,false);p.pending.push(m.cand);}
  }
 }
 // Who is here: connect to newcomers (the smaller session id offers), drop people who left.
 function onSync(){
  const st=(sig.current?.presenceState()??{}) as Record<string,Pres[]>;
  const next:Record<string,Pres>={};
  for(const [k,v] of Object.entries(st)){if(k===session.current||!v[0])continue;next[k]=v[0];if(!peers.current.has(k)&&session.current<k)makePeer(k,v[0].user,true);}
  for(const k of [...peers.current.keys()])if(!next[k])dropPeer(k);
  setPres(next);
  if(Object.keys(next).length)hush();
 }
 const loadRingees=useCallback(async(id:string)=>{const {data}=await db.from('zarn_call_people').select('user_id,status').eq('call_id',id);if(roomRef.current?.id===id)setRingees((data??[]) as Ringee[]);},[db]);

 // In the call: open the meeting channel, keep my place with a heartbeat, ring out while I'm alone.
 function enter(d:{call_id:string;channel_id:string;video:boolean;kind:string;caller_id:string;ice:RTCIceServer[]}){
  const r:Room={id:d.call_id,channel:d.channel_id,video:d.video,kind:d.kind,caller:d.caller_id};
  roomRef.current=r;setRoom(r);ice.current=d.ice;session.current=newSession();go('room');showLocal();
  const ch=db.channel(`zarn-call-${r.id}`,{config:{broadcast:{self:false},presence:{key:session.current}}});sig.current=ch;
  ch.on('broadcast',{event:'sig'},({payload}:{payload:Sig})=>{void onSig(payload);})
   .on('presence',{event:'sync'},onSync)
   .subscribe((s:string)=>{if(s==='SUBSCRIBED')announce();});
  watch.current=db.channel(`zarn-call-state-${r.id}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'zarn_call_people',filter:`call_id=eq.${r.id}`},()=>void loadRingees(r.id))
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'zarn_calls',filter:`id=eq.${r.id}`},(p:{new:Record<string,unknown>})=>{
    const s=String(p.new.status);setRoom(x=>x?{...x,kind:String(p.new.kind??x.kind)}:x);
    if(roomRef.current?.id===r.id&&['ended','missed','declined'].includes(s))cleanup(s==='declined'?'Call declined.':'Call ended.');
   }).subscribe();
  void loadRingees(r.id);
  beat.current=setInterval(()=>{void api({action:'beat',call_id:r.id}).then(x=>{if(x?.ended&&roomRef.current?.id===r.id)cleanup('Call ended.');}).catch(()=>{});},BEAT_MS);
  if(r.caller===me.user_id){
   stopRing.current=startRing('out');
   timers.current.push(setTimeout(hush,RING_TIMEOUT));
   // A one-to-one call nobody picks up ends on its own.
   if(r.kind==='direct')timers.current.push(setTimeout(()=>{if(roomRef.current?.id===r.id&&!peers.current.size)void leave('No answer.');},RING_TIMEOUT));
  }
 }
 async function media(video:boolean,pre?:LobbyResult){
  if(pre){stream.current=pre.stream;const v=pre.stream.getVideoTracks()[0];if(v){pre.stream.removeTrack(v);camTrack.current=v;}mutedRef.current=pre.muted;setMuted(pre.muted);pre.stream.getAudioTracks().forEach(t=>{t.enabled=!pre.muted;});if(pre.outId)setOutId(pre.outId);return true;}
  try{
   stream.current=await navigator.mediaDevices.getUserMedia({audio:audioOpts});
   if(video){try{camTrack.current=(await navigator.mediaDevices.getUserMedia({video:camOpts})).getVideoTracks()[0]??null;}catch{say('Camera unavailable, so you joined with voice only.');}}
   return true;
  }catch{say('Allow microphone access to join calls.',5000);return false;}
 }
 const supported=()=>{if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==='undefined'){say('Calls aren’t supported on this browser.');return false;}return true;};
 const start=useCallback(async(channelId:string,opts?:{video?:boolean;userIds?:string[]})=>{
  if(phaseRef.current!=='idle'||!supported())return;
  setLobby({mode:'start',channelId,video:!!opts?.video,userIds:opts?.userIds});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const join=useCallback((callId:string)=>{
  if(roomRef.current?.id===callId){setMini(false);return;}
  if(phaseRef.current==='room'){say('Leave your current call first.');return;}
  if(!supported())return;
  setLobby({mode:'join',callId});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 async function fromLobby(l:Lobby,pre:LobbyResult){
  setLobby(null);
  if(!await media(pre.video,pre))return;
  try{
   let d=l.mode==='start'?await api({action:'start',channel_id:l.channelId,video:pre.video,user_ids:l.userIds}):await api({action:'join',call_id:l.callId});
   if(d.existing)d=await api({action:'join',call_id:d.call_id});
   enter(d);
  }catch(e){cleanup(e instanceof Error?e.message:'Could not join the call.');}
 }
 async function leave(msg=''){const r=roomRef.current;if(r)void api({action:'leave',call_id:r.id}).catch(()=>{});cleanup(msg);}

 // Ringing: someone added me to a call.
 const showIncoming=useCallback(async(callId:string)=>{
  if(phaseRef.current!=='idle'||incomingRef.current)return;
  const {data:c}=await db.from('zarn_calls').select('id,channel_id,video,kind,caller_id,status').eq('id',callId).maybeSingle();
  if(!c||!['ringing','active'].includes(c.status)||phaseRef.current!=='idle')return;
  const r:Room={id:c.id,channel:c.channel_id,video:!!c.video,kind:c.kind,caller:c.caller_id};
  incomingRef.current=r;setIncoming(r);go('incoming');stopRing.current=startRing('in');
  timers.current.push(setTimeout(()=>{if(incomingRef.current?.id===r.id)cleanup();},RING_TIMEOUT));
 },[db,cleanup]);
 async function accept(){
  const r=incomingRef.current;if(!r)return;hush();incomingRef.current=null;setIncoming(null);go('idle');
  if(!supported()||!await media(r.video)){void api({action:'decline',call_id:r.id}).catch(()=>{});return;}
  try{enter(await api({action:'join',call_id:r.id}));}catch(e){cleanup(e instanceof Error?e.message:'This call has ended.');}
 }
 async function decline(text?:string){
  const r=incomingRef.current;if(!r)return;void api({action:'decline',call_id:r.id}).catch(()=>{});cleanup();
  if(text)await db.from('zarn_messages').insert({channel_id:r.channel,user_id:me.user_id,body:text});
 }
 useEffect(()=>{
  const check=()=>{
   if(document.visibilityState!=='visible'||phaseRef.current!=='idle')return;
   void db.from('zarn_call_people').select('call_id').eq('user_id',me.user_id).eq('status','ringing').gt('created_at',new Date(nowMs()-RING_TIMEOUT).toISOString()).order('created_at',{ascending:false}).limit(1)
    .then(({data}:{data:{call_id:string}[]|null})=>{if(data?.[0])void showIncoming(data[0].call_id);});
  };
  check();document.addEventListener('visibilitychange',check);window.addEventListener('focus',check);window.addEventListener('pageshow',check);
  const ch=db.channel(`zarn-ring-${me.user_id}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'zarn_call_people',filter:`user_id=eq.${me.user_id}`},(p:{new:Record<string,unknown>})=>{
    const r=p.new;if(!r?.call_id)return;
    if(r.status==='ringing'&&nowMs()-new Date(String(r.created_at)).getTime()<RING_TIMEOUT)void showIncoming(String(r.call_id));
    else if(incomingRef.current?.id===r.call_id&&r.status!=='ringing')cleanup(); // answered or declined on another device
   })
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'zarn_calls'},(p:{new:Record<string,unknown>})=>{
    if(incomingRef.current?.id===p.new.id&&!['ringing','active'].includes(String(p.new.status)))cleanup();
   }).subscribe();
  return()=>{document.removeEventListener('visibilitychange',check);window.removeEventListener('focus',check);window.removeEventListener('pageshow',check);void db.removeChannel(ch);};
 },[db,me.user_id,showIncoming,cleanup]);
 useEffect(()=>()=>cleanup(),[cleanup]);

 // Controls.
 function toggleMute(){const m=!mutedRef.current;mutedRef.current=m;setMuted(m);stream.current?.getAudioTracks().forEach(t=>{t.enabled=!m;});announce();}
 const pushVideo=()=>{const t=videoTrack();peers.current.forEach(p=>{void p.vSender?.replaceTrack(t);});showLocal();announce();};
 async function toggleCamera(){
  if(camTrack.current){camTrack.current.stop();camTrack.current=null;pushVideo();return;}
  try{camTrack.current=(await navigator.mediaDevices.getUserMedia({video:camOpts})).getVideoTracks()[0]??null;pushVideo();}catch{say('Allow camera access to turn on video.');}
 }
 async function toggleShare(){
  if(screenTrack.current){screenTrack.current.stop();screenTrack.current=null;pushVideo();return;}
  try{const t=(await navigator.mediaDevices.getDisplayMedia({video:true})).getVideoTracks()[0];if(!t)return;screenTrack.current=t;t.onended=()=>{if(screenTrack.current===t){screenTrack.current=null;pushVideo();}};pushVideo();}catch{/* cancelled in the picker */}
 }
 const canShare=typeof navigator!=='undefined'&&!!navigator.mediaDevices&&'getDisplayMedia' in navigator.mediaDevices;
 const canSink=typeof HTMLMediaElement!=='undefined'&&'setSinkId' in HTMLMediaElement.prototype;
 async function toggleOutputs(){if(outs){setOuts(null);return;}try{setOuts((await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audiooutput'));}catch{setOuts([]);}}
 useEffect(()=>{const h=()=>setFs(!!document.fullscreenElement);document.addEventListener('fullscreenchange',h);return()=>document.removeEventListener('fullscreenchange',h);},[]);
 function toggleFullscreen(){if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});else void callEl.current?.requestFullscreen?.().catch(()=>say('Full screen isn’t available here.'));}
 async function copyLink(){const r=roomRef.current;if(!r)return;const url=`${window.location.origin}/zarn/call/${r.id}`;try{await navigator.clipboard.writeText(url);say('Link copied. Anyone on the team can join with it.');}catch{say(url,8000);}}
 async function invite(ids:string[]){const r=roomRef.current;if(!r||!ids.length)return;setAdding(false);try{await api({action:'invite',call_id:r.id,user_ids:ids});say(ids.length===1?`Ringing ${people[ids[0]!]?.display_name??'them'}…`:`Ringing ${ids.length} people…`);}catch(e){say(e instanceof Error?e.message:'Could not add them.');}}

 const value=useMemo(()=>({start,join,busy:phase!=='idle',roomId:room?.id??null}),[start,join,phase,room]);
 const chOf=(id:string)=>channels.find(c=>c.id===id);
 const label=(r:Room)=>{const ch=chOf(r.channel);if(r.kind==='direct'){const other=r.caller===me.user_id?ringees.find(x=>x.user_id!==me.user_id)?.user_id:r.caller;return people[other??'']?.display_name??(ch?chTitle(ch):'Call');}return ch?(ch.kind==='dm'?chTitle(ch):`#${chTitle(ch)}`):'Team call';};
 const keys=Object.keys(pres),n=keys.length+1;
 const cols=n<=1?1:n<=4?2:n<=9?3:4;
 const waiting=ringees.filter(r=>r.status==='ringing'&&r.user_id!==me.user_id&&!keys.some(k=>pres[k]?.user===r.user_id));
 const inCall=new Set([me.user_id,...keys.map(k=>pres[k]!.user)]);
 const lobbyLabel=(l:Lobby)=>{if(l.mode==='join')return <>: <b>join the call</b></>;const ch=chOf(l.channelId);if(!ch)return undefined;const others=ch.kind==='dm'?(ch.dm_key??'').split(',').filter(u=>u&&u!==me.user_id):[];return others.length===1?undefined:<>in <b>{ch.kind==='dm'?chTitle(ch):`#${chTitle(ch)}`}</b></>;};
 const lobbyPeer=(l:Lobby)=>{if(l.mode!=='start')return undefined;const ch=chOf(l.channelId);const others=ch?.kind==='dm'?(ch.dm_key??'').split(',').filter(u=>u&&u!==me.user_id):[];return others.length===1?people[others[0]!]:undefined;};

 return <Ctx.Provider value={value}>{children}
  {lobby&&phase==='idle'&&portal(<CallLobby peer={lobbyPeer(lobby)} label={lobbyLabel(lobby)} action={lobby.mode==='join'?'Join call':'Start call'} me={people[me.user_id]??me} video={lobby.mode==='start'?lobby.video:false} onCancel={()=>setLobby(null)} onStart={r=>void fromLobby(lobby,r)}/>)}
  {keys.map(k=><PeerAudio key={k} stream={streams[k]??null} sink={outId}/>)}
  {(notice||phase!=='idle')&&portal(<>
  {notice&&<div className="zn-call-toast" role="status">{notice}</div>}
  {phase==='room'&&room&&mini&&<div className="zn-call-mini" role="status">
   <button type="button" className="zn-call-mini-stage" aria-label="Expand call" onClick={()=>setMini(false)}>
    <span className="zn-call-mini-faces">{[...inCall].slice(0,3).map(u=><Avatar key={u} m={people[u]} size={28}/>)}</span>
    <span className="zn-call-mini-label"><b>{label(room)}</b><small>{keys.length?`${n} in call · ${fmt(secs)}`:'Waiting for others…'}</small></span>
   </button>
   <div className="zn-call-mini-bar">
    <button type="button" className={muted?'is-on':''} aria-label={muted?'Unmute':'Mute'} aria-pressed={muted} onClick={toggleMute}>{muted?<MicOff size={16}/>:<Mic size={16}/>}</button>
    <button type="button" className={camOn?'':'is-on'} aria-label={camOn?'Turn camera off':'Turn camera on'} onClick={()=>void toggleCamera()}>{camOn?<Video size={16}/>:<VideoOff size={16}/>}</button>
    <button type="button" aria-label="Expand call" onClick={()=>setMini(false)}><Maximize2 size={16}/></button>
    <button type="button" className="is-decline" aria-label="Leave call" onClick={()=>void leave()}><Phone size={16} className="zn-hangup"/></button>
   </div>
  </div>}
  {phase==='room'&&room&&!mini&&<div ref={callEl} className="zn-room" role="dialog" aria-label="Call">
   <header className="zn-room-head">
    <span className="zn-room-title">{room.kind==='direct'?(room.video?<Video size={15}/>:<Phone size={15}/>):<Users size={15}/>}<b>{label(room)}</b></span>
    <span className={`zn-room-status${keys.length?' is-live':''}`}>{keys.length?<><i/>{fmt(secs)} · {n} in call</>:<>Waiting for others <i className="zn-dots"><b/><b/><b/></i></>}</span>
    <span className="zn-room-tools">
     <button type="button" aria-label="Add people" data-tip="Add people" onClick={()=>setAdding(true)}><UserPlus size={16}/></button>
     <button type="button" aria-label="Copy call link" data-tip="Copy link" onClick={()=>void copyLink()}><Link2 size={16}/></button>
     <button type="button" aria-label={fs?'Exit full screen':'Full screen'} data-tip={fs?'Exit full screen':'Full screen'} onClick={toggleFullscreen}>{fs?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button>
     <button type="button" aria-label="Minimize call" data-tip="Minimize" onClick={()=>setMini(true)}><Shrink size={16}/></button></span>
   </header>
   <div className="zn-room-stage is-grid" style={{'--cols':cols} as React.CSSProperties} data-n={n}>
    <div className="zn-tile is-me">{local?<Vid stream={local} className={sharing?'':'is-mirror'}/>:<Avatar m={people[me.user_id]??me} size={n>4?72:112}/>}
     <span className="zn-tile-name">{muted&&<MicOff size={12}/>}You{sharing?' (sharing)':''}</span></div>
    {keys.map(k=>{const p=pres[k]!,m=people[p.user],s=streams[k]??null,v=p.video&&!!s?.getVideoTracks().length;
     return <div key={k} className={`zn-tile is-peer${p.screen?' is-screen':''}`}>{v?<Vid stream={s}/>:<Avatar m={m} size={n>4?72:112}/>}
      <span className="zn-tile-name">{p.muted&&<MicOff size={12}/>}{m?.display_name??'Someone'}{p.screen?' (sharing)':''}</span></div>;})}
    {!keys.length&&<div className="zn-room-waiting">{waiting.length?<><span className="zn-call-mini-faces">{waiting.slice(0,4).map(r=><Avatar key={r.user_id} m={people[r.user_id]} size={28}/>)}</span><span>Ringing <b>{waiting.length===1?people[waiting[0]!.user_id]?.display_name??'them':`${waiting.length} people`}</b></span></>
     :<><Link2 size={16}/><span>Nobody else is here yet. <button type="button" className="zn-link" onClick={()=>void copyLink()}>Copy the link</button> or <button type="button" className="zn-link" onClick={()=>setAdding(true)}>add people</button>.</span></>}</div>}
   </div>
   {keys.length>0&&waiting.length>0&&<p className="zn-room-ringing">Ringing {waiting.map(r=>people[r.user_id]?.display_name??'someone').join(', ')}</p>}
   <footer className="zn-room-bar">
    <div className="zn-room-ctl">
     <button type="button" className={muted?'is-off':''} aria-label={muted?'Unmute':'Mute'} aria-pressed={muted} data-tip={muted?'Unmute':'Mute'} onClick={toggleMute}>{muted?<MicOff size={19}/>:<Mic size={19}/>}</button>
     <button type="button" className={camOn?'':'is-off'} aria-label={camOn?'Turn camera off':'Turn camera on'} aria-pressed={camOn} data-tip={camOn?'Camera off':'Camera on'} onClick={()=>void toggleCamera()}>{camOn?<Video size={19}/>:<VideoOff size={19}/>}</button>
     {canShare&&<button type="button" className={sharing?'is-on':''} aria-label={sharing?'Stop sharing':'Share screen'} aria-pressed={sharing} data-tip={sharing?'Stop sharing':'Share screen'} onClick={()=>void toggleShare()}>{sharing?<MonitorOff size={19}/>:<MonitorUp size={19}/>}</button>}
     {canSink&&<button type="button" aria-label="Choose speaker" aria-expanded={!!outs} data-tip="Speaker" onClick={()=>void toggleOutputs()}><Volume2 size={19}/></button>}
     <button type="button" aria-label="Add people" data-tip="Add people" onClick={()=>setAdding(true)}><UserPlus size={19}/></button>
    </div>
    <button type="button" className="zn-room-leave" onClick={()=>void leave()}><Phone size={16} className="zn-hangup"/>Leave</button>
    {outs&&<ul className="zn-call-outs zn-room-outs" aria-label="Speakers">{outs.length?outs.map(d=><li key={d.deviceId}><button type="button" onClick={()=>{setOutId(d.deviceId);setOuts(null);}}>{(outId||'default')===d.deviceId?<Check size={14}/>:<i/>}<span>{d.label||'Speaker'}</span></button></li>):<li className="is-empty">No other speakers found.</li>}</ul>}
   </footer>
   {adding&&<AddPeople members={members.filter(m=>m.user_id!==me.user_id&&!m.deactivated_at&&m.joined_at&&m.account_type==='member')} inCall={inCall} ringing={new Set(waiting.map(r=>r.user_id))} onClose={()=>setAdding(false)} onAdd={ids=>void invite(ids)}/>}
  </div>}
  {phase==='incoming'&&incoming&&<div className="zn-call-scrim"><div className="zn-call" role="dialog" aria-modal="true" aria-label="Incoming call">
   <div className="zn-call-bg" aria-hidden style={people[incoming.caller]?.avatar_url?{backgroundImage:`url(${people[incoming.caller]!.avatar_url})`}:undefined}/>
   <span className="zn-call-kind">{incoming.video?<Video size={13}/>:<Phone size={13}/>}{incoming.kind==='direct'?(incoming.video?'Incoming video call':'Incoming voice call'):'Group call'}</span>
   <div className="zn-call-avatar is-ringing"><Avatar m={people[incoming.caller]} size={120}/></div>
   <div className="zn-call-info"><b>{people[incoming.caller]?.display_name??'Someone'}</b>{incoming.kind!=='direct'&&<em>is calling {label(incoming)}</em>}<small>Ringing <i className="zn-dots"><b/><b/><b/></i></small></div>
   {incoming.kind==='direct'&&<div className="zn-call-replies">{['Can’t talk now, I’ll call you back.','In a meeting. Text me?','On my way, 5 minutes.'].map(t=><button key={t} type="button" onClick={()=>void decline(t)}>{t}</button>)}</div>}
   <div className="zn-call-actions">
    <button type="button" className="is-decline" aria-label="Decline" onClick={()=>void decline()}><Phone size={22} className="zn-hangup"/><span>Decline</span></button>
    <button type="button" className="is-accept" aria-label={incoming.kind==='direct'?'Accept':'Join'} onClick={()=>void accept()}>{incoming.video?<Video size={22}/>:<Phone size={22}/>}<span>{incoming.kind==='direct'?'Accept':'Join'}</span></button>
   </div>
  </div></div>}
  </>)}
 </Ctx.Provider>;
}

// Ring more people into the call.
function AddPeople({members,inCall,ringing,onClose,onAdd}:{members:import('@/lib/zarn').ZMember[];inCall:Set<string>;ringing:Set<string>;onClose:()=>void;onAdd:(ids:string[])=>void}){
 const [q,setQ]=useState(''),[pick,setPick]=useState<Set<string>>(new Set());
 const list=members.filter(m=>`${m.display_name} ${m.title} ${m.username??''}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>a.display_name.localeCompare(b.display_name));
 const flip=(id:string)=>setPick(s=>{const n=new Set(s);if(n.has(id))n.delete(id);else n.add(id);return n;});
 return <div className="zn-modal-scrim" onClick={onClose}><div className="zn-modal zn-call-pick" role="dialog" aria-label="Add people to the call" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')onClose();}}>
  <div className="zn-modal-head"><h2>Add people</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
  <label className="zn-call-pick-search"><Search size={15}/><input autoFocus placeholder="Search people" value={q} onChange={e=>setQ(e.target.value)}/></label>
  <ul className="zn-call-pick-list" data-lenis-prevent>{list.map(m=>{const here=inCall.has(m.user_id),rings=ringing.has(m.user_id);
   return <li key={m.user_id}><Avatar m={m} size={34}/><span><b>{m.display_name}</b><small>{here?'In the call':rings?'Ringing…':m.title||'Team member'}</small></span>
    {!here&&<button type="button" className={pick.has(m.user_id)?'is-on':''} aria-pressed={pick.has(m.user_id)} aria-label={`${pick.has(m.user_id)?'Unselect':'Select'} ${m.display_name}`} onClick={()=>flip(m.user_id)}>{pick.has(m.user_id)?<Check size={15}/>:<UserPlus size={15}/>}</button>}</li>;})}
   {!list.length&&<li className="zn-empty-row">Nobody matches.</li>}</ul>
  <div className="zn-call-pick-foot"><button type="button" className="zn-btn is-primary" disabled={!pick.size} onClick={()=>onAdd([...pick])}><Phone size={15}/>{pick.size>1?`Ring ${pick.size} people`:'Ring'}</button></div>
 </div></div>;
}

// Call buttons for a chat header. When a call is already going on in this chat, a Join button takes their place.
export function CallButtons({channelId}:{channelId:string}){
 const {db}=useZarn(),call=useCall();
 const [live,setLive]=useState<{id:string;video:boolean}|null>(null);
 useEffect(()=>{
  let on=true;
  const load=()=>void db.from('zarn_calls').select('id,video,status').eq('channel_id',channelId).in('status',['ringing','active']).order('created_at',{ascending:false}).limit(1)
   .then(({data}:{data:{id:string;video:boolean}[]|null})=>{if(on)setLive(data?.[0]??null);});
  load();
  const ch=db.channel(`zarn-chcall-${channelId}`).on('postgres_changes',{event:'*',schema:'public',table:'zarn_calls',filter:`channel_id=eq.${channelId}`},load).subscribe();
  return()=>{on=false;void db.removeChannel(ch);};
 },[db,channelId,call.busy]);
 if(live&&call.roomId!==live.id)return <button type="button" className="zn-join-call" disabled={call.busy} data-tip={call.busy?'You’re on another call':'A call is going on here'} onClick={()=>call.join(live.id)}>{live.video?<Video size={15}/>:<Phone size={15}/>}<span>Join call</span></button>;
 return <>
  <button type="button" aria-label="Voice call" data-tip={call.busy?'You’re on a call':'Voice call'} disabled={call.busy} onClick={()=>void call.start(channelId)}><Phone size={16}/></button>
  <button type="button" aria-label="Video call" data-tip={call.busy?'You’re on a call':'Video call'} disabled={call.busy} onClick={()=>void call.start(channelId,{video:true})}><Video size={16}/></button>
 </>;
}

// A shared call link: shows the call and a Join button (joining needs a tap so the browser allows the mic and sound).
export function JoinCallPage({id}:{id:string}){
 const {db,people,channels,title:chTitle}=useZarn(),call=useCall();
 const [info,setInfo]=useState<{status:string;video:boolean;caller_id:string;channel_id:string}|null|undefined>(undefined);
 useEffect(()=>{let on=true;void db.from('zarn_calls').select('status,video,caller_id,channel_id').eq('id',id).maybeSingle().then(({data}:{data:{status:string;video:boolean;caller_id:string;channel_id:string}|null})=>{if(on)setInfo(data);});return()=>{on=false;};},[db,id,call.roomId]);
 const ch=info?channels.find(c=>c.id===info.channel_id):undefined,ended=info&&!['ringing','active'].includes(info.status);
 const here=call.roomId===id;
 return <div className="zn-page"><div className="zn-joincall">
  <span className="zn-joincall-ico">{info?.video?<Video size={26}/>:<Phone size={26}/>}</span>
  <h1>{here?'You’re in this call':ended?'This call has ended':'Join the call'}</h1>
  <p>{info?<>{people[info.caller_id]?.display_name??'A teammate'} started this call{ch?<> in <b>{ch.kind==='dm'?chTitle(ch):`#${chTitle(ch)}`}</b></>:''}.</>:info===null?'Anyone on the team with this link can join.':'Loading…'}</p>
  {!ended&&!here&&<button type="button" className="zn-btn is-primary" disabled={call.busy} onClick={()=>call.join(id)}><Phone size={15}/>{call.busy?'You’re on another call':'Join call'}</button>}
 </div></div>;
}
