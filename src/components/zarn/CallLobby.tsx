'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronDown,Mic,MicOff,Phone,Video,VideoOff,Volume2,X} from 'lucide-react';
import type {ZMember} from '@/lib/zarn';
import {Avatar} from './format';

export type LobbyResult={stream:MediaStream;video:boolean;muted:boolean;outId:string};
function DeviceSelect({icon,list,value,onChange,label}:{icon:React.ReactNode;list:MediaDeviceInfo[];value:string;onChange:(v:string)=>void;label:string}){
 return <label className="zn-lobby-dev" title={label}>{icon}
  <select aria-label={label} value={value} onChange={e=>onChange(e.target.value)} disabled={!list.length}>{!value&&<option value="">Default {label.toLowerCase()}</option>}{list.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||label}</option>)}</select><ChevronDown size={14}/></label>;
}
const audioOpts={echoCancellation:true,noiseSuppression:true,autoGainControl:true};

// Before a call: check your camera and mic, pick devices, then start.
export default function CallLobby({peer,me,video:startVideo,onCancel,onStart}:{peer?:ZMember;me:ZMember;video:boolean;onCancel:()=>void;onStart:(r:LobbyResult)=>void}){
 const [video,setVideo]=useState(startVideo),[muted,setMuted]=useState(false),[err,setErr]=useState('');
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]),[micId,setMicId]=useState(''),[camId,setCamId]=useState(''),[outId,setOutId]=useState('');
 const [level,setLevel]=useState(0),[ready,setReady]=useState(false);
 const stream=useRef<MediaStream|null>(null),vid=useRef<HTMLVideoElement>(null),handed=useRef(false);
 const canSink=typeof HTMLMediaElement!=='undefined'&&'setSinkId' in HTMLMediaElement.prototype;

 // (Re)open the preview whenever the camera or a device changes.
 useEffect(()=>{let live=true;
  void (async()=>{
   try{
    const s=await navigator.mediaDevices.getUserMedia({audio:{...audioOpts,...(micId?{deviceId:{exact:micId}}:{})},video:video?{...(camId?{deviceId:{exact:camId}}:{facingMode:'user'}),width:{ideal:1280},height:{ideal:720}}:false});
    if(!live){s.getTracks().forEach(t=>t.stop());return;}
    stream.current?.getTracks().forEach(t=>t.stop());stream.current=s;setErr('');setReady(true);
    if(vid.current){vid.current.srcObject=video?s:null;void vid.current.play().catch(()=>{});}
    const all=await navigator.mediaDevices.enumerateDevices();if(live)setDevices(all);
   }catch{if(live)setErr(video?'Allow camera and microphone access to call.':'Allow microphone access to call.');}
  })();
  return()=>{live=false;};
 },[video,micId,camId]);
 // Stop the preview if the lobby closes without starting.
 useEffect(()=>()=>{if(!handed.current)stream.current?.getTracks().forEach(t=>t.stop());},[]);
 // Live mic level so you can see the mic is working.
 useEffect(()=>{const s=stream.current;if(!s||!s.getAudioTracks().length)return;let raf=0;const ctx=new AudioContext(),src=ctx.createMediaStreamSource(s),an=ctx.createAnalyser();an.fftSize=256;src.connect(an);const buf=new Uint8Array(an.frequencyBinCount);
  const tick=()=>{an.getByteFrequencyData(buf);let sum=0;for(const v of buf)sum+=v;setLevel(Math.min(1,sum/buf.length/60));raf=requestAnimationFrame(tick);};tick();
  return()=>{cancelAnimationFrame(raf);void ctx.close();};},[devices]);
 useEffect(()=>{stream.current?.getAudioTracks().forEach(t=>{t.enabled=!muted;});},[muted,devices]);

 const pick=(kind:MediaDeviceKind)=>devices.filter(d=>d.kind===kind&&d.deviceId);
 const go=()=>{if(!stream.current)return;handed.current=true;onStart({stream:stream.current,video,muted,outId});};
 const bars=[0.2,0.45,0.7,1];

 return <div className="zn-lobby-scrim" onKeyDown={e=>{if(e.key==='Escape')onCancel();}}>
  <div className="zn-lobby" role="dialog" aria-label="Start a call">
   <p className="zn-lobby-title">{video?'Video call':'Voice call'} with <b>{peer?.display_name??'them'}</b></p>
   <div className="zn-lobby-stage">
    <video ref={vid} className="zn-lobby-video" autoPlay playsInline muted style={{display:video&&!err?undefined:'none'}}/>
    {(!video||err)&&<div className="zn-lobby-me"><Avatar m={me} size={112}/></div>}
    {err&&<p className="zn-lobby-err">{err}</p>}
    <span className={`zn-lobby-level${muted?' is-muted':''}`} aria-hidden>{muted?<MicOff size={13}/>:bars.map((b,i)=><i key={i} className={level>=b*0.6?'is-on':''}/>)}</span>
    <div className="zn-lobby-toggles">
     <button type="button" className={muted?'is-off':''} aria-label={muted?'Unmute':'Mute'} aria-pressed={muted} onClick={()=>setMuted(m=>!m)}>{muted?<MicOff size={18}/>:<Mic size={18}/>}</button>
     <button type="button" className={video?'':'is-off'} aria-label={video?'Turn camera off':'Turn camera on'} aria-pressed={video} onClick={()=>setVideo(v=>!v)}>{video?<Video size={18}/>:<VideoOff size={18}/>}</button>
    </div>
   </div>
   <div className="zn-lobby-devs">
    <DeviceSelect icon={<Mic size={15}/>} list={pick('audioinput')} value={micId} onChange={setMicId} label="Microphone"/>
    {canSink&&<DeviceSelect icon={<Volume2 size={15}/>} list={pick('audiooutput')} value={outId} onChange={setOutId} label="Speaker"/>}
    <DeviceSelect icon={<Video size={15}/>} list={pick('videoinput')} value={camId} onChange={v=>{setCamId(v);setVideo(true);}} label="Camera"/>
   </div>
   <div className="zn-lobby-acts">
    <button type="button" className="zn-lobby-btn" onClick={onCancel}><span><X size={20}/></span>Cancel</button>
    <button type="button" className="zn-lobby-btn is-go" disabled={!ready} onClick={go}><span>{video?<Video size={20}/>:<Phone size={20}/>}</span>Start call</button>
   </div>
  </div>
 </div>;
}
