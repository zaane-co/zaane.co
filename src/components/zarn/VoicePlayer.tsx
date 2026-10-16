'use client';
import {useEffect,useRef,useState} from 'react';
import {Loader2,Pause,Play} from 'lucide-react';
import type {ZAttachment} from '@/lib/zarn';
const fmt=(s:number)=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
// A voice note in a message. The (small) file is fetched once so it plays on tap, including on iPhone.
export default function VoicePlayer({messageId,index,att,src}:{messageId?:string;index?:number;att:ZAttachment;src?:string}){
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false),[playing,setPlaying]=useState(false),[pos,setPos]=useState(0),[rate,setRate]=useState(1),[dur,setDur]=useState(0);
 const audio=useRef<HTMLAudioElement|null>(null);
 useEffect(()=>{
  let url='',live=true;
  void (async()=>{
   try{
    const r=await fetch(src?`${src}&download=1`:`/api/zarn/files?m=${messageId}&i=${index}&download=1`);if(!r.ok)throw new Error();
    const blob=await r.blob();if(!live)return;
    url=URL.createObjectURL(new Blob([blob],{type:att.type}));
    const a=new Audio(url);a.preload='auto';
    a.onloadedmetadata=()=>{if(Number.isFinite(a.duration))setDur(a.duration);};a.ontimeupdate=()=>setPos(a.currentTime);a.onplay=()=>setPlaying(true);a.onpause=()=>setPlaying(false);a.onended=()=>{setPlaying(false);setPos(0);};
    audio.current=a;setReady(true);
   }catch{if(live)setFailed(true);}
  })();
  return()=>{live=false;audio.current?.pause();audio.current=null;if(url)URL.revokeObjectURL(url);};
 },[messageId,index,src,att.type]);
 const total=att.duration||dur;
 function toggle(){const a=audio.current;if(!a)return;if(a.paused)void a.play().catch(()=>setFailed(true));else a.pause();}
 function cycle(){const next=rate===1?1.5:rate===1.5?2:1;setRate(next);if(audio.current)audio.current.playbackRate=next;}
 return <div className="zn-voice" role="group" aria-label="Voice note">
  <button type="button" className="zn-voice-play" aria-label={playing?'Pause':'Play voice note'} disabled={!ready||failed} onClick={toggle}>{!ready&&!failed?<Loader2 size={16} className="zn-spin"/>:playing?<Pause size={16}/>:<Play size={16}/>}</button>
  <input type="range" className="zn-voice-bar" aria-label="Seek" min={0} max={total||1} step={0.1} value={Math.min(pos,total||1)} disabled={!ready||failed||!total} onChange={e=>{const t=Number(e.target.value);if(audio.current)audio.current.currentTime=t;setPos(t);}} style={{'--p':`${total?Math.min(100,pos/total*100):0}%`} as React.CSSProperties}/>
  <time>{failed?'Unavailable':fmt(playing||pos>0?pos:total)}</time>
  <button type="button" className="zn-voice-rate" aria-label="Playback speed" onClick={cycle}>{rate}x</button>
 </div>;
}
