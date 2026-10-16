'use client';
import {useRef,useState} from 'react';
import {Download,File as FileIcon,FileImage,FileText,FileVideo,Loader2,Trash2,UploadCloud} from 'lucide-react';
import './lead-files.css';
import DocViewer,{docKind} from '@/components/zarn/DocViewer';

export type LeadFile={id:string;name:string;size:number;type:string;uploaded_by:string|null;created_at:string};
type Up={tmp:string;name:string;pct:number;error?:string};
const MAX=100*1024*1024;
const fmt=(n:number)=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(0)} KB`:`${(n/1048576).toFixed(1)} MB`;
const icon=(t:string)=>t.startsWith('image/')?<FileImage size={18}/>:t.startsWith('video/')?<FileVideo size={18}/>:t==='application/pdf'||t.startsWith('text/')?<FileText size={18}/>:<FileIcon size={18}/>;
async function post(endpoint:string,body:object){const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;}
// PUT straight to R2 with progress (XHR, since fetch has no upload progress).
function put(url:string,file:File,type:string,onPct:(n:number)=>void){
 return new Promise<void>((ok,bad)=>{const x=new XMLHttpRequest();x.open('PUT',url);x.setRequestHeader('Content-Type',type);
  x.upload.onprogress=e=>{if(e.lengthComputable)onPct(Math.round(e.loaded/e.total*100));};
  x.onload=()=>x.status<300?ok():bad(new Error('upload'));x.onerror=()=>bad(new Error('upload'));x.send(file);});
}

// Shared files on a lead/client. Same list in the Studio admin and the ZARN client space.
export default function LeadFiles({endpoint,leadId,initial,names,canUpload=true,me,preview=false}:{endpoint:string;leadId:string;initial:LeadFile[];names:Record<string,string>;canUpload?:boolean;me:string;preview?:boolean}){
 const [files,setFiles]=useState(initial),[ups,setUps]=useState<Up[]>([]),[drag,setDrag]=useState(false),[err,setErr]=useState('');
 const input=useRef<HTMLInputElement>(null),[viewing,setViewing]=useState<LeadFile|null>(null);
 const patch=(tmp:string,p:Partial<Up>)=>setUps(u=>u.map(x=>x.tmp===tmp?{...x,...p}:x));
 async function one(file:File){
  const tmp=crypto.randomUUID();setUps(u=>[...u,{tmp,name:file.name,pct:0}]);
  try{
   if(file.size>MAX)throw new Error('Over 100 MB');
   const {url,key,type}=await post(endpoint,{action:'sign',lead_id:leadId,name:file.name,type:file.type,size:file.size});
   let saved;
   try{await put(url,file,type,p=>patch(tmp,{pct:p}));saved=await post(endpoint,{action:'save',lead_id:leadId,key,name:file.name});}
   catch(e){
    if(e instanceof Error&&e.message!=='upload')throw e;
    // Direct upload blocked (bucket CORS not set yet): small files can still go through the server.
    if(file.size>4*1024*1024)throw new Error('Large uploads need the storage setup finished');
    const form=new FormData();form.set('lead_id',leadId);form.set('file',file);
    const r=await fetch(endpoint,{method:'POST',body:form});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Upload failed');saved=d;
   }
   setFiles(f=>[saved.file,...f]);setUps(u=>u.filter(x=>x.tmp!==tmp));
  }catch(e){patch(tmp,{error:e instanceof Error?e.message:'Upload failed'});}
 }
 const add=(list:FileList|null)=>{if(list)for(const f of Array.from(list).slice(0,20))void one(f);};
 async function remove(f:LeadFile){
  if(!confirm(`Delete ${f.name}?`))return;setErr('');
  try{await post(endpoint,{action:'delete',lead_id:leadId,id:f.id});setFiles(x=>x.filter(y=>y.id!==f.id));}catch(e){setErr(e instanceof Error?e.message:'Could not delete.');}
 }
 return <div className="lf">
  {canUpload&&<div className={`lf-drop${drag?' is-drag':''}`} role="button" tabIndex={0} onClick={()=>input.current?.click()} onKeyDown={e=>{if(e.key==='Enter')input.current?.click();}}
   onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);add(e.dataTransfer.files);}}>
   <UploadCloud size={26}/><b>Drop files here or tap to upload</b><small>Designs, briefs, contracts, photos. Up to 100 MB each. Everyone on this client can see them.</small>
   <input ref={input} type="file" multiple hidden onChange={e=>{add(e.target.files);e.target.value='';}}/>
  </div>}
  {ups.length>0&&<ul className="lf-list">{ups.map(u=><li key={u.tmp} className={u.error?'is-error':''}>
   <span className="lf-icon">{u.error?<FileIcon size={18}/>:<Loader2 size={18} className="lf-spin"/>}</span>
   <span className="lf-name"><b>{u.name}</b><small>{u.error?u.error:`Uploading… ${u.pct}%`}</small>{!u.error&&<i className="lf-bar"><i style={{width:`${u.pct}%`}}/></i>}</span>
   {u.error&&<button type="button" onClick={()=>setUps(x=>x.filter(y=>y.tmp!==u.tmp))}>Dismiss</button>}
  </li>)}</ul>}
  {viewing&&<DocViewer att={viewing} src={`${endpoint}?id=${viewing.id}&preview=1`} dl={`${endpoint}?id=${viewing.id}`} onClose={()=>setViewing(null)}/>}
  {err&&<p className="lf-err">{err}</p>}
  {files.length?<ul className="lf-list">{files.map(f=><li key={f.id}>
   <span className="lf-icon">{icon(f.type)}</span>
   {(()=>{const pv=preview&&docKind(f)!==null;const body=<><b title={f.name}>{f.name}</b><small>{fmt(f.size)} · {f.uploaded_by?(f.uploaded_by===me?'You':names[f.uploaded_by]??'Someone'):'Someone'} · {new Date(f.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</small></>;return pv?<button type="button" className="lf-name is-link" aria-label={`Preview ${f.name}`} onClick={()=>setViewing(f)}>{body}</button>:<span className="lf-name">{body}</span>;})()}
   <a href={`${endpoint}?id=${f.id}`} aria-label={`Download ${f.name}`} title="Download"><Download size={16}/></a>
   {canUpload&&<button type="button" className="lf-del" aria-label={`Delete ${f.name}`} title="Delete" onClick={()=>void remove(f)}><Trash2 size={15}/></button>}
  </li>)}</ul>:!ups.length&&<p className="lf-empty">No files yet.</p>}
 </div>;
}
