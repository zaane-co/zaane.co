'use client';
import {useSyncExternalStore} from 'react';
// ZARN message sound: a short two-note chime made with Web Audio (no file to download).
// Browsers only allow audio after the person has interacted with the page, so the context is unlocked on the first tap/click.
const KEY='zarn-sound';
let ctx:AudioContext|null=null;
const listeners=new Set<()=>void>();
function unlock(){
 if(ctx)return;
 try{ctx=new (window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext)();void ctx.resume();}catch{ctx=null;}
}
if(typeof window!=='undefined'){for(const ev of ['pointerdown','keydown','touchstart'])window.addEventListener(ev,unlock,{once:false,passive:true});}
export function soundOn(){try{return localStorage.getItem(KEY)!=='off';}catch{return true;}}
export function setSound(on:boolean){try{localStorage.setItem(KEY,on?'on':'off');}catch{}listeners.forEach(fn=>fn());if(on)playChime();}
export function useSound(){return useSyncExternalStore(cb=>{listeners.add(cb);return()=>{listeners.delete(cb);};},soundOn,()=>true);}
let last=0;
export function playChime(){
 if(!ctx||!soundOn())return;
 const now=Date.now();if(now-last<1200)return;last=now; // a burst of messages chimes once
 if(ctx.state==='suspended')void ctx.resume();
 const t=ctx.currentTime;
 for(const [freq,at] of [[880,0],[1318.5,.11]] as const){
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type='sine';o.frequency.value=freq;
  g.gain.setValueAtTime(0,t+at);g.gain.linearRampToValueAtTime(.18,t+at+.015);g.gain.exponentialRampToValueAtTime(.0001,t+at+.32);
  o.connect(g).connect(ctx.destination);o.start(t+at);o.stop(t+at+.35);
 }
}
