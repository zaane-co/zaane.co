'use client';
import {useState} from 'react';
import {GripVertical,ImagePlus,Loader2,UploadCloud,X} from 'lucide-react';
import {t,uploadImage} from './blog/shared';
import MediaPicker from './MediaPicker';

type Img={id:string;image_url:string;order:number};
async function api(body:object):Promise<Img[]>{const r=await fetch('/api/admin/project-gallery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Could not update the gallery.');return d;}

// Gallery for one project: drop or pick several images, drag to reorder, remove. Changes save immediately.
export default function ProjectGallery({projectId,initial}:{projectId:string;initial:Img[]}){
 const [images,setImages]=useState(initial);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[picker,setPicker]=useState(false),[over,setOver]=useState(false);
 const [dragId,setDragId]=useState<string|null>(null);
 async function run(body:object){setBusy(true);setError('');try{setImages(await api({...body,project_id:projectId}));}catch(e){setError(e instanceof Error?e.message:'Something went wrong.');}setBusy(false);}
 async function uploadFiles(files:FileList|File[]){
  const list=Array.from(files).filter(f=>f.type.startsWith('image/'));if(!list.length)return;
  setBusy(true);setError('');const urls:string[]=[];
  for(const f of list){try{urls.push(await uploadImage(f));}catch(e){setError(e instanceof Error?e.message:'Upload failed.');}}
  setBusy(false);if(urls.length)await run({action:'add',urls});
 }
 function dropOn(targetId:string){
  if(!dragId||dragId===targetId)return;
  const next=[...images],from=next.findIndex(i=>i.id===dragId),to=next.findIndex(i=>i.id===targetId);
  const [moved]=next.splice(from,1);next.splice(to,0,moved);setImages(next);setDragId(null);
  void run({action:'reorder',ids:next.map(i=>i.id)});
 }

 return <div className="za-field">
  <div className="za-field-label"><label>Gallery</label><span className={`text-xs ${t.faint}`}>{images.length} image{images.length!==1?'s':''} · drag to reorder · saves instantly</span></div>
  {images.length>0&&<div className="grid grid-cols-3 gap-2 mb-2">
   {images.map((img,i)=><div key={img.id} draggable onDragStart={()=>setDragId(img.id)} onDragEnd={()=>setDragId(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.stopPropagation();dropOn(img.id);}}
    className={`group relative aspect-[4/3] rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing ${dragId===img.id?'opacity-40 border-[var(--accent)]':'border-transparent'}`}>
    <img src={img.image_url} alt={`Gallery image ${i+1}`} className="h-full w-full object-cover pointer-events-none"/>
    <span className="absolute top-1.5 left-1.5 h-5 min-w-5 px-1 rounded bg-black text-white text-[10px] font-semibold flex items-center justify-center">{i+1}</span>
    <span className="absolute bottom-1.5 left-1.5 h-5 w-5 rounded bg-black text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><GripVertical className="h-3 w-3"/></span>
    <button type="button" onClick={()=>run({action:'remove',id:img.id})} disabled={busy} aria-label={`Remove image ${i+1}`} data-tip={`Remove image ${i+1}`} className="absolute top-1.5 right-1.5 h-6 w-6 rounded bg-[#dc2626] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100"><X className="h-3.5 w-3.5"/></button>
   </div>)}
  </div>}
  <div onDragOver={e=>{if(!dragId){e.preventDefault();setOver(true);}}} onDragLeave={()=>setOver(false)} onDrop={e=>{if(dragId)return;e.preventDefault();setOver(false);void uploadFiles(e.dataTransfer.files);}}
   className={`rounded-lg border-2 border-dashed px-4 py-4 flex flex-wrap items-center justify-center gap-2 text-xs transition-colors ${over?'border-[var(--accent)] bg-[var(--a-hover)]':'border-[var(--a-border)]'}`}>
   {busy?<span className={`flex items-center gap-2 ${t.sub}`}><Loader2 className="h-4 w-4 animate-spin"/>Saving…</span>:<>
    <span className={t.sub}>Drop images here or</span>
    <label className="za-btn za-btn-ghost cursor-pointer"><UploadCloud size={15}/>Upload<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif" hidden onChange={e=>{if(e.target.files)void uploadFiles(e.target.files);e.target.value='';}}/></label>
    <button type="button" className="za-btn za-btn-ghost" onClick={()=>setPicker(true)}><ImagePlus size={15}/>Choose from library</button>
   </>}
  </div>
  {error&&<p className="za-flash" role="status">{error}</p>}
  <MediaPicker open={picker} multiple onClose={()=>setPicker(false)} onPick={urls=>void run({action:'add',urls})}/>
 </div>;
}
