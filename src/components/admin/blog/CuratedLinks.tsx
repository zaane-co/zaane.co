'use client';
import {useState} from 'react';
import {AlertTriangle,ExternalLink,Loader2,Trash2} from 'lucide-react';
import {t,fmt,blogApi} from './shared';

export type Curated={id:string;url:string;source_name:string;title:string;excerpt:string|null;cover_image:string|null;published:boolean;created_at:string};
type Meta={title:string;description:string;image:string;site_name:string;url:string;partial?:boolean};

export default function CuratedLinks({initialLinks}:{initialLinks:Curated[]}){
 const [links,setLinks]=useState(initialLinks);
 const [url,setUrl]=useState(''),[fetching,setFetching]=useState(false),[preview,setPreview]=useState<Meta|null>(null);
 const [title,setTitle]=useState(''),[excerpt,setExcerpt]=useState(''),[sourceName,setSourceName]=useState(''),[coverImage,setCoverImage]=useState('');
 const [saving,setSaving]=useState(false),[error,setError]=useState(''),[deleting,setDeleting]=useState<string|null>(null);
 const reset=()=>{setUrl('');setPreview(null);setTitle('');setExcerpt('');setSourceName('');setCoverImage('');};

 async function handleFetch(){
  if(!url.trim())return;setFetching(true);setError('');setPreview(null);
  let meta:Meta;
  try{meta=await blogApi<Meta>({action:'curated_fetch',url:url.trim()});}
  catch(e){if(e instanceof Error&&e.message.startsWith('Enter')){setError(e.message);setFetching(false);return;}meta={title:'',description:'',image:'',site_name:'',url:url.trim(),partial:true};}
  setPreview(meta);setTitle(meta.title??'');setExcerpt(meta.description??'');setSourceName(meta.site_name??'');setCoverImage(meta.image??'');
  setFetching(false);
 }
 async function handleSave(){
  if(!preview||!title.trim())return;setSaving(true);setError('');
  try{const data=await blogApi<Curated>({action:'curated_save',url:url.trim(),source_name:sourceName,title,excerpt,cover_image:coverImage});setLinks(p=>[data,...p]);reset();}
  catch(e){setError(e instanceof Error?e.message:'Failed to save.');}
  setSaving(false);
 }
 async function handleDelete(id:string){
  setDeleting(id);setError('');
  try{await blogApi({action:'curated_delete',id});setLinks(p=>p.filter(l=>l.id!==id));}catch(e){setError(e instanceof Error?e.message:'Could not delete.');}
  setDeleting(null);
 }
 async function togglePublished(link:Curated){
  try{await blogApi({action:'curated_toggle',id:link.id,published:!link.published});setLinks(p=>p.map(l=>l.id===link.id?{...l,published:!l.published}:l));}catch(e){setError(e instanceof Error?e.message:'Could not update.');}
 }
 const field=`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none transition-colors ${t.input}`;

 return <div className="space-y-6 max-w-5xl">
  <div><h1 className={`text-xl font-bold ${t.heading}`}>Curated Links</h1><p className={`text-sm mt-0.5 ${t.sub}`}>Paste any article URL and we’ll pull the metadata automatically.</p></div>
  <div className={`rounded-2xl border p-5 space-y-4 ${t.card}`}>
   <p className={`text-sm font-semibold ${t.heading}`}>Add New Source</p>
   <div className="flex gap-2">
    <input type="url" value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleFetch()} placeholder="https://smashingmagazine.com/article/..." className={`flex-1 min-w-0 rounded-xl border px-4 py-2.5 text-sm focus:outline-none transition-colors ${t.input}`}/>
    <button onClick={handleFetch} disabled={fetching||!url.trim()} className={`rounded-xl text-sm font-semibold px-5 py-2.5 transition-colors disabled:opacity-50 shrink-0 ${t.brandBtn}`}>{fetching?<span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Fetching…</span>:'Fetch →'}</button>
   </div>
   {error&&<div className="rounded-lg bg-[#dc2626] px-4 py-3 text-xs text-white">{error}</div>}
   {preview&&<div className="space-y-4 pt-2">
    {preview.partial&&<div className="rounded-lg px-4 py-3 text-xs flex items-start gap-2.5 bg-[#f59e0b] text-[#1a1200]"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0"/><span><strong>{sourceName||'This site'}</strong> blocks automatic scraping (paywall or bot protection). Fill in the details manually: open the article, copy the title and image URL, and paste them below.</span></div>}
    <p className={`text-xs font-semibold uppercase tracking-widest ${t.sub}`}>Preview & Edit</p>
    <div className={`rounded-xl overflow-hidden border ${t.divider}`}>
     {coverImage&&<div className="relative h-44 bg-[var(--a-panel-2)] overflow-hidden">
      <img src={coverImage} alt="" className="w-full h-full object-cover"/>
      <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white bg-black"><ExternalLink className="h-3 w-3"/>{sourceName}</span>
     </div>}
     <div className={`p-4 ${t.soft}`}>
      <p className={`text-sm font-bold leading-snug line-clamp-2 ${t.heading}`}>{title}</p>
      {excerpt&&<p className={`text-xs mt-1.5 line-clamp-2 ${t.sub}`}>{excerpt}</p>}
      <p className="mt-2 text-xs font-semibold text-[var(--accent)]">Read on {sourceName} →</p>
     </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
     <label className="space-y-1.5"><span className={`text-xs font-medium ${t.sub}`}>Title</span><input value={title} onChange={e=>setTitle(e.target.value)} className={field}/></label>
     <label className="space-y-1.5"><span className={`text-xs font-medium ${t.sub}`}>Source Name</span><input value={sourceName} onChange={e=>setSourceName(e.target.value)} className={field}/></label>
    </div>
    <label className="block space-y-1.5"><span className={`text-xs font-medium ${t.sub}`}>Excerpt</span><textarea value={excerpt} onChange={e=>setExcerpt(e.target.value)} rows={2} className={`${field} resize-none`}/></label>
    <label className="block space-y-1.5"><span className={`text-xs font-medium ${t.sub}`}>Cover Image URL</span><input value={coverImage} onChange={e=>setCoverImage(e.target.value)} className={field}/></label>
    <div className="flex gap-2">
     <button onClick={handleSave} disabled={saving||!title.trim()} className={`rounded-xl text-sm font-semibold px-5 py-2.5 transition-colors disabled:opacity-50 ${t.brandBtn}`}>{saving?'Saving…':'Save to Curated'}</button>
     <button onClick={reset} className={`rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors ${t.ghostBtn}`}>Cancel</button>
    </div>
   </div>}
  </div>

  <div className={`rounded-2xl border overflow-hidden ${t.card}`}>
   <div className={`flex items-center justify-between px-5 py-4 border-b ${t.divider}`}><p className={`text-sm font-semibold ${t.heading}`}>Saved Links</p><p className={`text-xs ${t.sub}`}>{links.length} total</p></div>
   {links.length===0?<p className={`py-16 text-center text-sm ${t.sub}`}>No curated links yet.</p>:<div>
    {links.map(link=><div key={link.id} className={`flex flex-wrap sm:flex-nowrap items-start gap-4 px-5 py-4 border-b last:border-0 ${t.divider}`}>
     <div className="h-16 w-24 shrink-0 rounded-lg overflow-hidden bg-[var(--a-panel-2)]">{link.cover_image&&<img src={link.cover_image} alt="" className="h-full w-full object-cover"/>}</div>
     <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap mb-0.5">
       <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#2563eb] text-white">{link.source_name}</span>
       <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${link.published?'bg-[#16a34a] text-white':'bg-[#52525b] text-white'}`}>{link.published?'Live':'Hidden'}</span>
      </div>
      <p className={`text-sm font-semibold line-clamp-1 ${t.heading}`}>{link.title}</p>
      {link.excerpt&&<p className={`text-xs mt-0.5 line-clamp-1 ${t.sub}`}>{link.excerpt}</p>}
      <a href={link.url} target="_blank" rel="noopener noreferrer" className={`text-xs mt-0.5 block truncate hover:underline ${t.faint} hover:text-[var(--a-fg)]`}>{link.url}</a>
     </div>
     <div className="flex items-center gap-1.5 shrink-0">
      <span className={`text-xs ${t.sub}`}>{fmt(link.created_at)}</span>
      <button onClick={()=>togglePublished(link)} className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors bg-[var(--a-panel-2)] ${t.sub} hover:text-[var(--a-fg)]`}>{link.published?'Hide':'Show'}</button>
      <button onClick={()=>handleDelete(link.id)} disabled={deleting===link.id} aria-label="Delete link" className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${t.faint} hover:text-white hover:bg-[#dc2626]`}><Trash2 className="h-3.5 w-3.5"/></button>
     </div>
    </div>)}
   </div>}
  </div>
 </div>;
}
