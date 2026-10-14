'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Trash2} from 'lucide-react';
import {t,fmt,blogApi} from './shared';

export type AdminComment={id:string;post_id:string;author_name:string;author_email:string|null;content:string;approved:boolean;admin_reply:string|null;replied_at:string|null;created_at:string;blog_posts:{title:string;slug:string}|null};

export default function AdminComments({initialComments,canModerate}:{initialComments:AdminComment[];canModerate:boolean}){
 const [comments,setComments]=useState(initialComments);
 const [filter,setFilter]=useState<'all'|'pending'|'approved'>('all');
 const [replyingId,setReplyingId]=useState<string|null>(null);
 const [replyText,setReplyText]=useState('');
 const [saving,setSaving]=useState<string|null>(null);
 const [error,setError]=useState('');
 const pending=comments.filter(c=>!c.approved).length;
 const displayed=comments.filter(c=>filter==='all'?true:filter==='pending'?!c.approved:c.approved);

 async function run<T>(id:string,body:object,apply:(d:T)=>void){
  setSaving(id);setError('');
  try{apply(await blogApi<T>({...body,id}));}catch(e){setError(e instanceof Error?e.message:'Something went wrong.');}
  setSaving(null);
 }
 const approve=(id:string,approved:boolean)=>run(id,{action:'comment_approve',approved},()=>setComments(p=>p.map(c=>c.id===id?{...c,approved}:c)));
 const submitReply=(id:string,reply:string)=>run<{admin_reply:string|null;replied_at:string|null}>(id,{action:'comment_reply',reply},d=>{setComments(p=>p.map(c=>c.id===id?{...c,admin_reply:d.admin_reply,replied_at:d.replied_at}:c));setReplyingId(null);setReplyText('');});
 const remove=(id:string)=>run(id,{action:'comment_delete'},()=>setComments(p=>p.filter(c=>c.id!==id)));
 const pill='text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50';

 return <div className="space-y-6">
  <div><h1 className={`text-xl font-bold ${t.heading}`}>Comments</h1><p className={`text-sm mt-0.5 ${t.sub}`}>{comments.length} total · {pending} pending review</p></div>
  <div className="flex gap-1.5">
   {(['all','pending','approved'] as const).map(f=><button key={f} onClick={()=>setFilter(f)} className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${filter===f?'bg-[var(--a-fg)] text-[var(--a-bg)]':`${t.sub} hover:text-[var(--a-fg)] hover:bg-[var(--a-hover)]`}`}>
    {f}{f==='pending'&&pending>0&&<span className="ml-1.5 rounded-full bg-[#f59e0b] text-[#1a1200] px-1.5 text-[10px] font-bold">{pending}</span>}
   </button>)}
  </div>
  {error&&<div className="rounded-lg bg-[#dc2626] px-4 py-3 text-xs text-white">{error}</div>}
  {displayed.length===0?<div className={`rounded-2xl border py-16 text-center text-sm ${t.card} ${t.sub}`}>No {filter==='all'?'':filter+' '}comments yet.</div>:
  <div className="space-y-3">
   {displayed.map(c=><div key={c.id} className={`rounded-2xl border overflow-hidden ${t.card}`}>
    <div className={`flex flex-wrap items-start justify-between gap-3 px-5 py-3.5 border-b ${t.divider}`}>
     <div className="flex items-start gap-3 min-w-0">
      <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold uppercase shrink-0 bg-[var(--a-fg)] text-[var(--a-bg)]">{c.author_name[0]}</div>
      <div className="min-w-0">
       <div className="flex items-center gap-2 flex-wrap">
        <p className={`text-sm font-semibold ${t.heading}`}>{c.author_name}</p>
        {c.author_email&&<a href={`mailto:${c.author_email}`} className={`text-xs hover:underline ${t.sub}`}>{c.author_email}</a>}
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.approved?'bg-[#16a34a] text-white':'bg-[#f59e0b] text-[#1a1200]'}`}>{c.approved?'Approved':'Pending'}</span>
       </div>
       <div className="flex items-center gap-2 mt-0.5 flex-wrap">
        <p className={`text-xs ${t.sub}`}>{fmt(c.created_at)}</p>
        {c.blog_posts&&<><span className={`text-xs ${t.sub}`}>·</span><Link href={`/blog/${c.blog_posts.slug}`} target="_blank" className={`text-xs hover:underline ${t.faint} hover:text-[var(--a-fg)]`}>{c.blog_posts.title}</Link></>}
       </div>
      </div>
     </div>
     {canModerate&&<div className="flex items-center gap-1.5 shrink-0">
      {!c.approved?<button onClick={()=>approve(c.id,true)} disabled={saving===c.id} className={`${pill} bg-[#16a34a] text-white hover:bg-[#15803d]`}>{saving===c.id?'…':'Approve'}</button>
      :<button onClick={()=>approve(c.id,false)} disabled={saving===c.id} className={`${pill} bg-[var(--a-panel-2)] ${t.sub} hover:text-[var(--a-fg)]`}>Unapprove</button>}
      <button onClick={()=>{setReplyingId(replyingId===c.id?null:c.id);setReplyText(c.admin_reply??'');}} className={`${pill} bg-[#2563eb] text-white hover:bg-[#1d4ed8]`}>{c.admin_reply?'Edit reply':'Reply'}</button>
      <button onClick={()=>remove(c.id)} disabled={saving===c.id} aria-label="Delete comment" className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${t.faint} hover:text-white hover:bg-[#dc2626]`}><Trash2 className="h-3.5 w-3.5"/></button>
     </div>}
    </div>
    <div className="px-5 py-4 space-y-3">
     <p className={`text-sm leading-relaxed whitespace-pre-wrap ${t.heading}`}>{c.content}</p>
     {c.admin_reply&&replyingId!==c.id&&<div className="ml-4 pl-4 border-l-2 border-[var(--accent)] rounded-r-lg py-2.5 pr-3 bg-[var(--a-panel-2)]">
      <p className="text-xs font-semibold mb-1 text-[var(--accent)]">Your reply{c.replied_at?` · ${fmt(c.replied_at)}`:''}</p>
      <p className={`text-sm whitespace-pre-wrap ${t.sub}`}>{c.admin_reply}</p>
     </div>}
     {replyingId===c.id&&<div className="space-y-2">
      <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} rows={3} maxLength={3000} placeholder="Write your reply…" autoFocus className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none transition-colors resize-none ${t.input}`}/>
      <div className="flex flex-wrap gap-2">
       <button onClick={()=>submitReply(c.id,replyText)} disabled={saving===c.id||!replyText.trim()} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${t.brandBtn}`}>{saving===c.id?'Saving…':'Post Reply'}</button>
       {c.admin_reply&&<button onClick={()=>submitReply(c.id,'')} disabled={saving===c.id} className={`px-4 py-2 rounded-xl text-xs font-medium border transition-colors disabled:opacity-50 ${t.ghostBtn}`}>Remove Reply</button>}
       <button onClick={()=>{setReplyingId(null);setReplyText('');}} className={`px-4 py-2 rounded-xl text-xs font-medium border transition-colors ${t.ghostBtn}`}>Cancel</button>
      </div>
     </div>}
    </div>
   </div>)}
  </div>}
 </div>;
}
