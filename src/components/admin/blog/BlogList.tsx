'use client';
import Dropdown from '@/components/ui/Dropdown';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ChevronDown,ChevronLeft,ExternalLink,Eye,Pencil,Plus,Search,Star,Trash2,CloudUpload,CalendarDays,PenLine,X} from 'lucide-react';
import {t,getStatus,STATUS_STYLE,fmt,blogApi,type Post,type Category,type PostStatus} from './shared';

type Filter='all'|PostStatus;
type PostCat={post_id:string;category_id:string};

export default function BlogList({posts,categories=[],postCats=[],viewCounts=[],canPublish}:{posts:Post[];categories?:Category[];postCats?:PostCat[];viewCounts?:{post_id:string;views:number}[];canPublish:boolean}){
 const router=useRouter();
 const [filter,setFilter]=useState<Filter>('all');
 const [catFilter,setCatFilter]=useState('all');
 const [search,setSearch]=useState('');
 const [loading,setLoading]=useState<string|null>(null);
 const [error,setError]=useState('');
 const [featuredId,setFeaturedId]=useState<string|null>(posts.find(p=>p.featured)?.id??null);
 const [featuredToast,setFeaturedToast]=useState<{title:string;sub:string;type:'set'|'unset'}|null>(null);
 const [statusTarget,setStatusTarget]=useState<Post|null>(null);
 const [scheduleDate,setScheduleDate]=useState('');
 const [statusAction,setStatusAction]=useState<PostStatus|null>(null);
 const [minSchedule,setMinSchedule]=useState('');
 const [deleteTarget,setDeleteTarget]=useState<Post|null>(null);
 const [picked,setPicked]=useState<string[]>([]),[bulkDelete,setBulkDelete]=useState(false),[bulkBusy,setBulkBusy]=useState(false);
 async function bulk(op:'publish'|'draft'|'delete'){
  setBulkBusy(true);setError('');
  try{await blogApi({action:'bulk',op,ids:picked});setPicked([]);setBulkDelete(false);router.refresh();}catch(e){setError(e instanceof Error?e.message:'Could not update.');}
  setBulkBusy(false);
 }

 async function setFeatured(postId:string){
  const isUnset=featuredId===postId,next=isUnset?null:postId,post=posts.find(p=>p.id===postId),prev=featuredId;
  setFeaturedId(next);
  try{await blogApi({action:'feature',id:next});}catch(e){setFeaturedId(prev);setError(e instanceof Error?e.message:'Could not update.');return;}
  setFeaturedToast({type:isUnset?'unset':'set',title:isUnset?'Removed from featured':'Post set as featured',sub:post?.title??''});
  setTimeout(()=>setFeaturedToast(null),3500);
  router.refresh();
 }

 const counts={all:posts.length,published:posts.filter(p=>getStatus(p)==='published').length,draft:posts.filter(p=>getStatus(p)==='draft').length,scheduled:posts.filter(p=>getStatus(p)==='scheduled').length};
 const catMap=postCats.reduce<Record<string,string[]>>((acc,pc)=>{(acc[pc.post_id]=acc[pc.post_id]??[]).push(pc.category_id);return acc;},{});
 const viewMap=Object.fromEntries(viewCounts.map(v=>[v.post_id,v.views]));
 const parentCats=categories.filter(c=>!c.parent_id);
 const filtered=posts.filter(p=>(filter==='all'||getStatus(p)===filter)&&(!search||p.title?.toLowerCase().includes(search.toLowerCase()))&&(catFilter==='all'||(catMap[p.id]??[]).includes(catFilter)));

 async function applyStatus(post:Post,next:PostStatus,date?:string){
  setLoading(post.id);setError('');
  try{await blogApi({action:'status',id:post.id,mode:next,published_at:date?new Date(date).toISOString():null});router.refresh();setStatusTarget(null);setStatusAction(null);setScheduleDate('');}
  catch(e){setError(e instanceof Error?e.message:'Could not update.');}
  setLoading(null);
 }
 async function confirmDelete(post:Post){
  setLoading(post.id);setError('');
  try{await blogApi({action:'delete',id:post.id});router.refresh();setDeleteTarget(null);}catch(e){setError(e instanceof Error?e.message:'Could not delete.');}
  setLoading(null);
 }
 const filterTab=(a:boolean)=>a?'bg-[var(--accent)] text-white':`${t.faint} hover:text-[var(--a-fg)] hover:bg-[var(--a-hover)]`;

 return <>
  {/* Featured toast */}
  <div className={`fixed bottom-6 right-6 z-[100] transition-all duration-300 ${featuredToast?'translate-y-0 opacity-100':'translate-y-4 opacity-0 pointer-events-none'}`}>
   {featuredToast&&<div className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl border min-w-[280px] max-w-sm ${t.modal}`}>
    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${featuredToast.type==='set'?'bg-[#f59e0b] text-white':`${t.soft} ${t.faint}`}`}><Star className="h-4 w-4" fill={featuredToast.type==='set'?'currentColor':'none'}/></div>
    <div className="flex-1 min-w-0"><p className={`text-sm font-semibold ${t.heading}`}>{featuredToast.title}</p>{featuredToast.sub&&<p className={`text-xs mt-0.5 truncate ${t.sub}`}>{featuredToast.sub}</p>}</div>
   </div>}
  </div>

  <div className="space-y-5">
   <div className="flex items-center justify-between gap-4">
    <div><h1 className={`text-xl font-bold ${t.heading}`}>Blog Posts</h1><p className={`text-sm mt-0.5 ${t.sub}`}>{posts.length} posts total</p></div>
    <Link href="/admin/blog/new" className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity ${t.brandBtn}`}><Plus className="h-4 w-4 shrink-0" strokeWidth={2.5}/>New Post</Link>
   </div>
   {error&&<div className="rounded-lg bg-[#f10c45] px-4 py-3 text-xs text-white">{error}</div>}

   {picked.length>0&&canPublish&&<div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 bg-[var(--a-fg)] text-[var(--a-bg)]">
    <strong className="text-sm mr-auto">{picked.length} selected</strong>
    <button onClick={()=>bulk('publish')} disabled={bulkBusy} className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-[#16a34a] text-white disabled:opacity-50">Publish</button>
    <button onClick={()=>bulk('draft')} disabled={bulkBusy} className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-[#52525b] text-white disabled:opacity-50">Move to draft</button>
    <button onClick={()=>setBulkDelete(true)} disabled={bulkBusy} className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-[#dc2626] text-white disabled:opacity-50 flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5"/>Delete</button>
    <button onClick={()=>setPicked([])} className="rounded-lg px-3 py-1.5 text-xs font-medium border border-current">Clear</button>
   </div>}
   <div className={`rounded-xl border ${t.card}`}>
    <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b ${t.divider}`}>
     <div className="flex flex-wrap items-center gap-1">
      {(['all','published','draft','scheduled'] as Filter[]).map(f=><button key={f} onClick={()=>setFilter(f)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize ${filterTab(filter===f)}`}>
       {f}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter===f?'bg-white text-[var(--accent)]':'bg-[var(--a-panel-2)]'}`}>{counts[f]}</span>
      </button>)}
     </div>
     <div className="flex items-center gap-2">
      {parentCats.length>0&&<div className="relative">
       <Dropdown variant="inline" label="Filter by category" value={catFilter} onChange={setCatFilter} options={[{value:'all',label:'All categories'},...parentCats.map(c=>({value:c.id,label:c.name}))]}/>
      </div>}
      <div className="relative w-44">
       <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${t.sub}`}/>
       <input type="text" placeholder="Search posts…" value={search} onChange={e=>setSearch(e.target.value)} className={`w-full rounded-lg border pl-9 pr-3 py-1.5 text-xs focus:outline-none transition-colors ${t.input}`}/>
      </div>
     </div>
    </div>

    {filtered.length===0?<div className={`py-16 text-center text-sm ${t.sub}`}>{search?`No posts matching "${search}"`:filter!=='all'?`No ${filter} posts yet.`:'No posts yet. Create your first one.'}</div>:
    <div className="overflow-x-auto"><table className="w-full text-sm">
     <thead><tr className={`border-b text-xs uppercase tracking-wide ${t.tHead}`}>
      {canPublish&&<th className="pl-5 py-3 w-8"><input type="checkbox" aria-label="Select all" data-tip={filtered.every(p=>picked.includes(p.id))?'Deselect all':'Select all'} className="h-4 w-4 accent-[var(--accent)] cursor-pointer align-middle" checked={filtered.length>0&&filtered.every(p=>picked.includes(p.id))} ref={el=>{if(el)el.indeterminate=picked.length>0&&!filtered.every(p=>picked.includes(p.id));}} onChange={e=>setPicked(e.target.checked?filtered.map(p=>p.id):[])}/></th>}
      <th className="px-5 py-3 text-left font-medium">Title</th><th className="px-5 py-3 text-left font-medium">Status</th><th className="px-5 py-3 text-left font-medium">Views</th><th className="px-5 py-3 text-left font-medium">Date</th><th className="px-5 py-3 text-right font-medium">Actions</th>
     </tr></thead>
     <tbody>{filtered.map(post=>{
      const status=getStatus(post),style=STATUS_STYLE[status];
      return <tr key={post.id} className={`border-b last:border-0 transition-colors ${t.tRow} ${picked.includes(post.id)?'bg-[var(--a-hover)]':''}`}>
       {canPublish&&<td className="pl-5 py-4 w-8"><input type="checkbox" aria-label={`Select ${post.title}`} className="h-4 w-4 accent-[var(--accent)] cursor-pointer align-middle" checked={picked.includes(post.id)} onChange={e=>setPicked(p=>e.target.checked?[...p,post.id]:p.filter(x=>x!==post.id))}/></td>}
       <td className="px-5 py-4 max-w-[360px]"><p className={`font-medium ${t.heading} line-clamp-1`}>{post.title}</p>{post.excerpt&&<p className={`text-xs mt-0.5 line-clamp-1 ${t.faint}`}>{post.excerpt}</p>}</td>
       <td className="px-5 py-4">
        <button onClick={()=>{if(!canPublish)return;setStatusTarget(post);setStatusAction(null);setScheduleDate('');}} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${canPublish?'hover:opacity-80 cursor-pointer':'cursor-default'} ${style.cls}`}>
         <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-white"/>{style.label}{canPublish&&<ChevronDown className="h-2.5 w-2.5 opacity-70 ml-0.5" strokeWidth={2.5}/>}
        </button>
       </td>
       <td className={`px-5 py-4 ${t.faint} text-xs`}>{viewMap[post.id]?<span className="flex items-center gap-1"><Eye className="h-3 w-3"/>{viewMap[post.id].toLocaleString()}</span>:'—'}</td>
       <td className={`px-5 py-4 ${t.faint} text-xs whitespace-nowrap`}>{status==='scheduled'&&post.published_at?<>Scheduled for {fmt(post.published_at)}</>:fmt(post.published_at??post.created_at)}</td>
       <td className="px-5 py-4">
        <div className="flex items-center justify-end gap-1">
         {canPublish&&<button onClick={()=>setFeatured(post.id)} data-tip={featuredId===post.id?'Unset featured':'Set as featured'} className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${featuredId===post.id?'text-white bg-[#f59e0b]':`${t.faint} hover:text-[#f59e0b] hover:bg-[var(--a-hover)]`}`}><Star className="h-3.5 w-3.5" fill={featuredId===post.id?'currentColor':'none'}/></button>}
         {status==='published'&&<Link href={`/blog/${post.slug}`} target="_blank" data-tip="View post" className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${t.iconBtn}`}><ExternalLink className="h-3.5 w-3.5"/></Link>}
         <Link href={`/admin/blog/${post.id}`} data-tip="Edit post" className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${t.iconBtn}`}><Pencil className="h-3.5 w-3.5"/></Link>
         {canPublish&&<button onClick={()=>setDeleteTarget(post)} disabled={loading===post.id} data-tip="Delete post" className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${t.faint} hover:text-white hover:bg-[#dc2626]`}><Trash2 className="h-3.5 w-3.5"/></button>}
        </div>
       </td>
      </tr>;
     })}</tbody>
    </table></div>}
   </div>
  </div>

  {/* Status modal */}
  {statusTarget&&<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={()=>{setStatusTarget(null);setStatusAction(null);}}>
   <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 ${t.modal}`} onClick={e=>e.stopPropagation()}>
    <div className="flex items-start justify-between mb-5">
     <div><p className={`text-sm font-bold ${t.heading}`}>Change Status</p><p className={`text-xs mt-0.5 line-clamp-1 ${t.sub}`}>{statusTarget.title}</p></div>
     <button onClick={()=>{setStatusTarget(null);setStatusAction(null);}} className={`${t.sub} hover:opacity-70`} aria-label="Close"><X className="h-4 w-4"/></button>
    </div>
    {statusAction===null?<div className="space-y-2">
     {getStatus(statusTarget)!=='published'&&<Option onClick={()=>setStatusAction('published')} icon={<CloudUpload className="h-4 w-4"/>} color="#16a34a" title="Publish" body="Go live immediately on the site"/>}
     {getStatus(statusTarget)!=='draft'&&<Option onClick={()=>setStatusAction('draft')} icon={<PenLine className="h-4 w-4"/>} color="#52525b" title={getStatus(statusTarget)==='published'?'Unpublish':'Save as Draft'} body="Save privately, not visible on site"/>}
     <Option onClick={()=>{const d=new Date();setMinSchedule(new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16));setStatusAction('scheduled');}} icon={<CalendarDays className="h-4 w-4"/>} color="#2563eb" title="Schedule" body="Set a future publish date and time"/>
    </div>:statusAction==='scheduled'?<div className="space-y-4">
     <button onClick={()=>setStatusAction(null)} className={`flex items-center gap-1.5 text-xs ${t.sub} hover:opacity-70`}><ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5}/>Back</button>
     <div className="space-y-1.5"><p className={`text-xs font-medium ${t.sub}`}>Publish date & time</p>
      <input type="datetime-local" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)} min={minSchedule} className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none transition-colors ${t.input}`}/>
     </div>
     {error&&<p className="text-xs text-[#f10c45]">{error}</p>}
     <button disabled={!scheduleDate||loading===statusTarget.id} onClick={()=>applyStatus(statusTarget,'scheduled',scheduleDate)} className="w-full py-2.5 rounded-xl bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-40">{loading===statusTarget.id?'Scheduling…':'Confirm Schedule'}</button>
    </div>:<div className="space-y-4">
     <button onClick={()=>setStatusAction(null)} className={`flex items-center gap-1.5 text-xs ${t.sub} hover:opacity-70`}><ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5}/>Back</button>
     <div className={`rounded-xl p-4 text-sm ${t.soft}`}>
      <p className={t.heading}>{statusAction==='published'?'Publish this post?':'Move to Draft?'}</p>
      <p className={`text-xs mt-1 ${t.sub}`}>{statusAction==='published'?'It will go live immediately and be visible to all visitors.':'It will be removed from the public site and saved privately.'}</p>
     </div>
     <div className="flex gap-2">
      <button onClick={()=>setStatusAction(null)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${t.ghostBtn}`}>Cancel</button>
      <button onClick={()=>applyStatus(statusTarget,statusAction)} disabled={loading===statusTarget.id} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 ${statusAction==='published'?'bg-[#16a34a] hover:bg-[#15803d]':'bg-[var(--accent)] hover:opacity-90'}`}>{loading===statusTarget.id?'Saving…':statusAction==='published'?'Yes, Publish':'Yes, Unpublish'}</button>
     </div>
    </div>}
   </div>
  </div>}

  {bulkDelete&&<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={()=>setBulkDelete(false)}>
   <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 ${t.modal}`} onClick={e=>e.stopPropagation()}>
    <div className="flex items-center gap-4 mb-5"><div className="h-11 w-11 rounded-full bg-[#dc2626] flex items-center justify-center flex-none"><Trash2 className="h-5 w-5 text-white"/></div><div><p className={`text-sm font-bold ${t.heading}`}>Delete {picked.length} post{picked.length===1?'':'s'}?</p><p className={`text-xs mt-0.5 ${t.sub}`}>This can’t be undone.</p></div></div>
    <div className="flex gap-2">
     <button onClick={()=>setBulkDelete(false)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${t.ghostBtn}`}>Cancel</button>
     <button onClick={()=>bulk('delete')} disabled={bulkBusy} className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-[#b91c1c] text-white text-sm font-semibold transition-colors disabled:opacity-50">{bulkBusy?'Deleting…':`Delete ${picked.length}`}</button>
    </div>
   </div>
  </div>}
  {/* Delete modal */}
  {deleteTarget&&<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={()=>setDeleteTarget(null)}>
   <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 ${t.modal}`} onClick={e=>e.stopPropagation()}>
    <div className="flex items-center gap-4 mb-5">
     <div className="h-11 w-11 rounded-full bg-[#dc2626] flex items-center justify-center flex-none"><Trash2 className="h-5 w-5 text-white"/></div>
     <div className="min-w-0"><p className={`text-sm font-bold ${t.heading}`}>Delete Post</p><p className={`text-xs mt-0.5 line-clamp-1 ${t.sub}`}>{deleteTarget.title}</p></div>
    </div>
    <div className={`rounded-xl p-4 mb-4 border ${t.divider} ${t.soft}`}><p className={`text-sm ${t.heading}`}>This will permanently delete the post and cannot be undone.</p></div>
    {error&&<p className="mb-3 text-xs text-[#f10c45]">{error}</p>}
    <div className="flex gap-2">
     <button onClick={()=>setDeleteTarget(null)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${t.ghostBtn}`}>Cancel</button>
     <button onClick={()=>confirmDelete(deleteTarget)} disabled={loading===deleteTarget.id} className="flex-1 py-2.5 rounded-xl bg-[#dc2626] hover:bg-[#b91c1c] text-white text-sm font-semibold transition-colors disabled:opacity-50">{loading===deleteTarget.id?'Deleting…':'Delete Post'}</button>
    </div>
   </div>
  </div>}
 </>;
}

function Option({onClick,icon,color,title,body}:{onClick:()=>void;icon:React.ReactNode;color:string;title:string;body:string}){
 return <button onClick={onClick} className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors border ${t.divider} ${t.soft} hover:bg-[var(--a-hover)]`}>
  <span className="h-8 w-8 rounded-full flex items-center justify-center flex-none text-white" style={{background:color}}>{icon}</span>
  <div><p className={`text-sm font-semibold ${t.heading}`}>{title}</p><p className={`text-xs ${t.sub}`}>{body}</p></div>
 </button>;
}
