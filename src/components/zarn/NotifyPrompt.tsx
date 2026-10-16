'use client';
import {useEffect,useState} from 'react';
import {Bell,X} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {usePushState} from '@/lib/zarn-push-client';
const KEY='zarn-notify-prompt';
// Shown once when someone opens ZARN without notifications: messages and calls only reach a phone that has them on.
export default function NotifyPrompt({installMode,onInstall}:{installMode:string|null;onInstall:()=>void}){
 const z=useZarn(),push=usePushState();
 const [show,setShow]=useState(false);
 useEffect(()=>{
  let done=false;try{done=!!localStorage.getItem(KEY);}catch{}
  if(done)return;
  const supported='Notification' in window;
  // iPhone only has notifications inside the installed app, so a browser tab is asked to install first.
  const need=supported?Notification.permission==='default':installMode==='ios';
  if(!need)return;
  const t=setTimeout(()=>setShow(true),2500);
  return()=>clearTimeout(t);
 },[installMode]);
 if(!show||push.state==='on')return null;
 const close=()=>{try{localStorage.setItem(KEY,'1');}catch{}setShow(false);};
 const supported=typeof Notification!=='undefined';
 return <div className="zn-prompt" role="dialog" aria-label="Turn on notifications">
  <span className="zn-prompt-ico"><Bell size={18}/></span>
  <div className="zn-prompt-text"><b>{supported?'Never miss a message or call':'Add ZARN to your Home Screen'}</b><small>{supported?'Turn on notifications so messages and calls reach you even when ZARN is closed.':'On iPhone, notifications work from the installed app. Add it first, then turn them on.'}</small></div>
  <div className="zn-prompt-actions">
   <button type="button" className="zn-btn is-primary" onClick={()=>{close();if(supported)z.enableNotify();else onInstall();}}>{supported?'Turn on':'Show me how'}</button>
   <button type="button" className="zn-btn" onClick={close}>Not now</button>
  </div>
  <button type="button" className="zn-prompt-x" aria-label="Dismiss" onClick={close}><X size={16}/></button>
 </div>;
}
