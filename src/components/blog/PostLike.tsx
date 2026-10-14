'use client';
import {useEffect,useRef,useState} from 'react';
import {Heart} from 'lucide-react';
function getFingerprint(){
 const key='zaane_fp';
 try{let fp=localStorage.getItem(key);if(!fp){fp=crypto.randomUUID();localStorage.setItem(key,fp);}return fp;}catch{return crypto.randomUUID();}
}
export default function PostLike({postId}:{postId:string}){
 const [liked,setLiked]=useState(false),[count,setCount]=useState(0),[loading,setLoading]=useState(false);
 const fp=useRef('');
 useEffect(()=>{
  fp.current=getFingerprint();
  fetch(`/api/blog/likes?post_id=${postId}&fingerprint=${fp.current}`).then(r=>r.json()).then(d=>{setLiked(!!d.liked);setCount(d.count??0);}).catch(()=>{});
 },[postId]);
 async function toggle(){
  if(loading)return;setLoading(true);
  const prev={liked,count};setLiked(!liked);setCount(c=>liked?c-1:c+1);
  try{const r=await fetch('/api/blog/likes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({post_id:postId,fingerprint:fp.current})});const d=await r.json();setLiked(!!d.liked);setCount(d.count??0);}
  catch{setLiked(prev.liked);setCount(prev.count);}
  setLoading(false);
 }
 return <button onClick={toggle} disabled={loading} aria-pressed={liked} className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors !cursor-pointer disabled:!opacity-100 ${liked?'bg-[var(--accent)] border-[var(--accent)] text-white':'bg-white border-[#dedbd4] text-[#555] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}>
  <Heart className={`h-4 w-4 transition-transform ${liked?'scale-110':''}`} fill={liked?'currentColor':'none'}/>{count>0?count:''} {liked?'Liked':'Like'}
 </button>;
}
