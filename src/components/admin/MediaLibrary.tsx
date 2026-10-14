'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {AlertTriangle,Check,Copy,ExternalLink,ImageIcon,Loader2,Search,Trash2,UploadCloud,X} from 'lucide-react';
import {t,fmt,uploadImage} from './blog/shared';

type Usage={label:string;href:string};
type File_={key:string;url:string;size:number;modified:string;usage:Usage[]};
const name=(key:string)=>key.split('/').pop()??key;
const size=(b:number)=>b<1024?`${b} B`:b<1048576?`${(b/1024).toFixed(0)} KB`:`${(b/1048576).toFixed(1)} MB`;

export default function MediaLibrary({initial,canDelete}:{initial:File_[];canDelete:boolean}){
 const router=useRouter();
 const [files,setFiles]=useState(initial);
 const [search,setSearch]=useState(''),[filter,setFilter]=useState<'all'|'used'|'unused'>('all');
 const [queue,setQueue]=useState<{name:string;done:boolean;error?:string}[]>([]);
 const [selected,setSelected]=useState<File_|null>(null);
 const [copied,setCopied]=useState(false),[dragging,setDragging]=useState(false);
 const [confirm,setConfirm]=useState(false),[deleting,setDeleting]=useState(false),[error,setError]=useState('');

 async function upload(list:FileList|File[]){
  const items=Array.from(list).filter(f=>f.type.startsWith('image/'));if(!items.length)return;
  setQueue(items.map(f=>({name:f.name,done:false})));
  for(const [i,f] of items.entries()){
   try{const url=await uploadImage(f);setFiles(p=>[{key:url.split('/').slice(3).join('/'),url,size:f.size,modified:new Date().toISOString(),usage:[]},...p]);setQueue(q=>q.map((x,j)=>j===i?{...x,done:true}:x));}
   catch(e){setQueue(q=>q.map((x,j)=>j===i?{...x,done:true,error:e instanceof Error?e.message:'Failed'}:x));}
  }
  setTimeout(()=>setQueue(q=>q.filter(x=>x.error)),2500);router.refresh();
 }
 async function remove(force:boolean){
  if(!selected)return;setDeleting(true);setError('');
  const r=await fetch('/api/admin/media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',url:selected.url,force})}).catch(()=>null);
  const d=await r?.json().catch(()=>({}));
  if(r?.ok){setFiles(p=>p.filter(f=>f.url!==selected.url));setSelected(null);setConfirm(false);router.refresh();}
  else if(d?.error==='in_use'){setSelected({...selected,usage:d.usage});setConfirm(true);}
  else setError(d?.error||'Could not delete.');
  setDeleting(false);
 }
 const copy=(url:string)=>{void navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1500);};
 const shown=files.filter(f=>(!search||name(f.key).toLowerCase().includes(search.toLowerCase()))&&(filter==='all'||(filter==='used'?f.usage.length>0:f.usage.length===0)));
 const total=files.reduce((s,f)=>s+f.size,0);

 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-4">
   <div><h1 className={`text-xl font-bold ${t.heading}`}>Media</h1><p className={`text-sm mt-0.5 ${t.sub}`}>{files.length} file{files.length!==1?'s':''} · {size(total)} · stored on Cloudflare R2</p></div>
   <label className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold cursor-pointer transition-opacity ${t.brandBtn}`}><UploadCloud className="h-4 w-4"/>Upload<input type="file" multiple accept="image/*" className="hidden" onChange={e=>{if(e.target.files)void upload(e.target.files);e.target.value='';}}/></label>
  </div>

  <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void upload(e.dataTransfer.files);}}
   className={`rounded-xl border-2 border-dashed px-5 py-6 text-center transition-colors ${dragging?'border-[var(--accent)] bg-[var(--a-hover)]':'border-[var(--a-border)]'}`}>
   <UploadCloud className={`h-7 w-7 mx-auto mb-2 ${t.faint}`}/>
   <p className={`text-sm ${t.sub}`}>Drag images here to upload several at once</p>
   <p className={`text-xs mt-1 ${t.faint}`}>Any size · big images are resized to 2560px and saved as WebP · GIFs up to 4 MB</p>
   {queue.length>0&&<div className="mt-4 space-y-1.5 max-w-md mx-auto text-left">{queue.map((q,i)=><div key={i} className="flex items-center gap-2 text-xs">
    {!q.done?<Loader2 className={`h-3.5 w-3.5 animate-spin ${t.sub}`}/>:q.error?<X className="h-3.5 w-3.5 text-[#dc2626]"/>:<Check className="h-3.5 w-3.5 text-[#16a34a]"/>}
    <span className={`truncate flex-1 ${t.heading}`}>{q.name}</span>{q.error&&<span className="text-[#dc2626]">{q.error}</span>}
   </div>)}</div>}
  </div>

  <div className={`rounded-xl border ${t.card}`}>
   <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b ${t.divider}`}>
    <div className="flex items-center gap-1">
     {(['all','used','unused'] as const).map(f=><button key={f} onClick={()=>setFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filter===f?'bg-[var(--accent)] text-white':`${t.faint} hover:text-[var(--a-fg)] hover:bg-[var(--a-hover)]`}`}>{f==='used'?'In use':f}</button>)}
    </div>
    <div className="relative w-52"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${t.sub}`}/><input placeholder="Search files…" value={search} onChange={e=>setSearch(e.target.value)} className={`w-full rounded-lg border pl-9 pr-3 py-1.5 text-xs focus:outline-none ${t.input}`}/></div>
   </div>
   {shown.length===0?<div className={`py-16 text-center text-sm ${t.sub}`}><ImageIcon className={`h-8 w-8 mx-auto mb-3 ${t.faint}`}/>{search||filter!=='all'?'No files match.':'No media yet. Upload your first image.'}</div>:
   <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 p-4">
    {shown.map(f=><button key={f.url} onClick={()=>{setSelected(f);setConfirm(false);setError('');}} className={`group text-left rounded-xl border overflow-hidden transition-colors ${t.divider} hover:border-[var(--accent)]`}>
     <div className="aspect-square bg-[var(--a-panel-2)] overflow-hidden"><img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105"/></div>
     <div className="p-2.5">
      <p className={`text-xs font-medium truncate ${t.heading}`}>{name(f.key)}</p>
      <div className="flex items-center justify-between mt-1"><span className={`text-[10px] ${t.faint}`}>{size(f.size)}</span>{f.usage.length>0?<span className="text-[10px] rounded-full px-1.5 py-px bg-[#16a34a] text-white">Used {f.usage.length}</span>:<span className={`text-[10px] ${t.faint}`}>Unused</span>}</div>
     </div>
    </button>)}
   </div>}
  </div>

  {selected&&<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={()=>setSelected(null)}>
   <div className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${t.modal}`} onClick={e=>e.stopPropagation()} data-lenis-prevent>
    <div className={`flex items-center justify-between px-5 py-4 border-b ${t.divider}`}><p className={`text-sm font-bold truncate ${t.heading}`}>{name(selected.key)}</p><button onClick={()=>setSelected(null)} aria-label="Close" data-tip="Close" className={`h-7 w-7 rounded-lg flex items-center justify-center ${t.iconBtn}`}><X className="h-4 w-4"/></button></div>
    <div className="grid md:grid-cols-[1.4fr_1fr]">
     <div className="bg-[var(--a-panel-2)] flex items-center justify-center p-4 min-h-[260px]"><img src={selected.url} alt="" className="max-h-[60vh] max-w-full rounded-lg object-contain"/></div>
     <div className="p-5 space-y-5">
      <dl className="space-y-2 text-xs">
       <div className="flex justify-between gap-3"><dt className={t.sub}>Size</dt><dd className={t.heading}>{size(selected.size)}</dd></div>
       <div className="flex justify-between gap-3"><dt className={t.sub}>Uploaded</dt><dd className={t.heading}>{selected.modified?fmt(selected.modified):'—'}</dd></div>
      </dl>
      <div className="space-y-1.5">
       <p className={`text-xs font-semibold uppercase tracking-wide ${t.sub}`}>File URL</p>
       <div className="flex gap-2"><input readOnly value={selected.url} onFocus={e=>e.target.select()} className={`flex-1 min-w-0 rounded-lg border px-2.5 py-2 text-xs ${t.input}`}/>
        <button onClick={()=>copy(selected.url)} className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${t.brandBtn}`}>{copied?<Check className="h-3.5 w-3.5"/>:<Copy className="h-3.5 w-3.5"/>}{copied?'Copied':'Copy'}</button></div>
       <a href={selected.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-xs ${t.sub} hover:text-[var(--a-fg)]`}><ExternalLink className="h-3 w-3"/>Open original</a>
      </div>
      <div className="space-y-1.5">
       <p className={`text-xs font-semibold uppercase tracking-wide ${t.sub}`}>Used in</p>
       {selected.usage.length===0?<p className={`text-xs ${t.faint}`}>Not used anywhere on the site.</p>:<ul className="space-y-1">{selected.usage.map((u,i)=><li key={i}><Link href={u.href} className={`text-xs hover:underline ${t.heading}`}>{u.label}</Link></li>)}</ul>}
      </div>
      {error&&<div className="rounded-lg bg-[#dc2626] px-3 py-2.5 text-xs text-white">{error}</div>}
      {canDelete&&(confirm?<div className="rounded-xl p-3.5 space-y-3 bg-[#dc2626] text-white">
       <p className="text-xs flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0"/>{selected.usage.length?`This image is used in ${selected.usage.length} place${selected.usage.length>1?'s':''}. Deleting it will leave a broken image there.`:'Delete this file permanently?'}</p>
       <div className="flex gap-2"><button onClick={()=>remove(true)} disabled={deleting} className="flex-1 rounded-lg bg-white text-[#dc2626] py-2 text-xs font-semibold disabled:opacity-50">{deleting?'Deleting…':'Delete anyway'}</button><button onClick={()=>setConfirm(false)} className="flex-1 rounded-lg border border-white py-2 text-xs font-medium">Cancel</button></div>
      </div>:<button onClick={()=>setConfirm(true)} disabled={deleting} className={`w-full flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition-colors ${t.divider} text-[#dc2626] hover:bg-[#dc2626] hover:text-white hover:border-[#dc2626]`}><Trash2 className="h-3.5 w-3.5"/>{deleting?'Deleting…':'Delete file'}</button>)}
     </div>
    </div>
   </div>
  </div>}
 </div>;
}
