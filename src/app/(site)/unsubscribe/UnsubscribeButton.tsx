'use client';
import {useState} from 'react';
export default function UnsubscribeButton({token}:{token:string}){
 const [state,setState]=useState<'idle'|'busy'|'done'|'error'>('idle');
 async function go(){
  setState('busy');
  try{const r=await fetch(`/api/unsubscribe?t=${token}`,{method:'POST'});setState(r.ok?'done':'error');}catch{setState('error');}
 }
 if(state==='done')return <p style={{marginTop:24}}>Done. You won’t get any more newsletter emails from us.</p>;
 return <div style={{marginTop:24}}><button type="button" className="studio-button" disabled={state==='busy'} onClick={()=>void go()}>{state==='busy'?'Unsubscribing…':'Unsubscribe me'}</button>{state==='error'&&<p className="form-feedback" role="alert">Something went wrong. Please try again.</p>}</div>;
}
