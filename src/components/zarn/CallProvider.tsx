'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {Check,Maximize2,Mic,MicOff,Minimize2,Phone,PhoneOff,ScreenShare,ScreenShareOff,Video,VideoOff,Volume2} from 'lucide-react';
import {createPortal} from 'react-dom';
import type {RealtimeChannel} from '@supabase/supabase-js';
import {useZarn} from './ZarnProvider';
import {Avatar} from './format';
import {startRing} from '@/lib/zarn-sound';

// 1:1 voice and video calls over WebRTC. The server only records call state (zarn_calls); the offer, answer and network candidates travel
// over a private-by-obscurity Supabase broadcast channel named after the call id, and the audio goes straight between the two people.
type Phase='idle'|'calling'|'incoming'|'connecting'|'active';
type Sig={t:'ready'}|{t:'video';on:boolean;screen?:boolean}|{t:'offer'|'answer';sdp:RTCSessionDescriptionInit}|{t:'ice';c:RTCIceCandidateInit}|{t:'bye'};
type Call={id:string;peer:string;channel:string;video:boolean};
const RING_TIMEOUT=45_000;
const Ctx=createContext<{start:(channelId:string,peerId:string,opts?:{video?:boolean})=>Promise<void>;busy:boolean}>({start:async()=>{},busy:false});
export const useCall=()=>useContext(Ctx);
const fmt=(s:number)=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
async function api(body:object){
 const r=await fetch('/api/zarn/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;
}

// The theme colours are defined on the .zarn root, so the call UI renders inside it (light and dark both work).
const portal=(node:React.ReactNode)=>createPortal(node,document.querySelector('.zarn')??document.body);
export default function CallProvider({children}:{children:React.ReactNode}){
 const {db,me,people}=useZarn();
 const [phase,setPhase]=useState<Phase>('idle'),[call,setCall]=useState<Call|null>(null),[muted,setMuted]=useState(false),[secs,setSecs]=useState(0),[notice,setNotice]=useState(''),[mini,setMini]=useState(false),[outs,setOuts]=useState<MediaDeviceInfo[]|null>(null),[outId,setOutId]=useState(''),[camOn,setCamOn]=useState(false),[sharing,setSharing]=useState(false),[peerVideo,setPeerVideo]=useState(false);
 const callRef=useRef<Call|null>(null),phaseRef=useRef<Phase>('idle');
 const pc=useRef<RTCPeerConnection|null>(null),stream=useRef<MediaStream|null>(null),sig=useRef<RealtimeChannel|null>(null);
 const pendingIce=useRef<RTCIceCandidateInit[]>([]),stopRing=useRef<(()=>void)|null>(null),timers=useRef<ReturnType<typeof setTimeout>[]>([]),tick=useRef<ReturnType<typeof setInterval>|null>(null);
 const audio=useRef<HTMLAudioElement>(null),iceRef=useRef<RTCIceServer[]>([]),initiator=useRef(false);
 const remoteStream=useRef<MediaStream|null>(null),camTrack=useRef<MediaStreamTrack|null>(null),screenTrack=useRef<MediaStreamTrack|null>(null),vSender=useRef<RTCRtpSender|null>(null),makingOffer=useRef(false),negotiated=useRef(false);
 // Video elements mount and unmount as the call is minimised, so they pick their stream up when they appear.
 const remoteEl=useCallback((el:HTMLVideoElement|null)=>{if(el){el.srcObject=remoteStream.current;void el.play().catch(()=>{});}},[]);
 const localEl=useCallback((el:HTMLVideoElement|null)=>{if(el){el.srcObject=screenTrack.current?new MediaStream([screenTrack.current]):camTrack.current?new MediaStream([camTrack.current]):null;void el.play().catch(()=>{});}},[]);
 const go=(p:Phase)=>{phaseRef.current=p;setPhase(p);};

 const cleanup=useCallback((msg='')=>{
  stopRing.current?.();stopRing.current=null;timers.current.forEach(clearTimeout);timers.current=[];if(tick.current)clearInterval(tick.current);tick.current=null;
  pc.current?.close();pc.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;camTrack.current?.stop();camTrack.current=null;screenTrack.current?.stop();screenTrack.current=null;vSender.current=null;remoteStream.current=null;negotiated.current=false;makingOffer.current=false;setCamOn(false);setSharing(false);setPeerVideo(false);
  if(sig.current){void db.removeChannel(sig.current);sig.current=null;}
  pendingIce.current=[];callRef.current=null;setCall(null);setMuted(false);setSecs(0);setMini(false);setOuts(null);go('idle');
  if(msg){setNotice(msg);timers.current.push(setTimeout(()=>setNotice(''),4000));}
  
 },[db]);

 const send=(m:Sig)=>{void sig.current?.send({type:'broadcast',event:'sig',payload:m});};
 const finish=useCallback(async(action:'end'|'decline',msg='')=>{
  const c=callRef.current;if(c){send({t:'bye'});void api({action,call_id:c.id}).catch(()=>{});}
  cleanup(msg);
  
 },[cleanup]);

 async function drainIce(){const p=pc.current;if(!p?.remoteDescription)return;for(const c of pendingIce.current.splice(0))await p.addIceCandidate(c).catch(()=>{});}
 function buildPc(){
  const p=new RTCPeerConnection({iceServers:iceRef.current});pc.current=p;
  stream.current!.getTracks().forEach(t=>{const sender=p.addTrack(t,stream.current!);if(t.kind==='video'){vSender.current=sender;camTrack.current=t;}});
  p.ontrack=e=>{
   remoteStream.current=e.streams[0]??remoteStream.current??new MediaStream();
   if(!remoteStream.current.getTracks().includes(e.track))remoteStream.current.addTrack(e.track);
   if(audio.current){audio.current.srcObject=remoteStream.current;void audio.current.play().catch(()=>{});}
   if(e.track.kind==='video')setPeerVideo(true);
  };
  // Turning the camera on mid-call adds a track, which needs a fresh offer. Both sides may do it at once, so one side (the callee) backs down.
  p.onnegotiationneeded=async()=>{if(!negotiated.current)return;try{makingOffer.current=true;await p.setLocalDescription();send({t:'offer',sdp:p.localDescription!.toJSON()});}catch{/* the next change retries */}finally{makingOffer.current=false;}};
  p.onicecandidate=e=>{if(e.candidate)send({t:'ice',c:e.candidate.toJSON()});};
  p.onconnectionstatechange=()=>{
   if(p.connectionState==='connected')negotiated.current=true;
   if(p.connectionState==='connected'&&phaseRef.current!=='active'){stopRing.current?.();stopRing.current=null;go('active');tick.current=setInterval(()=>setSecs(s=>s+1),1000);}
   if(p.connectionState==='failed')void finish('end','The call lost connection.');
   if(p.connectionState==='disconnected')timers.current.push(setTimeout(()=>{if(pc.current===p&&p.connectionState!=='connected')void finish('end','The call lost connection.');},8000));
  };
  return p;
 }
 function openSignal(id:string,onReady:()=>void){
  const ch=db.channel(`zarn-call-${id}`,{config:{broadcast:{self:false}}});sig.current=ch;
  ch.on('broadcast',{event:'sig'},async({payload}:{payload:Sig})=>{
   const p=pc.current;
   if(payload.t==='ready'&&initiator.current&&p){if(p.localDescription)send({t:'offer',sdp:p.localDescription.toJSON()});else{const o=await p.createOffer();await p.setLocalDescription(o);send({t:'offer',sdp:o});}}
   else if(payload.t==='video'){setPeerVideo(payload.on);}
   else if(payload.t==='offer'&&p){
    const collision=makingOffer.current||p.signalingState!=='stable';
    if(collision&&initiator.current)return; // the caller is the impolite side and ignores a clashing offer
    await p.setRemoteDescription(payload.sdp);await drainIce();const a=await p.createAnswer();await p.setLocalDescription(a);send({t:'answer',sdp:a});negotiated.current=true;}
   else if(payload.t==='answer'&&p){await p.setRemoteDescription(payload.sdp);await drainIce();negotiated.current=true;}
   else if(payload.t==='ice'){if(p?.remoteDescription)await p.addIceCandidate(payload.c).catch(()=>{});else pendingIce.current.push(payload.c);}
   else if(payload.t==='bye'&&callRef.current){cleanup(phaseRef.current==='calling'?'No answer.':'Call ended.');}
  }).subscribe((s:string)=>{if(s==='SUBSCRIBED')onReady();});
 }
 async function mic(video=false){
  const audioOpts={echoCancellation:true,noiseSuppression:true,autoGainControl:true};
  try{
   stream.current=await navigator.mediaDevices.getUserMedia(video?{audio:audioOpts,video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}}}:{audio:audioOpts});
   const v=stream.current.getVideoTracks()[0];if(v){camTrack.current=v;setCamOn(true);}
   return true;
  }catch{
   if(video){
    // No camera or no permission: carry on as a voice call.
    try{stream.current=await navigator.mediaDevices.getUserMedia({audio:audioOpts});setNotice('Camera unavailable, so this is a voice call.');timers.current.push(setTimeout(()=>setNotice(''),4000));return true;}catch{/* fall through */}
   }
   setNotice('Allow microphone access to make calls.');timers.current.push(setTimeout(()=>setNotice(''),5000));return false;
  }
 }

 const start=useCallback(async(channelId:string,peerId:string,opts?:{video?:boolean})=>{
  if(phaseRef.current!=='idle')return;
  if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==='undefined'){setNotice('Calls aren’t supported on this browser.');return;}
  go('calling');
  if(!await mic(!!opts?.video)){go('idle');return;}
  try{
   const d=await api({action:'start',channel_id:channelId,video:!!opts?.video});
   iceRef.current=d.ice;initiator.current=true;const c={id:d.call_id as string,peer:peerId,channel:channelId,video:!!opts?.video};callRef.current=c;setCall(c);
   buildPc();openSignal(c.id,()=>{});
   stopRing.current=startRing('out');
   timers.current.push(setTimeout(()=>{if(phaseRef.current==='calling')void finish('end','No answer.');},RING_TIMEOUT));
  }catch(e){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;camTrack.current=null;setCamOn(false);go('idle');setNotice(e instanceof Error?e.message:'Could not start the call.');timers.current.push(setTimeout(()=>setNotice(''),5000));}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);

 async function accept(){
  const c=callRef.current;if(!c||phaseRef.current!=='incoming')return;
  stopRing.current?.();stopRing.current=null;go('connecting');
  if(!await mic(c.video)){void finish('decline');return;}
  try{
   const d=await api({action:'answer',call_id:c.id});
   iceRef.current=d.ice;initiator.current=false;buildPc();
   // Say 'ready' until the caller's offer arrives, in case the first message is missed.
   openSignal(c.id,()=>{send({t:'ready'});const r=setInterval(()=>{if(!pc.current||pc.current.remoteDescription||!callRef.current)clearInterval(r);else send({t:'ready'});},2000);timers.current.push(r as unknown as ReturnType<typeof setTimeout>);});
  }catch(e){cleanup(e instanceof Error?e.message:'This call has ended.');}
 }

 // Someone is calling me / the call changed.
 // Pick up a call that is still ringing: when ZARN opens (e.g. from tapping the notification) and whenever the app comes back to the front.
 useEffect(()=>{
  const check=()=>{
   if(document.visibilityState!=='visible'||phaseRef.current!=='idle')return;
   void db.from('zarn_calls').select('id,caller_id,channel_id,created_at,video').eq('callee_id',me.user_id).eq('status','ringing').gt('created_at',new Date(Date.now()-RING_TIMEOUT).toISOString()).order('created_at',{ascending:false}).limit(1)
    .then(({data}:{data:{id:string;caller_id:string;channel_id:string;video:boolean}[]|null})=>{const r=data?.[0];if(!r||phaseRef.current!=='idle')return;const c={id:r.id,peer:r.caller_id,channel:r.channel_id,video:!!r.video};callRef.current=c;setCall(c);go('incoming');stopRing.current=startRing('in');timers.current.push(setTimeout(()=>{if(phaseRef.current==='incoming')cleanup();},RING_TIMEOUT));});
  };
  check();document.addEventListener('visibilitychange',check);window.addEventListener('focus',check);window.addEventListener('pageshow',check);
  return()=>{document.removeEventListener('visibilitychange',check);window.removeEventListener('focus',check);window.removeEventListener('pageshow',check);};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[db,me.user_id]);
 useEffect(()=>{
  const ch=db.channel(`zarn-calls-${me.user_id}`)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'zarn_calls',filter:`callee_id=eq.${me.user_id}`},(p:{new:Record<string,unknown>})=>{
    const r=p.new;if(r.status!=='ringing'||Date.now()-new Date(String(r.created_at)).getTime()>RING_TIMEOUT||phaseRef.current!=='idle')return;
    const c={id:String(r.id),peer:String(r.caller_id),channel:String(r.channel_id),video:r.video===true};callRef.current=c;setCall(c);go('incoming');
    stopRing.current=startRing('in');
    timers.current.push(setTimeout(()=>{if(phaseRef.current==='incoming')cleanup();},RING_TIMEOUT));
   })
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'zarn_calls'},(p:{new:Record<string,unknown>})=>{
    const r=p.new;if(String(r.id)!==callRef.current?.id||!['ended','missed','declined'].includes(String(r.status)))return;
    cleanup(r.status==='declined'?'Call declined.':phaseRef.current==='incoming'?'':'Call ended.');
   })
   .subscribe();
  return()=>{void db.removeChannel(ch);};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[db,me.user_id]);
 useEffect(()=>()=>cleanup(),[cleanup]);
 useEffect(()=>{const t=stream.current?.getAudioTracks()[0];if(t)t.enabled=!muted;},[muted]);

 // Speaker choice: browsers that allow it can send call audio to another output (headphones, speakers). Phones route audio themselves.
 const canSink=typeof HTMLMediaElement!=='undefined'&&'setSinkId' in HTMLMediaElement.prototype;
 async function toggleOutputs(){
  if(outs){setOuts(null);return;}
  try{const all=await navigator.mediaDevices.enumerateDevices();setOuts(all.filter(d=>d.kind==='audiooutput'));}catch{setOuts([]);}
 }
 async function pickOutput(id:string){
  try{await (audio.current as HTMLAudioElement&{setSinkId:(id:string)=>Promise<void>}).setSinkId(id);setOutId(id);}catch{setNotice('Could not switch the speaker.');timers.current.push(setTimeout(()=>setNotice(''),3000));}
  setOuts(null);
 }

 // Camera and screen share. The video sender is reused, so only the first time a track is added needs a new offer.
 function showVideoTrack(track:MediaStreamTrack|null){
  const p=pc.current;if(!p||!stream.current)return;
  if(vSender.current)void vSender.current.replaceTrack(track);
  else if(track)vSender.current=p.addTrack(track,stream.current);
 }
 async function toggleCamera(){
  if(camOn){camTrack.current?.stop();camTrack.current=null;setCamOn(false);if(!screenTrack.current){showVideoTrack(null);send({t:'video',on:false});}return;}
  try{
   const v=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}}});
   camTrack.current=v.getVideoTracks()[0];setCamOn(true);
   if(!screenTrack.current){showVideoTrack(camTrack.current);send({t:'video',on:true});}
  }catch{setNotice('Allow camera access to turn on video.');timers.current.push(setTimeout(()=>setNotice(''),4000));}
 }
 async function toggleShare(){
  if(sharing){stopShare();return;}
  try{
   const d=await navigator.mediaDevices.getDisplayMedia({video:true});
   const t=d.getVideoTracks()[0];screenTrack.current=t;setSharing(true);showVideoTrack(t);send({t:'video',on:true,screen:true});
   t.onended=()=>stopShare();
  }catch{/* cancelled in the browser's picker */}
 }
 function stopShare(){
  screenTrack.current?.stop();screenTrack.current=null;setSharing(false);
  if(camTrack.current){showVideoTrack(camTrack.current);send({t:'video',on:true});}else{showVideoTrack(null);send({t:'video',on:false});}
 }
 const canShare=typeof navigator!=='undefined'&&!!navigator.mediaDevices&&'getDisplayMedia' in navigator.mediaDevices;

 const value=useMemo(()=>({start,busy:phase!=='idle'}),[start,phase]);
 const peer=call?people[call.peer]:undefined,name=peer?.display_name??'Someone',stage=phase==='active'&&(peerVideo||camOn||sharing);
 return <Ctx.Provider value={value}>{children}
  <audio ref={audio} autoPlay playsInline/>
  {(notice||phase!=='idle')&&portal(<>
  {notice&&<div className="zn-call-toast" role="status">{notice}</div>}
  {phase!=='idle'&&call&&mini&&<div className="zn-call-mini" role="status">
   <button type="button" className="zn-call-mini-main" aria-label="Expand call" onClick={()=>setMini(false)}><Avatar m={peer} size={28}/><b>{name}</b><small>{phase==='active'?fmt(secs):phase==='incoming'?'Incoming':'Calling…'}</small></button>
   {phase==='active'&&<button type="button" className={muted?'is-on':''} aria-label={muted?'Unmute':'Mute'} aria-pressed={muted} onClick={()=>setMuted(m=>!m)}>{muted?<MicOff size={16}/>:<Mic size={16}/>}</button>}
   <button type="button" aria-label="Expand" onClick={()=>setMini(false)}><Maximize2 size={16}/></button>
   <button type="button" className="is-decline" aria-label="End call" onClick={()=>void finish(phase==='incoming'?'decline':'end')}><PhoneOff size={16}/></button>
  </div>}
  {phase!=='idle'&&call&&!mini&&<div className="zn-call-scrim"><div className={`zn-call${stage?' is-video':''}`} role="dialog" aria-modal="true" aria-label="Call">
   {phase!=='incoming'&&<button type="button" className="zn-call-min" aria-label="Minimize call" data-tip="Minimize" onClick={()=>setMini(true)}><Minimize2 size={16}/></button>}
   {stage?<div className="zn-call-stage"><video ref={remoteEl} className="zn-call-remote" autoPlay playsInline muted style={{display:peerVideo?undefined:'none'}}/>{!peerVideo&&<div className="zn-call-avatar"><Avatar m={peer} size={96}/></div>}{(camOn||sharing)&&<video key={sharing?'screen':'cam'} ref={localEl} className={`zn-call-local${sharing?'':' is-mirror'}`} autoPlay playsInline muted/>}</div>
    :<div className={`zn-call-avatar${phase==='incoming'||phase==='calling'?' is-ringing':''}`}><Avatar m={peer} size={96}/></div>}
   <div className="zn-call-info"><b>{name}</b><small>{phase==='incoming'?(call.video?'Incoming video call':'Incoming voice call'):phase==='calling'?'Calling…':phase==='connecting'?'Connecting…':fmt(secs)}</small></div>
   <div className="zn-call-actions">
    {phase==='incoming'?<>
     <button type="button" className="is-decline" aria-label="Decline" onClick={()=>void finish('decline')}><PhoneOff size={22}/><span>Decline</span></button>
     <button type="button" className="is-accept" aria-label="Accept" onClick={()=>void accept()}><Phone size={22}/><span>Accept</span></button>
    </>:<>
     {phase==='active'&&<button type="button" className={muted?'is-on':''} aria-label={muted?'Unmute':'Mute'} aria-pressed={muted} onClick={()=>setMuted(m=>!m)}>{muted?<MicOff size={22}/>:<Mic size={22}/>}<span>{muted?'Unmute':'Mute'}</span></button>}
     {phase==='active'&&<button type="button" className={camOn?'is-on':''} aria-label={camOn?'Turn camera off':'Turn camera on'} aria-pressed={camOn} onClick={()=>void toggleCamera()}>{camOn?<Video size={22}/>:<VideoOff size={22}/>}<span>{camOn?'Camera':'Camera off'}</span></button>}
     {phase==='active'&&canShare&&<button type="button" className={sharing?'is-on':''} aria-label={sharing?'Stop sharing':'Share screen'} aria-pressed={sharing} onClick={()=>void toggleShare()}>{sharing?<ScreenShareOff size={22}/>:<ScreenShare size={22}/>}<span>{sharing?'Stop share':'Share'}</span></button>}
     {phase==='active'&&canSink&&<button type="button" aria-label="Choose speaker" aria-expanded={!!outs} onClick={()=>void toggleOutputs()}><Volume2 size={22}/><span>Speaker</span></button>}
     <button type="button" className="is-decline" aria-label={phase==='active'?'End call':'Cancel'} onClick={()=>void finish('end')}><PhoneOff size={22}/><span>{phase==='active'?'End':'Cancel'}</span></button>
    </>}
   </div>
   {outs&&<ul className="zn-call-outs" aria-label="Speakers">{outs.length?outs.map(d=><li key={d.deviceId}><button type="button" onClick={()=>void pickOutput(d.deviceId)}>{(outId||'default')===d.deviceId?<Check size={14}/>:<i/>}<span>{d.label||'Speaker'}</span></button></li>):<li className="is-empty">No other speakers found.</li>}</ul>}
  </div></div>}
  </>)}
 </Ctx.Provider>;
}
