'use client';
import {useEffect,useRef,useState} from 'react';
import {Loader2,Pause,Play} from 'lucide-react';
import type {ZAttachment} from '@/lib/zarn';
const fmt=(s:number)=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const BARS=36;
// Only one voice note plays at a time: starting one pauses whichever was playing.
let current:HTMLAudioElement|null=null;
// Loudness of the recording in BARS slices, for the waveform. Falls back to an even shape if the browser can't decode it.
async function peaks(blob:Blob):Promise<number[]>{
 try{
  const Ctx=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
  const ctx=new Ctx();const buf=await ctx.decodeAudioData(await blob.arrayBuffer());void ctx.close();
  const d=buf.getChannelData(0),step=Math.max(1,Math.floor(d.length/BARS)),out:number[]=[];
  for(let i=0;i<BARS;i++){let s=0;for(let j=i*step;j<Math.min(d.length,(i+1)*step);j+=16)s=Math.max(s,Math.abs(d[j]));out.push(s);}
  const top=Math.max(...out,0.01);return out.map(v=>Math.max(0.12,v/top));
 }catch{return Array.from({length:BARS},(_,i)=>0.3+0.25*Math.abs(Math.sin(i*1.7)));}
}
// A voice note in a message. The (small) file is fetched once so it plays on tap, including on iPhone.
export default function VoicePlayer({messageId,index,att,src}:{messageId?:string;index?:number;att:ZAttachment;src?:string}){
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false),[playing,setPlaying]=useState(false),[pos,setPos]=useState(0),[rate,setRate]=useState(1),[dur,setDur]=useState(0),[wave,setWave]=useState<number[]|null>(null);
 const audio=useRef<HTMLAudioElement|null>(null),raf=useRef(0);
 useEffect(()=>{
  let url='',live=true;
  void (async()=>{
   try{
    const r=await fetch(src?`${src}&download=1`:`/api/zarn/files?m=${messageId}&i=${index}&download=1`);if(!r.ok)throw new Error();
    const blob=new Blob([await r.blob()],{type:att.type});if(!live)return;
    url=URL.createObjectURL(blob);
    const a=new Audio();a.preload='auto';a.src=url;
    // Chrome saves recordings without their length, which makes seeking jumpy. Asking for the far end makes it work the length out.
    a.onloadedmetadata=()=>{
     if(Number.isFinite(a.duration)){setDur(a.duration);return;}
     a.ondurationchange=()=>{if(Number.isFinite(a.duration)){a.ondurationchange=null;setDur(a.duration);a.currentTime=0;}};
     a.currentTime=1e7;
    };
    const tick=()=>{setPos(a.currentTime);raf.current=requestAnimationFrame(tick);};
    a.onplay=()=>{if(current&&current!==a)current.pause();current=a;setPlaying(true);cancelAnimationFrame(raf.current);raf.current=requestAnimationFrame(tick);};
    a.onpause=()=>{setPlaying(false);cancelAnimationFrame(raf.current);setPos(a.currentTime);};
    a.onended=()=>{setPlaying(false);cancelAnimationFrame(raf.current);setPos(0);a.currentTime=0;if(current===a)current=null;};
    audio.current=a;setReady(true);
    void peaks(blob).then(p=>{if(live)setWave(p);});
   }catch{if(live)setFailed(true);}
  })();
  return()=>{live=false;cancelAnimationFrame(raf.current);const a=audio.current;if(a){a.pause();if(current===a)current=null;}audio.current=null;if(url)URL.revokeObjectURL(url);};
 },[messageId,index,src,att.type]);
 const total=att.duration||dur;
 const pct=total?Math.min(1,pos/total):0;
 function toggle(){const a=audio.current;if(!a)return;if(a.paused){a.playbackRate=rate;void a.play().catch(()=>setFailed(true));}else a.pause();}
 function cycle(){const next=rate===1?1.5:rate===1.5?2:1;setRate(next);if(audio.current)audio.current.playbackRate=next;}
 function seekTo(frac:number){const a=audio.current;if(!a||!total)return;const t=Math.max(0,Math.min(total-0.05,frac*total));a.currentTime=t;setPos(t);}
 function seek(e:React.PointerEvent<HTMLDivElement>){const r=e.currentTarget.getBoundingClientRect();seekTo((e.clientX-r.left)/r.width);}
 const bars=wave??Array.from({length:BARS},()=>0.18);
 return <div className={`zn-voice${playing?' is-playing':''}`} role="group" aria-label="Voice note">
  <button type="button" className="zn-voice-play" aria-label={playing?'Pause':'Play voice note'} disabled={!ready||failed} onClick={toggle}>{!ready&&!failed?<Loader2 size={16} className="zn-spin"/>:playing?<Pause size={16} fill="currentColor"/>:<Play size={16} fill="currentColor"/>}</button>
  <div className="zn-voice-wave" role="slider" tabIndex={ready?0:-1} aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(pos)}
   onPointerDown={e=>{if(!ready||failed)return;e.currentTarget.setPointerCapture(e.pointerId);seek(e);}} onPointerMove={e=>{if(e.buttons)seek(e);}}
   onKeyDown={e=>{if(e.key==='ArrowRight')seekTo(pct+0.05);if(e.key==='ArrowLeft')seekTo(pct-0.05);if(e.key===' '||e.key==='Enter'){e.preventDefault();toggle();}}}>
   {bars.map((h,i)=><i key={i} className={(i+0.5)/BARS<=pct?'is-on':''} style={{height:`${Math.round(h*100)}%`}}/>)}
  </div>
  <time>{failed?'Unavailable':fmt(playing||pos>0?pos:total)}</time>
  <button type="button" className="zn-voice-rate" aria-label="Playback speed" onClick={cycle}>{rate}x</button>
 </div>;
}
