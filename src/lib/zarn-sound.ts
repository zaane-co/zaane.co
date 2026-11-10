'use client';
import {useSyncExternalStore} from 'react';
// ZARN message sound, made with Web Audio (no file to download). Browsers only allow audio after the person has
// interacted with the page, so the context is unlocked on the first tap/click. Settings live in this browser only.
export type Tone='tap'|'chime'|'pop'|'bell'|'ding'|'ping'|'droplet'|'marimba'|'knock'|'rise'|'triple'|'alarm'|'siren';
export type Volume='low'|'medium'|'high'|'max';
export type Scope='direct'|'all';
export type SoundSettings={on:boolean;tone:Tone;volume:Volume;scope:Scope};
export const tones:{id:Tone;label:string;loud?:boolean}[]=[
 {id:'tap',label:'Tap'},{id:'chime',label:'Chime'},{id:'pop',label:'Pop'},{id:'bell',label:'Bell'},{id:'ding',label:'Ding'},{id:'ping',label:'Ping'},{id:'droplet',label:'Droplet'},
 {id:'marimba',label:'Marimba'},{id:'knock',label:'Knock'},{id:'rise',label:'Rise'},{id:'triple',label:'Triple'},{id:'alarm',label:'Alarm',loud:true},{id:'siren',label:'Siren',loud:true}];
const KEY='zarn-sound-v2',OLD='zarn-sound';
const gains:Record<Volume,number>={low:.12,medium:.32,high:.65,max:1};
const defaults:SoundSettings={on:true,tone:'tap',volume:'medium',scope:'direct'};
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
// Max volume runs through a compressor and boost so it is as loud as the speaker allows without crackling.
let out:AudioNode|null=null,boosted=false;
function dest(c:AudioContext,boost:boolean){
 if(!boost)return c.destination;
 if(!out||!boosted){const comp=c.createDynamicsCompressor();comp.threshold.value=-18;comp.knee.value=6;comp.ratio.value=8;const g=c.createGain();g.gain.value=2.4;comp.connect(g).connect(c.destination);out=comp;boosted=true;}
 return out;
}
let target:AudioNode|null=null;
function note(c:AudioContext,type:OscillatorType,from:number,to:number,at:number,len:number,peak:number){
 const t=c.currentTime+at,o=c.createOscillator(),g=c.createGain();
 o.type=type;o.frequency.setValueAtTime(from,t);if(to!==from)o.frequency.exponentialRampToValueAtTime(to,t+len*.6);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+len);
 o.connect(g).connect(target??c.destination);o.start(t);o.stop(t+len+.03);
}
// force=true plays even if sounds are off or a chime just played (used by the settings preview).
export function playChime(force=false,override?:Partial<SoundSettings>){
 const s={...getSound(),...override};
 if(!ctx||(!s.on&&!force))return;
 const now=Date.now();if(!force&&now-last<1200)return;last=now; // a burst of messages sounds once
 if(ctx.state==='suspended')void ctx.resume();
 const p=gains[s.volume],c=ctx;target=dest(c,s.volume==='max');
 const n=(type:OscillatorType,f:number,at:number,len:number,k=1,to=f)=>note(c,type,f,to,at,len,p*k);
 switch(s.tone){
  // Tap: a soft woody double knock (short wood-block hit plus a breath of filtered noise).
  case 'tap':for(const [t,f] of [[0,1180],[.085,880]] as const){n('triangle',f,t,.09,1.25,f*.72);n('sine',f*2.02,t,.05,.35);
   const at=c.currentTime+t,len=.04,buf=c.createBuffer(1,Math.floor(c.sampleRate*len),c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
   const src=c.createBufferSource(),bp=c.createBiquadFilter(),g=c.createGain();src.buffer=buf;bp.type='bandpass';bp.frequency.value=f*1.6;bp.Q.value=4;g.gain.value=p*.5;
   src.connect(bp).connect(g).connect(target??c.destination);src.start(at);}break;
  case 'pop':n('triangle',700,0,.16,1.3,300);break;
  case 'bell':n('sine',1046.5,0,.9);n('sine',2093,0,.5,.4);n('sine',1568,.12,.8,.7);break;
  case 'ding':n('sine',1318.5,0,.7);n('sine',2637,0,.3,.3);break;
  case 'ping':n('sine',1760,0,.25,1.1);break;
  case 'droplet':n('sine',600,0,.18,1.2,1400);n('sine',900,.12,.14,.6,1800);break;
  case 'marimba':n('triangle',784,0,.3,1.2);n('triangle',988,.14,.3,1.1);n('triangle',1175,.28,.4,1);break;
  case 'knock':n('square',180,0,.07,.9,120);n('square',180,.16,.07,.9,120);break;
  case 'rise':n('sine',523,0,.18);n('sine',659,.14,.18);n('sine',784,.28,.18);n('sine',1047,.42,.35);break;
  case 'triple':for(const t of [0,.18,.36])n('sine',1175,t,.14,1.1);break;
  case 'alarm':for(const t of [0,.22,.44,.66])n('square',1000,t,.16,.9);break;
  case 'siren':n('sawtooth',650,0,.55,.7,1300);n('sawtooth',1300,.55,.55,.7,650);break;
  default:n('sine',880,0,.35);n('sine',1318.5,.11,.35);
 }
 target=null;
}
// Ringing for voice calls: repeats until the returned stop function is called. 'in' is the rapid double ring, 'out' the slower ringback.
export function startRing(kind:'in'|'out'){
 const burst=()=>{if(!ctx)return;if(ctx.state==='suspended')void ctx.resume();
  if(kind==='in'){note(ctx,'sine',523,523,0,.28,.3);note(ctx,'sine',659,659,.3,.28,.3);note(ctx,'sine',523,523,.9,.28,.3);note(ctx,'sine',659,659,1.2,.28,.3);}
  else{note(ctx,'sine',440,440,0,.9,.14);note(ctx,'sine',480,480,0,.9,.14);}};
 burst();const t=setInterval(burst,kind==='in'?2800:3500);
 return()=>clearInterval(t);
}
