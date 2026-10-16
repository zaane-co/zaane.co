'use client';
import {useSyncExternalStore} from 'react';
// Registers this browser/phone for web push and remembers whether it worked, so the menu can say why when it doesn't.
export type PushState={state:'unknown'|'on'|'off'|'error';reason:string};
let current:PushState={state:'unknown',reason:''};
const listeners=new Set<()=>void>();
const set=(s:PushState)=>{current=s;listeners.forEach(fn=>fn());};
export const usePushState=()=>useSyncExternalStore(cb=>{listeners.add(cb);return()=>{listeners.delete(cb);};},()=>current,()=>({state:'unknown',reason:''} as PushState));
const b64=(k:string)=>{const p='='.repeat((4-k.length%4)%4),r=atob((k+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...r].map(c=>c.charCodeAt(0)));};
const fail=(reason:string)=>{console.warn('[zarn push]',reason);set({state:'error',reason});return false;};
export async function subscribePush(){
 try{
  const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window))return fail('This browser can’t receive push. On iPhone, add ZARN to the Home Screen first.');
  if(Notification.permission==='denied')return fail('Notifications are blocked. Allow them for zaane.co in your browser or phone settings.');
  if(Notification.permission!=='granted'){set({state:'off',reason:''});return false;}
  if(!key)return fail('This version of the app has no push key. A redeploy with the VAPID keys is needed.');
  const reg=await navigator.serviceWorker.getRegistration('/zarn');
  if(!reg)return fail('The app isn’t fully installed yet. Reload ZARN and try again.');
  const sub=(await reg.pushManager.getSubscription())??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(key)});
  const r=await fetch('/api/zarn/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON()})});
  if(!r.ok)return fail('Could not save this device ('+r.status+').');
  set({state:'on',reason:''});return true;
 }catch(e){return fail(e instanceof Error?e.message:'Could not turn on notifications.');}
}
