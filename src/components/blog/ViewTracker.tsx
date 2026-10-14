'use client';
import {useEffect} from 'react';
// Records one view per page load, then sends read time as a beacon when the reader leaves.
export default function ViewTracker({postId}:{postId:string}){
 useEffect(()=>{
  const start=Date.now();let viewId:string|null=null,sent=false;
  fetch('/api/blog/views',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({post_id:postId})}).then(r=>r.json()).then(d=>{viewId=d.id??null;}).catch(()=>{});
  const send=()=>{
   const secs=Math.round((Date.now()-start)/1000);if(sent||!viewId||secs<3)return;sent=true;
   navigator.sendBeacon('/api/blog/views',new Blob([JSON.stringify({post_id:postId,view_id:viewId,read_duration_seconds:secs})],{type:'application/json'}));
  };
  const onHide=()=>{if(document.visibilityState==='hidden')send();};
  window.addEventListener('pagehide',send);document.addEventListener('visibilitychange',onHide);
  return()=>{send();window.removeEventListener('pagehide',send);document.removeEventListener('visibilitychange',onHide);};
 },[postId]);
 return null;
}
