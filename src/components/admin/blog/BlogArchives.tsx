'use client';
import Link from 'next/link';
import {useState} from 'react';
import {ExternalLink,Pencil,Search} from 'lucide-react';
import {t,getStatus,STATUS_STYLE,fmt,type Post} from './shared';

export default function BlogArchives({posts}:{posts:Post[]}){
 const [search,setSearch]=useState('');
 const filtered=posts.filter(p=>!search||p.title.toLowerCase().includes(search.toLowerCase()));
 const grouped:Record<string,Post[]>={};
 filtered.forEach(p=>{const key=new Date(p.published_at??p.created_at).toLocaleDateString('en-GB',{month:'long',year:'numeric'});(grouped[key]??=[]).push(p);});
 const stats=[{label:'Total Posts',value:posts.length},{label:'Published',value:posts.filter(p=>getStatus(p)==='published').length},{label:'Drafts',value:posts.filter(p=>getStatus(p)==='draft').length}];

 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-4">
   <div><h1 className={`text-xl font-bold ${t.heading}`}>Archives</h1><p className={`text-sm mt-0.5 ${t.sub}`}>{posts.length} posts total</p></div>
   <div className="relative w-52">
    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${t.sub}`}/>
    <input type="text" placeholder="Search archives…" value={search} onChange={e=>setSearch(e.target.value)} className={`w-full rounded-lg border pl-9 pr-3 py-2 text-xs focus:outline-none transition-colors ${t.input}`}/>
   </div>
  </div>
  <div className="grid grid-cols-3 gap-3">
   {stats.map(s=><div key={s.label} className={`rounded-xl border p-4 ${t.card}`}><p className={`text-xs font-medium ${t.sub}`}>{s.label}</p><p className={`text-2xl font-bold mt-1 ${t.heading}`}>{s.value}</p></div>)}
  </div>
  {Object.keys(grouped).length===0?<div className={`rounded-xl border py-16 text-center text-sm ${t.card} ${t.sub}`}>No posts found.</div>:
  Object.entries(grouped).map(([month,monthPosts])=><div key={month}>
   <div className="flex items-center gap-3 mb-2">
    <p className={`text-xs font-semibold uppercase tracking-widest ${t.faint}`}>{month}</p><div className="flex-1 h-px bg-[var(--a-border)]"/><p className={`text-xs ${t.faint}`}>{monthPosts.length} post{monthPosts.length!==1?'s':''}</p>
   </div>
   <div className={`rounded-xl border overflow-hidden ${t.card}`}>
    {monthPosts.map((p,i)=>{const st=getStatus(p);return <div key={p.id} className={`flex items-center justify-between px-5 py-4 transition-colors hover:bg-[var(--a-hover)] ${i>0?`border-t ${t.divider}`:''}`}>
     <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2"><p className={`font-medium text-sm truncate ${t.heading}`}>{p.title}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[st].cls}`}>{STATUS_STYLE[st].label}</span></div>
      {p.excerpt&&<p className={`text-xs mt-0.5 truncate ${t.faint}`}>{p.excerpt}</p>}
      <p className={`text-xs mt-0.5 ${t.faint}`}>{fmt(p.published_at??p.created_at)}</p>
     </div>
     <div className="flex items-center gap-1 ml-4 shrink-0">
      {st==='published'&&<Link href={`/blog/${p.slug}`} target="_blank" title="View post" className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${t.iconBtn}`}><ExternalLink className="h-3.5 w-3.5"/></Link>}
      <Link href={`/admin/blog/${p.id}`} title="Edit post" className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${t.iconBtn}`}><Pencil className="h-3.5 w-3.5"/></Link>
     </div>
    </div>;})}
   </div>
  </div>)}
 </div>;
}
