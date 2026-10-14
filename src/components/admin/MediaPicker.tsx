'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,ImageIcon,Loader2,Search,UploadCloud,X} from 'lucide-react';
import {t,uploadImage} from './blog/shared';

type Item={key:string;url:string;size:number;modified:string};
const name=(key:string)=>key.split('/').pop()??key;

// Modal to pick one (or several) images already in the media library, or upload new ones.
export default function MediaPicker({open,onClose,onPick,multiple=false}:{open:boolean;onClose:()=>void;onPick:(urls:string[])=>void;multiple?:boolean}){
 const [items,setItems]=useState<Item[]|null>(null);
 const closeRef=useRef(onClose);
 useEffect(()=>{closeRef.current=onClose;});
 const [error,setError]=useState(''),[search,setSearch]=useState(''),[chosen,setChosen]=useState<string[]>([]),[uploading,setUploading]=useState(false);
 useEffect(()=>{
  if(!open)return;
  let live=true;
  fetch('/api/admin/media').then(r=>r.json()).then(d=>{if(!live)return;if(Array.isArray(d))setItems(d);else setError(d.error||'Could not load media.');}).catch(()=>live&&setError('Could not load media.'));
  const k=(e:KeyboardEvent)=>{if(e.key==='Escape')closeRef.current();};window.addEventListener('keydown',k);
  return()=>{live=false;window.removeEventListener('keydown',k);setChosen([]);setSearch('');};
 },[open]);
 if(!open)return null;
 const toggle=(url:string)=>multiple?setChosen(c=>c.includes(url)?c.filter(x=>x!==url):[...c,url]):(onPick([url]),onClose());
 async function upload(files:FileList){
  setUploading(true);setError('');
  const urls:string[]=[];
  for(const f of Array.from(files)){try{urls.push(await uploadImage(f));}catch(e){setError(e instanceof Error?e.message:'Upload failed.');}}
  setItems(i=>[...urls.map(url=>({key:url.split('/').slice(3).join('/'),url,size:0,modified:new Date().toISOString()})),...(i??[])]);
  if(multiple)setChosen(c=>[...urls,...c]);else if(urls[0]){onPick([urls[0]]);onClose();}
  setUploading(false);
 }
 const shown=(items??[]).filter(i=>!search||name(i.key).toLowerCase().includes(search.toLowerCase()));

 return <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
  <div className={`w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl ${t.modal}`} onClick={e=>e.stopPropagation()} role="dialog" aria-label="Choose from media library">
   <div className={`flex flex-wrap items-center gap-3 px-5 py-4 border-b ${t.divider}`}>
    <p className={`text-sm font-bold ${t.heading}`}>Media library</p>
    <div className="relative ml-auto w-48"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${t.sub}`}/><input autoFocus placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}} className={`w-full rounded-lg border pl-9 pr-3 py-1.5 text-xs focus:outline-none ${t.input}`}/></div>
    <label className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${t.brandBtn}`}>{uploading?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<UploadCloud className="h-3.5 w-3.5"/>}Upload<input type="file" multiple={multiple} accept="image/*" className="hidden" onChange={e=>{if(e.target.files?.length)void upload(e.target.files);e.target.value='';}}/></label>
    <button type="button" onClick={onClose} aria-label="Close" data-tip="Close" className={`h-7 w-7 rounded-lg flex items-center justify-center ${t.iconBtn}`}><X className="h-4 w-4"/></button>
   </div>
   {error&&<div className="mx-5 mt-4 rounded-lg bg-[#dc2626] px-4 py-2.5 text-xs text-white">{error}</div>}
   <div className="flex-1 overflow-y-auto p-5" data-lenis-prevent>
    {items===null&&!error?<div className={`py-16 flex justify-center ${t.sub}`}><Loader2 className="h-5 w-5 animate-spin"/></div>
    :shown.length===0?<div className={`py-16 text-center text-sm ${t.sub}`}><ImageIcon className={`h-8 w-8 mx-auto mb-3 ${t.faint}`}/>{search?'No files match.':'The library is empty. Upload an image to start.'}</div>
    :<div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
     {shown.map(i=>{const on=chosen.includes(i.url);return <button type="button" key={i.url} onClick={()=>toggle(i.url)} data-tip={name(i.key)} className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${on?'border-[var(--accent)]':'border-transparent hover:border-[var(--a-muted)]'}`}>
      <img src={i.url} alt="" loading="lazy" className="h-full w-full object-cover"/>
      {on&&<span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center"><Check className="h-3 w-3" strokeWidth={3}/></span>}
     </button>;})}
    </div>}
   </div>
   {multiple&&<div className={`flex items-center justify-between gap-3 px-5 py-3.5 border-t ${t.divider}`}>
    <span className={`text-xs ${t.sub}`}>{chosen.length} selected</span>
    <div className="flex gap-2"><button type="button" onClick={onClose} className={`rounded-lg border px-4 py-2 text-xs font-medium ${t.ghostBtn}`}>Cancel</button><button type="button" disabled={!chosen.length} onClick={()=>{onPick(chosen);onClose();}} className={`rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40 ${t.brandBtn}`}>Add {chosen.length||''} image{chosen.length===1?'':'s'}</button></div>
   </div>}
  </div>
 </div>;
}
