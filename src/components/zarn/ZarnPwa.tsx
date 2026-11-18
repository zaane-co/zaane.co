'use client';
import {useEffect,useSyncExternalStore} from 'react';
import {useRouter} from 'next/navigation';
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
const isAndroid=()=>typeof navigator!=='undefined'&&/android/i.test(navigator.userAgent);
// Links opened inside WhatsApp, Instagram, Facebook and similar apps use a stripped-down browser that cannot install apps.
export const inAppBrowser=()=>typeof navigator!=='undefined'&&/FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|MicroMessenger|; wv\)|GSA\//i.test(navigator.userAgent);
// 'prompt' = the browser can install it in one tap; 'ios' = show Add to Home Screen steps; 'android' = installable, but the browser hasn't offered the one-tap prompt (use its menu); null = already installed or unsupported.
export function useInstall(){
 const mode=useSyncExternalStore(cb=>{listeners.add(cb);return()=>{listeners.delete(cb);};},()=>standalone()?null:deferred?'prompt':isIos()?'ios':isAndroid()?'android':null,()=>null);
 const install=async()=>{if(!deferred)return false;await deferred.prompt();const {outcome}=await deferred.userChoice;deferred=null;notify();return outcome==='accepted';};
 return {mode,install};
}
export default function ZarnPwa(){
 const router=useRouter();
 // Keep the app exactly as tall as the visible area, so when the phone keyboard opens the message bar sits right on top of it
 // (like a native app) instead of the whole page sliding up and leaving a gap.
 useEffect(()=>{
  const vv=window.visualViewport;if(!vv)return;
  const root=document.documentElement;
  // Follow the keyboard once per frame, and never scroll the page back ourselves: fighting iOS's own pan made the screen bounce.
  let raf=0,h=-1,t=-1;
  const apply=()=>{raf=0;
   const nh=Math.round(vv.height),nt=Math.round(vv.offsetTop);
   if(nh!==h){h=nh;root.style.setProperty('--zvh',`${nh}px`);root.toggleAttribute('data-kb',window.innerHeight-nh>120);}
   if(nt!==t){t=nt;root.style.setProperty('--zvt',`${nt}px`);}
  };
  const set=()=>{if(!raf)raf=requestAnimationFrame(apply);};
  apply();vv.addEventListener('resize',set);vv.addEventListener('scroll',set);
  return()=>{cancelAnimationFrame(raf);vv.removeEventListener('resize',set);vv.removeEventListener('scroll',set);['--zvh','--zvt'].forEach(k=>root.style.removeProperty(k));root.removeAttribute('data-kb');};
 },[]);
 // Tapping a notification goes to that exact conversation: a message from the service worker (app already open) or a saved target (app was closed).
 useEffect(()=>{
  const clear=()=>{void caches?.open('zarn-nav').then(c=>c.delete('/__nav')).catch(()=>{});};
  const go=(url:string)=>{if(typeof url==='string'&&url.startsWith('/zarn'))router.push(url);clear();};
  const onMsg=(e:MessageEvent)=>{if(e.data?.type==='zarn-open')go(e.data.url);};
  navigator.serviceWorker?.addEventListener('message',onMsg);
  void (async()=>{try{const c=await caches.open('zarn-nav');const r=await c.match('/__nav');if(!r)return;const d=await r.json();if(Date.now()-d.at<2*60*1000)go(d.url);else clear();}catch{}})();
  return()=>navigator.serviceWorker?.removeEventListener('message',onMsg);
 },[router]);
 useEffect(()=>{if('serviceWorker' in navigator&&process.env.NODE_ENV==='production')void navigator.serviceWorker.register('/zarn-sw.js',{scope:'/zarn'}).catch(()=>{});},[]);
 return null;
}
