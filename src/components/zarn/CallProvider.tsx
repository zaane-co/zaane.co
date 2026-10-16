'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {Check,Maximize2,Mic,MicOff,Minimize2,Phone,PhoneOff,Volume2} from 'lucide-react';
import type {RealtimeChannel} from '@supabase/supabase-js';
import {useZarn} from './ZarnProvider';
import {Avatar} from './format';
import {startRing} from '@/lib/zarn-sound';

// 1:1 voice calls over WebRTC. The server only records call state (zarn_calls); the offer, answer and network candidates travel
// over a private-by-obscurity Supabase broadcast channel named after the call id, and the audio goes straight between the two people.
type Phase='idle'|'calling'|'incoming'|'connecting'|'active';
type Sig={t:'ready'}|{t:'offer'|'answer';sdp:RTCSessionDescriptionInit}|{t:'ice';c:RTCIceCandidateInit}|{t:'bye'};
type Call={id:string;peer:string;channel:string};
const RING_TIMEOUT=45_000;
const Ctx=createContext<{start:(channelId:string,peerId:string)=>Promise<void>;busy:boolean}>({start:async()=>{},busy:false});
export const useCall=()=>useContext(Ctx);
const fmt=(s:number)=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
async function api(body:object){
 const r=await fetch('/api/zarn/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;
}

export default function CallProvider({children}:{children:React.ReactNode}){
 const {db,me,people}=useZarn();
 const [phase,setPhase]=useState<Phase>('idle'),[call,setCall]=useState<Call|null>(null),[muted,setMuted]=useState(false),[secs,setSecs]=useState(0),[notice,setNotice]=useState(''),[mini,setMini]=useState(false),[outs,setOuts]=useState<MediaDeviceInfo[]|null>(null),[outId,setOutId]=useState('');
 const callRef=useRef<Call|null>(null),phaseRef=useRef<Phase>('idle');
 const pc=useRef<RTCPeerConnection|null>(null),stream=useRef<MediaStream|null>(null),sig=useRef<RealtimeChannel|null>(null);
 const pendingIce=useRef<RTCIceCandidateInit[]>([]),stopRing=useRef<(()=>void)|null>(null),timers=useRef<ReturnType<typeof setTimeout>[]>([]),tick=useRef<ReturnType<typeof setInterval>|null>(null);
 const audio=useRef<HTMLAudioElement>(null),iceRef=useRef<RTCIceServer[]>([]),initiator=useRef(false);
 const go=(p:Phase)=>{phaseRef.current=p;setPhase(p);};

 const cleanup=useCallback((msg='')=>{
  stopRing.current?.();stopRing.current=null;timers.current.forEach(clearTimeout);timers.current=[];if(tick.current)clearInterval(tick.current);tick.current=null;
  pc.current?.close();pc.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;
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
  stream.current!.getTracks().forEach(t=>p.addTrack(t,stream.current!));
  p.ontrack=e=>{if(audio.current){audio.current.srcObject=e.streams[0]??new MediaStream([e.track]);void audio.current.play().catch(()=>{});}};
  p.onicecandidate=e=>{if(e.candidate)send({t:'ice',c:e.candidate.toJSON()});};
  p.onconnectionstatechange=()=>{
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
   else if(payload.t==='offer'&&p){await p.setRemoteDescription(payload.sdp);await drainIce();const a=await p.createAnswer();await p.setLocalDescription(a);send({t:'answer',sdp:a});}
   else if(payload.t==='answer'&&p){await p.setRemoteDescription(payload.sdp);await drainIce();}
   else if(payload.t==='ice'){if(p?.remoteDescription)await p.addIceCandidate(payload.c).catch(()=>{});else pendingIce.current.push(payload.c);}
   else if(payload.t==='bye'&&callRef.current){cleanup(phaseRef.current==='calling'?'No answer.':'Call ended.');}
  }).subscribe((s:string)=>{if(s==='SUBSCRIBED')onReady();});
 }
 async function mic(){
  try{stream.current=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});return true;}
  catch{setNotice('Allow microphone access to make calls.');timers.current.push(setTimeout(()=>setNotice(''),5000));return false;}
 }

 const start=useCallback(async(channelId:string,peerId:string)=>{
  if(phaseRef.current!=='idle')return;
  if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==='undefined'){setNotice('Calls aren’t supported on this browser.');return;}
  go('calling');
  if(!await mic()){go('idle');return;}
  try{
   const d=await api({action:'start',channel_id:channelId});
   iceRef.current=d.ice;initiator.current=true;const c={id:d.call_id as string,peer:peerId,channel:channelId};callRef.current=c;setCall(c);
   buildPc();openSignal(c.id,()=>{});
   stopRing.current=startRing('out');
   timers.current.push(setTimeout(()=>{if(phaseRef.current==='calling')void finish('end','No answer.');},RING_TIMEOUT));
  }catch(e){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;go('idle');setNotice(e instanceof Error?e.message:'Could not start the call.');timers.current.push(setTimeout(()=>setNotice(''),5000));}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);

 async function accept(){
  const c=callRef.current;if(!c||phaseRef.current!=='incoming')return;
  stopRing.current?.();stopRing.current=null;go('connecting');
  if(!await mic()){void finish('decline');return;}
  try{
   const d=await api({action:'answer',call_id:c.id});
   iceRef.current=d.ice;initiator.current=false;buildPc();
   // Say 'ready' until the caller's offer arrives, in case the first message is missed.
   openSignal(c.id,()=>{send({t:'ready'});const r=setInterval(()=>{if(!pc.current||pc.current.remoteDescription||!callRef.current)clearInterval(r);else send({t:'ready'});},2000);timers.current.push(r as unknown as ReturnType<typeof setTimeout>);});
  }catch(e){cleanup(e instanceof Error?e.message:'This call has ended.');}
 }

 // Someone is calling me / the call changed.
 useEffect(()=>{
  void db.from('zarn_calls').select('id,caller_id,channel_id,created_at').eq('callee_id',me.user_id).eq('status','ringing').gt('created_at',new Date(Date.now()-RING_TIMEOUT).toISOString()).order('created_at',{ascending:false}).limit(1)
   .then(({data}:{data:{id:string;caller_id:string;channel_id:string}[]|null})=>{const r=data?.[0];if(!r||phaseRef.current!=='idle')return;const c={id:r.id,peer:r.caller_id,channel:r.channel_id};callRef.current=c;setCall(c);go('incoming');stopRing.current=startRing('in');timers.current.push(setTimeout(()=>{if(phaseRef.current==='incoming')cleanup();},RING_TIMEOUT));});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[db,me.user_id]);
 useEffect(()=>{
  const ch=db.channel(`zarn-calls-${me.user_id}`)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'zarn_calls',filter:`callee_id=eq.${me.user_id}`},(p:{new:Record<string,unknown>})=>{
    const r=p.new;if(r.status!=='ringing'||Date.now()-new Date(String(r.created_at)).getTime()>RING_TIMEOUT||phaseRef.current!=='idle')return;
    const c={id:String(r.id),peer:String(r.caller_id),channel:String(r.channel_id)};callRef.current=c;setCall(c);go('incoming');
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

 const value=useMemo(()=>({start,busy:phase!=='idle'}),[start,phase]);
 const peer=call?people[call.peer]:undefined,name=peer?.display_name??'Someone';
 return <Ctx.Provider value={value}>{children}
  <audio ref={audio} autoPlay playsInline/>
  {notice&&<div className="zn-call-toast" role="status">{notice}</div>}
  {phase!=='idle'&&call&&mini&&<div className="zn-call-mini" role="status">
   <button type="button" className="zn-call-mini-main" aria-label="Expand call" onClick={()=>setMini(false)}><Avatar m={peer} size={28}/><b>{name}</b><small>{phase==='active'?fmt(secs):phase==='incoming'?'Incoming':'Calling…'}</small></button>
   {phase==='active'&&<button type="button" className={muted?'is-on':''} aria-label={muted?'Unmute':'Mute'} aria-pressed={muted} onClick={()=>setMuted(m=>!m)}>{muted?<MicOff size={16}/>:<Mic size={16}/>}</button>}
   <button type="button" aria-label="Expand" onClick={()=>setMini(false)}><Maximize2 size={16}/></button>
   <button type="button" className="is-decline" aria-label="End call" onClick={()=>void finish(phase==='incoming'?'decline':'end')}><PhoneOff size={16}/></button>
  </div>}
  {phase!=='idle'&&call&&!mini&&<div className="zn-call-scrim"><div className="zn-call" role="dialog" aria-modal="true" aria-label="Voice call">
   {phase!=='incoming'&&<button type="button" className="zn-call-min" aria-label="Minimize call" data-tip="Minimize" onClick={()=>setMini(true)}><Minimize2 size={16}/></button>}
   <div className={`zn-call-avatar${phase==='incoming'||phase==='calling'?' is-ringing':''}`}><Avatar m={peer} size={96}/></div>
   <div className="zn-call-info"><b>{name}</b><small>{phase==='incoming'?'Incoming voice call':phase==='calling'?'Calling…':phase==='connecting'?'Connecting…':fmt(secs)}</small></div>
   <div className="zn-call-actions">
    {phase==='incoming'?<>
     <button type="button" className="is-decline" aria-label="Decline" onClick={()=>void finish('decline')}><PhoneOff size={22}/><span>Decline</span></button>
     <button type="button" className="is-accept" aria-label="Accept" onClick={()=>void accept()}><Phone size={22}/><span>Accept</span></button>
    </>:<>
     {phase==='active'&&<button type="button" className={muted?'is-on':''} aria-label={muted?'Unmute':'Mute'} aria-pressed={muted} onClick={()=>setMuted(m=>!m)}>{muted?<MicOff size={22}/>:<Mic size={22}/>}<span>{muted?'Unmute':'Mute'}</span></button>}
     {phase==='active'&&canSink&&<button type="button" aria-label="Choose speaker" aria-expanded={!!outs} onClick={()=>void toggleOutputs()}><Volume2 size={22}/><span>Speaker</span></button>}
     <button type="button" className="is-decline" aria-label={phase==='active'?'End call':'Cancel'} onClick={()=>void finish('end')}><PhoneOff size={22}/><span>{phase==='active'?'End':'Cancel'}</span></button>
    </>}
   </div>
   {outs&&<ul className="zn-call-outs" aria-label="Speakers">{outs.length?outs.map(d=><li key={d.deviceId}><button type="button" onClick={()=>void pickOutput(d.deviceId)}>{(outId||'default')===d.deviceId?<Check size={14}/>:<i/>}<span>{d.label||'Speaker'}</span></button></li>):<li className="is-empty">No other speakers found.</li>}</ul>}
  </div></div>}
 </Ctx.Provider>;
}
