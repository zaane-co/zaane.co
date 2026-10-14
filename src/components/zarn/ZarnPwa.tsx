'use client';
import {useEffect,useSyncExternalStore} from 'react';
// Registers the ZARN service worker (installable app + offline screen). Scoped to /zarn so the public site is unaffected.
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
let deferred:InstallEvent|null=null;
const listeners=new Set<()=>void>();
const notify=()=>listeners.forEach(fn=>fn());
if(typeof window!=='undefined'){
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e as InstallEvent;notify();});
 window.addEventListener('appinstalled',()=>{deferred=null;notify();});
}
const standalone=()=>typeof window!=='undefined'&&(window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
const isIos=()=>typeof navigator!=='undefined'&&/iphone|ipad|ipod/i.test(navigator.userAgent);
// 'prompt' = the browser can install it in one tap; 'ios' = show Add to Home Screen steps; null = already installed or unsupported.
export function useInstall(){
 const mode=useSyncExternalStore(cb=>{listeners.add(cb);return()=>{listeners.delete(cb);};},()=>standalone()?null:deferred?'prompt':isIos()?'ios':null,()=>null);
 const install=async()=>{if(!deferred)return false;await deferred.prompt();const {outcome}=await deferred.userChoice;deferred=null;notify();return outcome==='accepted';};
 return {mode,install};
}
export default function ZarnPwa(){
 useEffect(()=>{if('serviceWorker' in navigator&&process.env.NODE_ENV==='production')void navigator.serviceWorker.register('/zarn-sw.js',{scope:'/zarn'}).catch(()=>{});},[]);
 return null;
}
