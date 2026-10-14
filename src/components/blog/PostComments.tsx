'use client';
import {useEffect,useState} from 'react';
type Comment={id:string;author_name:string;content:string;admin_reply:string|null;replied_at:string|null;created_at:string};
const fmt=(d:string)=>new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const field='w-full rounded-lg border border-[#dedbd4] bg-white px-3.5 py-3 text-sm text-[#171717] placeholder:text-[#a3a09a] focus:outline-none focus:border-[#141414]';
export default function PostComments({postId}:{postId:string}){
 const [comments,setComments]=useState<Comment[]>([]);
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[content,setContent]=useState(''),[website,setWebsite]=useState('');
 const [submitting,setSubmitting]=useState(false),[submitted,setSubmitted]=useState(false),[error,setError]=useState('');
 useEffect(()=>{fetch(`/api/blog/comments?post_id=${postId}`).then(r=>r.json()).then(d=>setComments(Array.isArray(d)?d:[])).catch(()=>{});},[postId]);
 async function handleSubmit(e:React.FormEvent){
  e.preventDefault();if(!name.trim()||!content.trim())return;
  setSubmitting(true);setError('');
  const r=await fetch('/api/blog/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({post_id:postId,author_name:name,author_email:email,content,website})}).catch(()=>null);
  if(r?.ok){setSubmitted(true);setName('');setEmail('');setContent('');}
  else setError((await r?.json().catch(()=>null))?.error??'Could not post your comment.');
  setSubmitting(false);
 }
 return <section className="mt-14 pt-10 border-t border-[#e6e4e0]" aria-labelledby="comments-title">
  <h2 id="comments-title" className="!text-[28px] !m-0 !mb-8 tracking-[-0.04em] font-medium text-[#141414]">{comments.length>0?`${comments.length} Comment${comments.length!==1?'s':''}`:'Comments'}</h2>
  {comments.length>0&&<div className="space-y-7 mb-12">
   {comments.map(c=><div key={c.id} className="flex gap-4">
    <div className="h-10 w-10 rounded-full bg-[#141414] text-white flex items-center justify-center text-sm font-semibold shrink-0 uppercase">{c.author_name[0]}</div>
    <div className="flex-1 min-w-0">
     <div className="flex items-center gap-2 mb-1"><p className="!text-sm font-semibold !text-[#141414] !m-0">{c.author_name}</p><p className="!text-xs !text-[#8a877f] !m-0">{fmt(c.created_at)}</p></div>
     <p className="!text-[15px] !leading-relaxed !text-[#444] whitespace-pre-wrap !m-0">{c.content}</p>
     {c.admin_reply&&<div className="mt-3 ml-4 pl-4 border-l-2 border-[var(--accent)] bg-[#f4f3ef] rounded-r-lg py-3 pr-4">
      <p className="!text-xs font-semibold !text-[var(--accent)] !mb-1">Zaane{c.replied_at?` · ${fmt(c.replied_at)}`:''}</p>
      <p className="!text-sm !leading-relaxed !text-[#444] whitespace-pre-wrap !m-0">{c.admin_reply}</p>
     </div>}
    </div>
   </div>)}
  </div>}
  <div className="bg-[#f4f3ef] rounded-2xl p-6 sm:p-8">
   <h3 className="!text-lg font-semibold !text-[#141414] !mb-5 !mt-0">Leave a Comment</h3>
   {submitted?<div className="!text-sm text-white bg-[#16a34a] rounded-xl px-4 py-3">Thanks for your comment! It will appear after review.</div>:
   <form onSubmit={handleSubmit} className="space-y-4">
    <label className="honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
     <label className="block"><span className="block text-xs font-medium text-[#6f6d68] mb-1.5">Name *</span><input value={name} onChange={e=>setName(e.target.value)} required maxLength={80} placeholder="Your name" className={field}/></label>
     <label className="block"><span className="block text-xs font-medium text-[#6f6d68] mb-1.5">Email <span className="text-[#a3a09a]">(optional, not published)</span></span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" className={field}/></label>
    </div>
    <label className="block"><span className="block text-xs font-medium text-[#6f6d68] mb-1.5">Comment *</span><textarea value={content} onChange={e=>setContent(e.target.value)} required maxLength={3000} rows={4} placeholder="Share your thoughts…" className={`${field} resize-none`}/></label>
    {error&&<p className="!text-xs !text-[#af0a2f]">{error}</p>}
    <button type="submit" disabled={submitting} className="rounded-full bg-[#141414] hover:bg-[var(--accent)] text-white text-sm font-medium px-6 py-3 transition-colors">{submitting?'Submitting…':'Post Comment'}</button>
   </form>}
  </div>
 </section>;
}
