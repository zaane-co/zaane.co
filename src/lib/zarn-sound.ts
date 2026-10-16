'use client';
import {useSyncExternalStore} from 'react';
// ZARN message sound, made with Web Audio (no file to download). Browsers only allow audio after the person has
// interacted with the page, so the context is unlocked on the first tap/click. Settings live in this browser only.
export type Tone='chime'|'pop'|'bell';
export type Volume='low'|'medium'|'high';
export type Scope='direct'|'all';
export type SoundSettings={on:boolean;tone:Tone;volume:Volume;scope:Scope};
export const tones:{id:Tone;label:string}[]=[{id:'chime',label:'Chime'},{id:'pop',label:'Pop'},{id:'bell',label:'Bell'}];
const KEY='zarn-sound-v2',OLD='zarn-sound';
const gains:Record<Volume,number>={low:.12,medium:.32,high:.65};
const defaults:SoundSettings={on:true,tone:'chime',volume:'medium',scope:'direct'};
let ctx:AudioContext|null=null;
const listeners=new Set<()=>void>();
function unlock(){
 if(ctx)return;
 try{ctx=new (window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext)();void ctx.resume();}catch{ctx=null;}
}
if(typeof window!=='undefined'){for(const ev of ['pointerdown','keydown','touchstart'])window.addEventListener(ev,unlock,{once:false,passive:true});}
let cache:{raw:string|null;value:SoundSettings}={raw:'\0',value:defaults};
export function getSound():SoundSettings{
 let raw:string|null=null;try{raw=localStorage.getItem(KEY);if(raw===null&&localStorage.getItem(OLD)==='off')raw=JSON.stringify({...defaults,on:false});}catch{}
 if(raw===cache.raw)return cache.value;
 let value=defaults;try{if(raw)value={...defaults,...JSON.parse(raw)};}catch{}
 cache={raw,value};return value;
}
export const soundOn=()=>getSound().on;
export function updateSound(patch:Partial<SoundSettings>){try{localStorage.setItem(KEY,JSON.stringify({...getSound(),...patch}));}catch{}listeners.forEach(fn=>fn());}
export const setSound=(on:boolean)=>{updateSound({on});if(on)playChime(true);};
export function useSoundSettings(){return useSyncExternalStore(cb=>{listeners.add(cb);return()=>{listeners.delete(cb);};},getSound,()=>defaults);}
export const useSound=()=>useSoundSettings().on;
let last=0;
function note(c:AudioContext,type:OscillatorType,from:number,to:number,at:number,len:number,peak:number){
 const t=c.currentTime+at,o=c.createOscillator(),g=c.createGain();
 o.type=type;o.frequency.setValueAtTime(from,t);if(to!==from)o.frequency.exponentialRampToValueAtTime(to,t+len*.6);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+len);
 o.connect(g).connect(c.destination);o.start(t);o.stop(t+len+.03);
}
// force=true plays even if sounds are off or a chime just played (used by the settings preview).
export function playChime(force=false,override?:Partial<SoundSettings>){
 const s={...getSound(),...override};
 if(!ctx||(!s.on&&!force))return;
 const now=Date.now();if(!force&&now-last<1200)return;last=now; // a burst of messages sounds once
 if(ctx.state==='suspended')void ctx.resume();
 const p=gains[s.volume];
 if(s.tone==='pop'){note(ctx,'triangle',700,300,0,.16,p*1.3);}
 else if(s.tone==='bell'){note(ctx,'sine',1046.5,1046.5,0,.9,p);note(ctx,'sine',2093,2093,0,.5,p*.4);note(ctx,'sine',1568,1568,.12,.8,p*.7);}
 else{note(ctx,'sine',880,880,0,.35,p);note(ctx,'sine',1318.5,1318.5,.11,.35,p);}
}
// Ringing for voice calls: repeats until the returned stop function is called. 'in' is the rapid double ring, 'out' the slower ringback.
export function startRing(kind:'in'|'out'){
 const burst=()=>{if(!ctx)return;if(ctx.state==='suspended')void ctx.resume();
  if(kind==='in'){note(ctx,'sine',523,523,0,.28,.3);note(ctx,'sine',659,659,.3,.28,.3);note(ctx,'sine',523,523,.9,.28,.3);note(ctx,'sine',659,659,1.2,.28,.3);}
  else{note(ctx,'sine',440,440,0,.9,.14);note(ctx,'sine',480,480,0,.9,.14);}};
 burst();const t=setInterval(burst,kind==='in'?2800:3500);
 return()=>clearInterval(t);
}
