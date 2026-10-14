'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowUpDown,ChevronDown,ChevronUp,Clock,Eye,Heart,MessageCircle} from 'lucide-react';
import {t,getStatus,STATUS_STYLE,fmt} from './shared';

export type MetricPost={id:string;title:string;slug:string;status:string;published_at:string|null;cover_image:string|null;views:number;likes:number;comments:number;pending_comments:number;avg_read_secs:number|null};
type SortKey='views'|'likes'|'comments'|'avg_read_secs'|'published_at';
const fmtDuration=(s:number|null)=>!s?'—':s<60?`${s}s`:`${Math.floor(s/60)}m ${s%60}s`;
const cols={gridTemplateColumns:'minmax(0,1fr) 80px 70px 70px 80px 100px'};

export default function PostMetrics({posts}:{posts:MetricPost[]}){
 const [sort,setSort]=useState<SortKey>('views'),[dir,setDir]=useState<'desc'|'asc'>('desc');
 const toggleSort=(k:SortKey)=>{if(sort===k)setDir(d=>d==='desc'?'asc':'desc');else{setSort(k);setDir('desc');}};
 const sorted=useMemo(()=>[...posts].sort((a,b)=>{const av=a[sort]??-1,bv=b[sort]??-1;return dir==='desc'?(bv>av?1:-1):(av>bv?1:-1);}),[posts,sort,dir]);
 const sum=(k:'views'|'likes'|'comments'|'pending_comments')=>posts.reduce((s,p)=>s+p[k],0);
 const timed=posts.filter(p=>p.avg_read_secs);
 const avgRead=timed.length?Math.round(timed.reduce((s,p)=>s+(p.avg_read_secs??0),0)/timed.length):null;
 const pending=sum('pending_comments');
 const stats=[
  {label:'Total Views',value:sum('views').toLocaleString(),Icon:Eye,bg:'#2563eb'},
  {label:'Total Likes',value:sum('likes').toLocaleString(),Icon:Heart,bg:'#f10c45'},
  {label:'Comments',value:sum('comments').toLocaleString(),Icon:MessageCircle,bg:'#16a34a'},
  {label:'Avg. Read Time',value:fmtDuration(avgRead),Icon:Clock,bg:'#7c3aed'},
 ];
 const SortIcon=({k}:{k:SortKey})=>sort!==k?<ArrowUpDown className="h-3 w-3 ml-1 opacity-40"/>:dir==='desc'?<ChevronDown className="h-3 w-3 ml-1" strokeWidth={2.5}/>:<ChevronUp className="h-3 w-3 ml-1" strokeWidth={2.5}/>;

 return <div className="space-y-6">
  <div><h1 className={`text-xl font-bold ${t.heading}`}>Post Metrics</h1><p className={`text-sm mt-0.5 ${t.sub}`}>{posts.length} posts · performance overview</p></div>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
   {stats.map(s=><div key={s.label} className={`rounded-2xl border p-4 ${t.card}`}>
    <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-3 text-white" style={{background:s.bg}}><s.Icon className="h-4 w-4" strokeWidth={1.8}/></div>
    <p className={`text-2xl font-bold ${t.heading}`}>{s.value}</p><p className={`text-xs mt-0.5 ${t.sub}`}>{s.label}</p>
   </div>)}
  </div>
  {pending>0&&<div className="flex items-center justify-between rounded-xl px-4 py-3 bg-[#f59e0b] text-[#1a1200]">
   <p className="text-sm font-medium">{pending} comment{pending!==1?'s':''} awaiting review</p>
   <Link href="/admin/blog/comments" className="text-xs font-semibold underline">Review now →</Link>
  </div>}
  <div className={`rounded-2xl border overflow-x-auto ${t.card}`}>
   <div className="min-w-[640px]">
    <div className={`grid text-[11px] uppercase tracking-wide font-semibold px-5 py-3 border-b ${t.tHead}`} style={cols}>
     <div>Post</div>
     {([['views','Views'],['likes','Likes'],['comments','Cmts'],['avg_read_secs','Avg read'],['published_at','Date']] as [SortKey,string][]).map(([k,l])=><button key={k} className="flex items-center uppercase" onClick={()=>toggleSort(k)}>{l}<SortIcon k={k}/></button>)}
    </div>
    {sorted.length===0?<p className={`py-16 text-center text-sm ${t.sub}`}>No posts yet.</p>:sorted.map(post=>{const st=getStatus(post);return <div key={post.id} className={`grid items-center px-5 py-3.5 border-b last:border-0 transition-colors ${t.tRow}`} style={cols}>
     <div className="flex items-center gap-3 min-w-0 pr-4">
      <div className="h-8 w-12 shrink-0 rounded-md overflow-hidden bg-[var(--a-panel-2)]">{post.cover_image&&<img src={post.cover_image} alt="" className="h-full w-full object-cover"/>}</div>
      <div className="min-w-0"><Link href={`/admin/blog/${post.id}`} className={`text-sm font-medium truncate block hover:underline ${t.heading}`}>{post.title}</Link><span className={`inline-block mt-0.5 rounded-full px-1.5 py-px text-[10px] font-medium ${STATUS_STYLE[st].cls}`}>{STATUS_STYLE[st].label}</span></div>
     </div>
     <div className={`text-sm font-semibold ${t.heading}`}>{post.views.toLocaleString()}</div>
     <div className="flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-[#f10c45]" fill="currentColor"/><span className={`text-sm font-medium ${t.heading}`}>{post.likes}</span></div>
     <div className="flex items-center gap-1"><span className={`text-sm font-medium ${t.heading}`}>{post.comments}</span>{post.pending_comments>0&&<span className="text-[10px] font-bold text-[#d97706]">+{post.pending_comments}</span>}</div>
     <div className={`text-sm ${t.sub}`}>{fmtDuration(post.avg_read_secs)}</div>
     <div className={`text-xs ${t.sub}`}>{post.published_at?fmt(post.published_at):'—'}</div>
    </div>;})}
   </div>
  </div>
 </div>;
}
