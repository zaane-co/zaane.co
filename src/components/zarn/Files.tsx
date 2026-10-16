'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {Download,FileText,Files as FilesIcon,Loader2,Paperclip,Search,Upload,X} from 'lucide-react';
import {channelHref,type ZAttachment,type ZMessage} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {dayOf} from './format';
import {Modal} from './Dialogs';
import Dropdown from '@/components/ui/Dropdown';
import {optimizeImage} from '@/components/admin/blog/shared';

type Item={key:string;m:Pick<ZMessage,'id'|'channel_id'|'user_id'|'created_at'>;i:number;a:ZAttachment};
type Kind='all'|'images'|'documents'|'other';
const isImage=(a:ZAttachment)=>a.type.startsWith('image/')&&a.type!=='image/svg+xml';
const isDoc=(a:ZAttachment)=>/pdf|word|document|sheet|excel|presentation|powerpoint|text\//.test(a.type)||/\.(pdf|docx?|xlsx?|pptx?|csv|txt|md)$/i.test(a.name);
const size=(n:number)=>n>1024*1024?`${(n/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(n/1024))} KB`;

// Every file shared in the conversations you can read, newest first.
export default function Files(){
 const {db,people,channels,title}=useZarn();
 const [items,setItems]=useState<Item[]>([]),[loading,setLoading]=useState(true),[q,setQ]=useState(''),[kind,setKind]=useState<Kind>('all'),[uploading,setUploading]=useState(false),[dropped,setDropped]=useState<File[]>([]);
 const load=useCallback(async()=>{
  const {data}=await db.from('zarn_messages').select('id,channel_id,user_id,attachments,created_at').neq('attachments','[]').is('deleted_at',null).order('created_at',{ascending:false}).limit(500);
  const rows=(data??[]) as (Item['m']&{attachments:ZAttachment[]})[];
  setItems(rows.flatMap(m=>(m.attachments??[]).map((a,i)=>({key:`${m.id}:${i}`,m:{id:m.id,channel_id:m.channel_id,user_id:m.user_id,created_at:m.created_at},i,a}))));
  setLoading(false);
 },[db]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves, not synchronously
 useEffect(()=>{void load();},[load]);
 const counts=useMemo(()=>({all:items.length,images:items.filter(x=>isImage(x.a)).length,documents:items.filter(x=>!isImage(x.a)&&isDoc(x.a)).length,other:items.filter(x=>!isImage(x.a)&&!isDoc(x.a)).length}),[items]);
 const shown=items.filter(x=>(kind==='all'||(kind==='images'?isImage(x.a):kind==='documents'?!isImage(x.a)&&isDoc(x.a):!isImage(x.a)&&!isDoc(x.a)))&&`${x.a.name} ${people[x.m.user_id??'']?.display_name??''}`.toLowerCase().includes(q.toLowerCase()));
 const where=(id:string)=>{const c=channels.find(x=>x.id===id);return c?(c.kind==='dm'||c.kind==='client'?title(c):`#${c.name}`):'a channel';};
 return <div className="zn-page" onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();}} onDrop={e=>{if(!e.dataTransfer.files.length)return;e.preventDefault();setDropped(Array.from(e.dataTransfer.files));setUploading(true);}}>
  {uploading&&<UploadDialog initial={dropped} onClose={()=>{setUploading(false);setDropped([]);}} onDone={()=>{setUploading(false);setDropped([]);void load();}}/>}
  <header className="zn-page-head"><div><h1><FilesIcon size={20}/>Files</h1><p>Everything shared in the conversations you’re part of.</p></div><button type="button" className="zn-btn is-primary" onClick={()=>setUploading(true)}><Upload size={14}/>Upload</button></header>
  <div className="zn-tools">
   <label className="zn-tool-search"><Search size={15}/><input placeholder="Search by file name or person" value={q} onChange={e=>setQ(e.target.value)} aria-label="Search files"/></label>
   <div className="zn-pills" role="tablist" aria-label="File type">{(['all','images','documents','other'] as const).map(k=><button key={k} type="button" role="tab" aria-selected={kind===k} className={kind===k?'is-on':''} onClick={()=>setKind(k)}>{k==='all'?'All':k[0].toUpperCase()+k.slice(1)} <span>{counts[k]}</span></button>)}</div>
  </div>
  <div className="zn-crm-list" data-lenis-prevent>
   {loading?<p className="zn-loading">Loading…</p>:shown.length?<div className="zn-file-grid">{shown.map(x=>{const c=channels.find(ch=>ch.id===x.m.channel_id);return <article key={x.key} className="zn-file-card">
    {isImage(x.a)?<a href={`/api/zarn/files?m=${x.m.id}&i=${x.i}`} target="_blank" rel="noopener noreferrer" className="zn-file-thumb" aria-label={`Open ${x.a.name}`}><img src={`/api/zarn/files?m=${x.m.id}&i=${x.i}`} alt={x.a.name} loading="lazy"/></a>
     :<a href={`/api/zarn/files?m=${x.m.id}&i=${x.i}&download=1`} className="zn-file-thumb is-doc" aria-label={`Download ${x.a.name}`}><FileText size={30}/><em>{(x.a.name.split('.').pop()||'file').slice(0,5)}</em></a>}
    <div className="zn-file-meta"><b title={x.a.name}>{x.a.name}</b><small>{size(x.a.size)} · {people[x.m.user_id??'']?.display_name??'Someone'} · {dayOf(x.m.created_at)}</small>
     <div className="zn-file-links"><Link href={channelHref(c,x.m.channel_id)}>{where(x.m.channel_id)}</Link><a href={`/api/zarn/files?m=${x.m.id}&i=${x.i}&download=1`} aria-label={`Download ${x.a.name}`}><Download size={13}/></a></div></div>
   </article>;})}</div>
   :<div className="zn-empty-state"><h2>{items.length?'No files match':'No files yet'}</h2><p>{items.length?'Try another search or type.':'Files you or your team attach to messages show up here.'}</p></div>}
  </div>
 </div>;
}

// Upload from the Files page: pick where to share it, and the files are posted there as a message.
function UploadDialog({initial,onClose,onDone}:{initial:File[];onClose:()=>void;onDone:()=>void}){
 const {db,me,channels,membership,title}=useZarn();
 const dests=channels.filter(c=>membership[c.id]&&!c.archived_at);
 const [dest,setDest]=useState(dests.find(c=>c.kind==='public')?.id??dests[0]?.id??''),[files,setFiles]=useState<File[]>(initial.slice(0,10)),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const pick=useRef<HTMLInputElement>(null);
 const label=(c:typeof dests[number])=>c.kind==='dm'||c.kind==='client'?title(c):`#${c.name}`;
 async function go(){
  if(!dest||!files.length||busy)return;
  setBusy(true);setErr('');
  try{
   const attachments:ZAttachment[]=[];
   for(const raw of files){
    const file=raw.type.startsWith('image/')&&raw.type!=='image/gif'&&raw.type!=='image/svg+xml'?await optimizeImage(raw):raw;
    const form=new FormData();form.set('channel_id',dest);form.set('file',file);
    const r=await fetch('/api/zarn/files',{method:'POST',body:form});const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(`${raw.name}: ${d.error||'Upload failed.'}`);
    attachments.push({key:d.key,name:d.name,size:d.size,type:d.type});
   }
   const id=crypto.randomUUID();
   const {error}=await db.from('zarn_messages').insert({id,channel_id:dest,parent_id:null,user_id:me.user_id,body:note.trim(),attachments,lead_id:null});
   if(error)throw new Error('The files uploaded but the message could not be posted.');
   void fetch('/api/zarn/push/notify',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({message_id:id})}).catch(()=>{});
   onDone();
  }catch(e){setErr(e instanceof Error?e.message:'Upload failed.');setBusy(false);}
 }
 return <Modal title="Upload files" onClose={busy?()=>{}:onClose}>
  <div className="zn-modal-body">
   <div className="zn-label">Share in<Dropdown label="Share in" value={dest} onChange={setDest} placeholder="Choose a conversation" options={dests.map(c=>({value:c.id,label:label(c),group:c.kind==='dm'?'Direct messages':c.kind==='client'?'Clients':'Channels'}))}/></div>
   <button type="button" className="zn-drop" onClick={()=>pick.current?.click()}><Upload size={20}/><b>Choose files or drop them here</b><small>Up to 10 files, 4 MB each</small></button>
   <input ref={pick} type="file" multiple hidden onChange={e=>{setFiles(f=>[...f,...Array.from(e.target.files??[])].slice(0,10));e.target.value='';}}/>
   {files.length>0&&<div className="zn-chips">{files.map((f,i)=><span key={`${f.name}-${i}`} className="zn-chip"><Paperclip size={13}/>{f.name}<button type="button" aria-label={`Remove ${f.name}`} disabled={busy} onClick={()=>setFiles(x=>x.filter((_,j)=>j!==i))}><X size={12}/></button></span>)}</div>}
   <label className="zn-label">Message (optional)<input className="zn-input" value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder="Add a note"/></label>
   {err&&<p className="zn-error" role="alert">{err}</p>}
  </div>
  <div className="zn-modal-foot"><button type="button" className="zn-btn" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="zn-btn is-primary" disabled={busy||!files.length||!dest} onClick={()=>void go()}>{busy?<><Loader2 size={14} className="zn-spin"/>Uploading…</>:`Upload ${files.length||''}`}</button></div>
 </Modal>;
}
