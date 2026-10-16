'use client';
import {useRef,useState} from 'react';
import {Check,Copy,Download,Eye,EyeOff,ExternalLink,KeyRound,FileText,Terminal,Braces} from 'lucide-react';
export type SharedItem={id:string;kind:'login'|'api'|'env'|'file';label:string;url:string;username:string;note:string;hasSecret:boolean;fileName:string;fileSize:number};
const icon=(k:SharedItem['kind'])=>k==='file'?<FileText size={16}/>:k==='env'?<Terminal size={16}/>:k==='api'?<Braces size={16}/>:<KeyRound size={16}/>;
// The items a client was given. Secrets stay hidden until the client reveals or copies them; each reveal is logged.
export default function VaultShareView({token,items}:{token:string;items:SharedItem[]}){
 const [shown,setShown]=useState<Record<string,string>>({}),[copied,setCopied]=useState(''),[err,setErr]=useState('');
 const timers=useRef<Record<string,ReturnType<typeof setTimeout>>>({});
 async function fetchSecret(id:string){
  const r=await fetch('/api/vault/reveal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,item_id:id})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Could not show it.');return d.secret as string;
 }
 async function reveal(id:string){
  if(shown[id]!==undefined){setShown(s=>{const n={...s};delete n[id];return n;});return;}
  try{const secret=await fetchSecret(id);setShown(s=>({...s,[id]:secret}));clearTimeout(timers.current[id]);timers.current[id]=setTimeout(()=>setShown(s=>{const n={...s};delete n[id];return n;}),30000);}
  catch(e){setErr(e instanceof Error?e.message:'Could not show it.');}
 }
 async function copy(id:string,text?:string){
  try{await navigator.clipboard.writeText(text??await fetchSecret(id));setCopied(id);setTimeout(()=>setCopied(''),1500);}catch(e){setErr(e instanceof Error?e.message:'Could not copy.');}
 }
 return <div className="vs-list">
  {err&&<p className="vs-err" role="alert">{err}</p>}
  {items.map(i=><section key={i.id} className="vs-item">
   <h2>{icon(i.kind)}{i.label}{i.url&&<a href={/^https?:\/\//i.test(i.url)?i.url:`https://${i.url}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/>{i.url.replace(/^https?:\/\//i,'')}</a>}</h2>
   {i.kind==='file'?<div className="vs-row"><span>{i.fileName}</span><a className="vs-btn" href={`/api/vault/file?t=${encodeURIComponent(token)}&id=${i.id}`}><Download size={14}/>Download</a></div>:<>
    {i.username&&<div className="vs-row"><small>{i.kind==='api'?'Name':'Username'}</small><span>{i.username}</span><button type="button" aria-label="Copy" onClick={()=>void copy(i.id+':u',i.username)}>{copied===i.id+':u'?<Check size={14}/>:<Copy size={14}/>}</button></div>}
    {i.hasSecret&&<div className={`vs-row${i.kind==='env'?' is-env':''}`}><small>{i.kind==='api'?'Key':i.kind==='env'?'Settings':'Password'}</small>
     {i.kind==='env'&&shown[i.id]!==undefined?<pre>{shown[i.id]}</pre>:<span className="vs-secret">{shown[i.id]!==undefined?shown[i.id]:'••••••••••••'}</span>}
     <button type="button" aria-label={shown[i.id]!==undefined?'Hide':'Reveal'} onClick={()=>void reveal(i.id)}>{shown[i.id]!==undefined?<EyeOff size={14}/>:<Eye size={14}/>}</button>
     <button type="button" aria-label="Copy" onClick={()=>void copy(i.id)}>{copied===i.id?<Check size={14}/>:<Copy size={14}/>}</button></div>}
   </>}
   {i.note&&<p className="vs-note">{i.note}</p>}
  </section>)}
 </div>;
}
