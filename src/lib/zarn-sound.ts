'use client';
import {useSyncExternalStore} from 'react';
// ZARN message sound, made with Web Audio (no file to download). Browsers only allow audio after the person has
// interacted with the page, so the context is unlocked on the first tap/click. Settings live in this browser only.
export type Tone=string;
export type Volume='low'|'medium'|'high'|'max';
export type Scope='direct'|'all';
export type SoundSettings={on:boolean;tone:Tone;volume:Volume;scope:Scope};
// Message sounds: short recorded clips from Notify Sound (notifysound.com, CC BY 4.0, credited in settings), served from /zarn-sounds.
export const tones:{id:Tone;label:string;loud?:boolean}[]=[
 {id:'quick-reply',label:'Quick reply'},{id:'soft-ping',label:'Soft ping'},{id:'ding',label:'Ding'},{id:'chime',label:'Chime'},{id:'tri-tone',label:'Tri-tone'},
 {id:'bubble-up',label:'Bubble up'},{id:'blip-up',label:'Blip up'},{id:'popcorn',label:'Popcorn'},{id:'marimba',label:'Marimba'},{id:'bell',label:'Bell'},
 {id:'coin',label:'Coin'},{id:'ka-ching',label:'Ka-ching'},{id:'whoosh',label:'Whoosh'},{id:'beep',label:'Beep',loud:true},{id:'doorbell',label:'Doorbell',loud:true}];
// v3: everyone starts on Marimba once; their on/off, volume and scope carry over from v2.
const KEY='zarn-sound-v3',V2='zarn-sound-v2',OLD='zarn-sound';
const gains:Record<Volume,number>={low:.12,medium:.32,high:.65,max:1};
const defaults:SoundSettings={on:true,tone:'marimba',volume:'medium',scope:'direct'};
let ctx:AudioContext|null=null;
const listeners=new Set<()=>void>();
function unlock(){
 if(ctx)return;
 try{ctx=new (window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext)();void ctx.resume();}catch{ctx=null;}
}
if(typeof window!=='undefined'){for(const ev of ['pointerdown','keydown','touchstart'])window.addEventListener(ev,unlock,{once:false,passive:true});}
let cache:{raw:string|null;value:SoundSettings}={raw:'\0',value:defaults};
export function getSound():SoundSettings{
 let raw:string|null=null;try{raw=localStorage.getItem(KEY);
  if(raw===null){const v2=localStorage.getItem(V2);if(v2){try{const {on,volume,scope}=JSON.parse(v2) as Partial<SoundSettings>;raw=JSON.stringify({...defaults,...(on!==undefined&&{on}),...(volume&&{volume}),...(scope&&{scope}),tone:'marimba'});localStorage.setItem(KEY,raw);}catch{}}
   else if(localStorage.getItem(OLD)==='off')raw=JSON.stringify({...defaults,on:false});}}catch{}
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
// Max volume runs through a compressor and boost so it is as loud as the speaker allows without crackling.
let out:AudioNode|null=null,boosted=false;
function dest(c:AudioContext,boost:boolean){
 if(!boost)return c.destination;
 if(!out||!boosted){const comp=c.createDynamicsCompressor();comp.threshold.value=-18;comp.knee.value=6;comp.ratio.value=8;const g=c.createGain();g.gain.value=2.4;comp.connect(g).connect(c.destination);out=comp;boosted=true;}
 return out;
}
const target:AudioNode|null=null;
function note(c:AudioContext,type:OscillatorType,from:number,to:number,at:number,len:number,peak:number){
 const t=c.currentTime+at,o=c.createOscillator(),g=c.createGain();
 o.type=type;o.frequency.setValueAtTime(from,t);if(to!==from)o.frequency.exponentialRampToValueAtTime(to,t+len*.6);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+len);
 o.connect(g).connect(target??c.destination);o.start(t);o.stop(t+len+.03);
}
const buffers=new Map<string,Promise<AudioBuffer|null>>();
function load(c:AudioContext,id:string){
 let b=buffers.get(id);
 if(!b){b=fetch(`/zarn-sounds/${id}.mp3`).then(r=>r.ok?r.arrayBuffer():Promise.reject()).then(a=>c.decodeAudioData(a)).catch(()=>null);buffers.set(id,b);}
 return b;
}
// force=true plays even if sounds are off or a sound just played (used by the settings preview).
export function playChime(force=false,override?:Partial<SoundSettings>){
 const s={...getSound(),...override};
 if(!ctx||(!s.on&&!force))return;
 const now=Date.now();if(!force&&now-last<1200)return;last=now; // a burst of messages sounds once
 if(ctx.state==='suspended')void ctx.resume();
 const c=ctx,id=tones.some(t=>t.id===s.tone)?s.tone:defaults.tone;
 void load(c,id).then(buf=>{if(!buf)return;
  const src=c.createBufferSource(),g=c.createGain();src.buffer=buf;g.gain.value=gains[s.volume]*1.6;
  src.connect(g).connect(dest(c,s.volume==='max'));
  const at=c.currentTime,len=Math.min(buf.duration,3);src.start(at);
  if(buf.duration>3){g.gain.setValueAtTime(g.gain.value,at+len-.25);g.gain.linearRampToValueAtTime(0,at+len);src.stop(at+len);}
 });
}
// Ringing for voice calls: repeats until the returned stop function is called. 'in' is the rapid double ring, 'out' the slower ringback.
export function startRing(kind:'in'|'out'){
 const burst=()=>{if(!ctx)return;if(ctx.state==='suspended')void ctx.resume();
  if(kind==='in'){note(ctx,'sine',523,523,0,.28,.3);note(ctx,'sine',659,659,.3,.28,.3);note(ctx,'sine',523,523,.9,.28,.3);note(ctx,'sine',659,659,1.2,.28,.3);}
  else{note(ctx,'sine',440,440,0,.9,.14);note(ctx,'sine',480,480,0,.9,.14);}};
 burst();const t=setInterval(burst,kind==='in'?2800:3500);
 return()=>clearInterval(t);
}
