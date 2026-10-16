'use client';
import {useEffect,useState} from 'react';
import {Download,X} from 'lucide-react';
import {inAppBrowser,useInstall} from './ZarnPwa';
const KEY='zarn-install-snooze';
// Offered when ZARN is opened in a browser: one tap installs it on Android; elsewhere it explains how.
export default function InstallPrompt({onDone,onHelp}:{onDone:()=>void;onHelp:()=>void}){
 const {mode,install}=useInstall();
 const [show,setShow]=useState(false);
 useEffect(()=>{
  let until=0;try{until=Number(localStorage.getItem(KEY))||0;}catch{}
  if(!mode||Date.now()<until){onDone();return;}
  const t=setTimeout(()=>setShow(true),1200);
  return()=>clearTimeout(t);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[!!mode]);
 if(!show||!mode)return null;
 const close=(days=7)=>{try{localStorage.setItem(KEY,String(Date.now()+days*86400_000));}catch{}setShow(false);onDone();};
 const inApp=inAppBrowser();
 return <div className="zn-prompt" role="dialog" aria-label="Install ZARN">
  <span className="zn-prompt-ico"><Download size={18}/></span>
  <div className="zn-prompt-text"><b>Install ZARN</b><small>{inApp?'Open this page in Chrome or Safari to install it. Apps like WhatsApp can’t install it.':'Add ZARN to your home screen for a full-screen app that opens straight away and can send you notifications.'}</small></div>
  <div className="zn-prompt-actions">
   <button type="button" className="zn-btn is-primary" onClick={async()=>{if(mode==='prompt'&&!inApp){const ok=await install();if(ok)close(365);else close();}else{close(1);onHelp();}}}>{mode==='prompt'&&!inApp?'Install':'Show me how'}</button>
   <button type="button" className="zn-btn" onClick={()=>close()}>Not now</button>
  </div>
  <button type="button" className="zn-prompt-x" aria-label="Dismiss" onClick={()=>close()}><X size={16}/></button>
 </div>;
}
