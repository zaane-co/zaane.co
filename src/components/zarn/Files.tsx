'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {Download,FileText,Files as FilesIcon,Lock,Loader2,Paperclip,Search,Send,Share2,Trash2,Upload,Users,X} from 'lucide-react';
import {channelHref,type ZAttachment,type ZMessage} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {dayOf} from './format';
import {Modal,PeoplePicker} from './Dialogs';
import DocViewer,{docKind} from './DocViewer';
import VoicePlayer from './VoicePlayer';
import Dropdown from '@/components/ui/Dropdown';
import {optimizeImage} from '@/components/admin/blog/shared';

type Origin={type:'chat';channel_id:string}|{type:'mine';file_id:string;shared_with:string[]}|{type:'shared';file_id:string};
type Item={key:string;a:ZAttachment;at:string;user_id:string|null;src:string;origin:Origin};
type Kind='all'|'images'|'voice'|'documents'|'other';
type Scope='all'|'mine'|'shared'|'chats';
const PRIVATE='private';
const isAudio=(a:ZAttachment)=>a.type.startsWith('audio/');
const isImage=(a:ZAttachment)=>a.type.startsWith('image/')&&a.type!=='image/svg+xml';
const isDoc=(a:ZAttachment)=>/pdf|word|document|sheet|excel|presentation|powerpoint|text\//.test(a.type)||/\.(pdf|docx?|xlsx?|pptx?|csv|txt|md)$/i.test(a.name);
const size=(n:number)=>n>1024*1024?`${(n/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(n/1024))} KB`;
type FileRow={id:string;owner_id:string;name:string;size:number;type:string;key:string;created_at:string};

// Your own files (private until you share them), files shared with you, and everything posted in your conversations.
export default function Files(){
 const {db,me,people,channels,title}=useZarn();
 const [items,setItems]=useState<Item[]>([]),[loading,setLoading]=useState(true),[q,setQ]=useState(''),[kind,setKind]=useState<Kind>('all'),[scope,setScope]=useState<Scope>('all');
 const [uploading,setUploading]=useState(false),[docOpen,setDocOpen]=useState<Item|null>(null),[dropped,setDropped]=useState<File[]>([]),[sharing,setSharing]=useState<Item|null>(null),[posting,setPosting]=useState<Item|null>(null),[removing,setRemoving]=useState<Item|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{
  const [{data:msgs},{data:files},{data:shares}]=await Promise.all([
   db.from('zarn_messages').select('id,channel_id,user_id,attachments,created_at').neq('attachments','[]').is('deleted_at',null).order('created_at',{ascending:false}).limit(500),
   db.from('zarn_files').select('id,owner_id,name,size,type,key,created_at').order('created_at',{ascending:false}).limit(500),
   db.from('zarn_file_shares').select('file_id,user_id'),
  ]);
  const withUsers:Record<string,string[]>={};for(const s of (shares??[]) as {file_id:string;user_id:string}[])(withUsers[s.file_id]??=[]).push(s.user_id);
  const chat=((msgs??[]) as (Pick<ZMessage,'id'|'channel_id'|'user_id'|'created_at'>&{attachments:ZAttachment[]})[]).flatMap(m=>(m.attachments??[]).map((a,i):Item=>({key:`${m.id}:${i}`,a,at:m.created_at,user_id:m.user_id,src:`/api/zarn/files?m=${m.id}&i=${i}`,origin:{type:'chat',channel_id:m.channel_id}})));
  const own=((files??[]) as FileRow[]).map((f):Item=>({key:`f:${f.id}`,a:{key:f.key,name:f.name,size:f.size,type:f.type},at:f.created_at,user_id:f.owner_id,src:`/api/zarn/files?f=${f.id}`,origin:f.owner_id===me.user_id?{type:'mine',file_id:f.id,shared_with:withUsers[f.id]??[]}:{type:'shared',file_id:f.id}}));
  setItems([...own,...chat].sort((x,y)=>y.at.localeCompare(x.at)));setLoading(false);
 },[db,me.user_id]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves, not synchronously
 useEffect(()=>{void load();},[load]);
 const inScope=(x:Item)=>scope==='all'||(scope==='mine'?x.origin.type==='mine':scope==='shared'?x.origin.type==='shared':x.origin.type==='chat');
 const match=(x:Item,k:Kind)=>k==='all'||(k==='images'?isImage(x.a):k==='voice'?isAudio(x.a):k==='documents'?!isImage(x.a)&&!isAudio(x.a)&&isDoc(x.a):!isImage(x.a)&&!isAudio(x.a)&&!isDoc(x.a));
 const scoped=useMemo(()=>items.filter(inScope),[items,scope]); // eslint-disable-line react-hooks/exhaustive-deps
 const counts=useMemo(()=>({all:scoped.length,images:scoped.filter(x=>match(x,'images')).length,voice:scoped.filter(x=>match(x,'voice')).length,documents:scoped.filter(x=>match(x,'documents')).length,other:scoped.filter(x=>match(x,'other')).length}),[scoped]);
 const scopeCount=(s:Scope)=>items.filter(x=>s==='all'||(s==='mine'?x.origin.type==='mine':s==='shared'?x.origin.type==='shared':x.origin.type==='chat')).length;
 const shown=scoped.filter(x=>match(x,kind)&&`${x.a.name} ${people[x.user_id??'']?.display_name??''}`.toLowerCase().includes(q.toLowerCase()));
 const where=(id:string)=>{const c=channels.find(x=>x.id===id);return c?(c.kind==='dm'||c.kind==='client'||c.kind==='project'?title(c):`#${c.name}`):'a channel';};
 async function remove(x:Item){
  if(x.origin.type==='chat')return;
  setError('');
  try{
   if(x.origin.type==='mine'){const r=await fetch(`/api/zarn/files?f=${x.origin.file_id}`,{method:'DELETE'});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Could not delete it.');}
   else await db.from('zarn_file_shares').delete().eq('file_id',x.origin.file_id).eq('user_id',me.user_id);
   setRemoving(null);void load();
  }catch(e){setError(e instanceof Error?e.message:'Could not delete it.');}
 }
 const scopes:[Scope,string][]=[['all','Everything'],['mine','My files'],['shared','Shared with me'],['chats','In chats']];
 return <div className="zn-page" onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();}} onDrop={e=>{if(!e.dataTransfer.files.length)return;e.preventDefault();setDropped(Array.from(e.dataTransfer.files));setUploading(true);}}>
  {docOpen&&<DocViewer att={docOpen.a} src={docOpen.src} dl={`${docOpen.src}&download=1`} onClose={()=>setDocOpen(null)}/>}
  {uploading&&<UploadDialog initial={dropped} onClose={()=>{setUploading(false);setDropped([]);}} onDone={()=>{setUploading(false);setDropped([]);void load();}}/>}
  {sharing&&sharing.origin.type==='mine'&&<PeoplePicker title={`Share “${sharing.a.name}”`} confirm="Share" exclude={sharing.origin.shared_with} onClose={()=>setSharing(null)} onPick={async ids=>{
   const o=sharing.origin as Extract<Origin,{type:'mine'}>;
   const {error:e}=await db.from('zarn_file_shares').insert(ids.map(u=>({file_id:o.file_id,user_id:u})));
   if(e)throw new Error('Could not share it.');setSharing(null);void load();}}/>}
  {posting&&<PostDialog item={posting} onClose={()=>setPosting(null)} onDone={()=>{setPosting(null);void load();}}/>}
  {removing&&<Modal title={removing.origin.type==='mine'?'Delete this file?':'Remove from your list?'} onClose={()=>setRemoving(null)}><div className="zn-modal-body">
   <p>{removing.origin.type==='mine'?`“${removing.a.name}” is deleted for you and for anyone you shared it with. Copies you already posted in chats stay there.`:`You’ll no longer see “${removing.a.name}”. The owner still has it.`}</p>
   <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={()=>setRemoving(null)}>Cancel</button><button type="button" className="zn-btn is-danger" onClick={()=>void remove(removing)}><Trash2 size={14}/>{removing.origin.type==='mine'?'Delete':'Remove'}</button></div></div></Modal>}
  <header className="zn-page-head"><div><h1><FilesIcon size={20}/>Files</h1><p>Your own files are private until you share them. Files from chats show up here too.</p></div><button type="button" className="zn-btn is-primary" onClick={()=>setUploading(true)}><Upload size={14}/>Upload</button></header>
  <div className="zn-tools">
   <label className="zn-tool-search"><Search size={15}/><input placeholder="Search by file name or person" value={q} onChange={e=>setQ(e.target.value)} aria-label="Search files"/></label>
   <div className="zn-pills" role="tablist" aria-label="Where">{scopes.map(([k,l])=><button key={k} type="button" role="tab" aria-selected={scope===k} className={scope===k?'is-on':''} onClick={()=>setScope(k)}>{l} <span>{scopeCount(k)}</span></button>)}</div>
   <div className="zn-pills" role="tablist" aria-label="File type">{(['all','images','voice','documents','other'] as const).map(k=><button key={k} type="button" role="tab" aria-selected={kind===k} className={kind===k?'is-on':''} onClick={()=>setKind(k)}>{k==='all'?'All':k==='voice'?'Voice notes':k[0].toUpperCase()+k.slice(1)} <span>{counts[k]}</span></button>)}</div>
  </div>
  {error&&<p className="zn-error" role="alert" style={{padding:'0 24px'}}>{error}</p>}
  <div className="zn-crm-list" data-lenis-prevent>
   {loading?<p className="zn-loading">Loading…</p>:shown.length?<div className="zn-file-grid">{shown.map(x=>{const dl=`${x.src}&download=1`;return <article key={x.key} className="zn-file-card">
    {isAudio(x.a)?<div className="zn-file-voice"><VoicePlayer src={x.src} att={x.a}/></div>
     :isImage(x.a)?<a href={x.src} target="_blank" rel="noopener noreferrer" className="zn-file-thumb" aria-label={`Open ${x.a.name}`}><img src={x.src} alt={x.a.name} loading="lazy"/></a>
     :docKind(x.a)?<button type="button" className="zn-file-thumb is-doc" aria-label={`Preview ${x.a.name}`} onClick={()=>setDocOpen(x)}><FileText size={30}/><em>{(x.a.name.split('.').pop()||'file').slice(0,5)}</em></button>
     :<a href={dl} className="zn-file-thumb is-doc" aria-label={`Download ${x.a.name}`}><FileText size={30}/><em>{(x.a.name.split('.').pop()||'file').slice(0,5)}</em></a>}
    <div className="zn-file-meta"><b title={x.a.name}>{x.a.name}</b><small>{size(x.a.size)} · {x.origin.type==='shared'?`Shared by ${people[x.user_id??'']?.display_name??'someone'}`:people[x.user_id??'']?.display_name??'Someone'} · {dayOf(x.at)}</small>
     <div className="zn-file-links">
      {x.origin.type==='chat'?<Link href={channelHref(channels.find(c=>c.id===(x.origin as {channel_id:string}).channel_id),x.origin.channel_id)}>{where(x.origin.channel_id)}</Link>
       :x.origin.type==='mine'?<span className="zn-file-private">{x.origin.shared_with.length?<><Users size={12}/>Shared with {x.origin.shared_with.length}</>:<><Lock size={12}/>Only you</>}</span>
       :<span className="zn-file-private"><Users size={12}/>Shared with you</span>}
      <span className="zn-file-actions">
       {x.origin.type==='mine'&&<><button type="button" aria-label={`Share ${x.a.name}`} data-tip="Share with people" onClick={()=>setSharing(x)}><Share2 size={13}/></button><button type="button" aria-label={`Post ${x.a.name} in a chat`} data-tip="Post in a chat" onClick={()=>setPosting(x)}><Send size={13}/></button></>}
       <a href={dl} aria-label={`Download ${x.a.name}`} data-tip="Download"><Download size={13}/></a>
       {x.origin.type!=='chat'&&<button type="button" aria-label={`Remove ${x.a.name}`} data-tip={x.origin.type==='mine'?'Delete':'Remove'} onClick={()=>setRemoving(x)}><Trash2 size={13}/></button>}
      </span></div></div>
   </article>;})}</div>
   :<div className="zn-empty-state"><h2>{items.length?'No files match':'No files yet'}</h2><p>{items.length?'Try another search or filter.':'Upload a file to keep it here, private to you. Files shared in chats show up here too.'}</p></div>}
  </div>
 </div>;
}

// Upload: private to you by default. Posting in a conversation is a separate, deliberate choice.
function UploadDialog({initial,onClose,onDone}:{initial:File[];onClose:()=>void;onDone:()=>void}){
 const {db,me,channels,membership,title}=useZarn();
 const dests=channels.filter(c=>membership[c.id]&&!c.archived_at);
 const [dest,setDest]=useState(PRIVATE),[files,setFiles]=useState<File[]>(initial.slice(0,10)),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const pick=useRef<HTMLInputElement>(null);
 const label=(c:typeof dests[number])=>c.kind==='dm'||c.kind==='client'||c.kind==='project'?title(c):`#${c.name}`;
 const personal=dest===PRIVATE;
 async function go(){
  if(!files.length||busy)return;
  setBusy(true);setErr('');
  try{
   const attachments:ZAttachment[]=[];
   for(const raw of files){
    const file=raw.type.startsWith('image/')&&raw.type!=='image/gif'&&raw.type!=='image/svg+xml'?await optimizeImage(raw):raw;
    const form=new FormData();if(personal)form.set('scope','personal');else form.set('channel_id',dest);form.set('file',file);
    const r=await fetch('/api/zarn/files',{method:'POST',body:form});const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(`${raw.name}: ${d.error||'Upload failed.'}`);
    attachments.push({key:d.key,name:d.name,size:d.size,type:d.type});
   }
   if(!personal){
    const id=crypto.randomUUID();
    const {error}=await db.from('zarn_messages').insert({id,channel_id:dest,parent_id:null,user_id:me.user_id,body:note.trim(),attachments,lead_id:null});
    if(error)throw new Error('The files uploaded but the message could not be posted.');
    void fetch('/api/zarn/push/notify',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({message_id:id})}).catch(()=>{});
   }
   onDone();
  }catch(e){setErr(e instanceof Error?e.message:'Upload failed.');setBusy(false);}
 }
 return <Modal title="Upload files" onClose={busy?()=>{}:onClose}>
  <div className="zn-modal-body">
   <button type="button" className="zn-drop" onClick={()=>pick.current?.click()}><Upload size={20}/><b>Choose files or drop them here</b><small>Up to 10 files, 4 MB each</small></button>
   <input ref={pick} type="file" multiple hidden onChange={e=>{setFiles(f=>[...f,...Array.from(e.target.files??[])].slice(0,10));e.target.value='';}}/>
   {files.length>0&&<div className="zn-chips">{files.map((f,i)=><span key={`${f.name}-${i}`} className="zn-chip"><Paperclip size={13}/>{f.name}<button type="button" aria-label={`Remove ${f.name}`} disabled={busy} onClick={()=>setFiles(x=>x.filter((_,j)=>j!==i))}><X size={12}/></button></span>)}</div>}
   <div className="zn-label">Save to<Dropdown label="Save to" value={dest} onChange={setDest} options={[{value:PRIVATE,label:'My files (only me)',group:'Private'},...dests.map(c=>({value:c.id,label:label(c),group:c.kind==='dm'?'Post in a direct message':c.kind==='client'?'Post in a client space':'Post in a channel'}))]}/></div>
   <p className={`zn-upload-note${personal?' is-private':''}`}>{personal?<><Lock size={13}/>Only you can see this. You can share it with specific people later.</>:<>This will be posted as a message and everyone in {label(dests.find(c=>c.id===dest)!)} will see it.</>}</p>
   {!personal&&<label className="zn-label">Message (optional)<input className="zn-input" value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder="Add a note"/></label>}
   {err&&<p className="zn-error" role="alert">{err}</p>}
  </div>
  <div className="zn-modal-foot"><button type="button" className="zn-btn" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="zn-btn is-primary" disabled={busy||!files.length} onClick={()=>void go()}>{busy?<><Loader2 size={14} className="zn-spin"/>Uploading…</>:personal?`Save ${files.length||''}`:`Post ${files.length||''}`}</button></div>
 </Modal>;
}

// Post one of your private files in a conversation, on purpose.
function PostDialog({item,onClose,onDone}:{item:Item;onClose:()=>void;onDone:()=>void}){
 const {db,me,channels,membership,title}=useZarn();
 const dests=channels.filter(c=>membership[c.id]&&!c.archived_at);
 const [dest,setDest]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const label=(c:typeof dests[number])=>c.kind==='dm'||c.kind==='client'||c.kind==='project'?title(c):`#${c.name}`;
 async function go(){
  if(!dest||busy)return;setBusy(true);setErr('');
  const id=crypto.randomUUID();
  const {error}=await db.from('zarn_messages').insert({id,channel_id:dest,parent_id:null,user_id:me.user_id,body:note.trim(),attachments:[item.a],lead_id:null});
  if(error){setErr('Could not post it there.');setBusy(false);return;}
  void fetch('/api/zarn/push/notify',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({message_id:id})}).catch(()=>{});
  onDone();
 }
 const target=dests.find(c=>c.id===dest);
 return <Modal title={`Post “${item.a.name}”`} onClose={busy?()=>{}:onClose}><div className="zn-modal-body">
  <div className="zn-label">Post in<Dropdown label="Post in" value={dest} onChange={setDest} placeholder="Choose a conversation" options={dests.map(c=>({value:c.id,label:label(c),group:c.kind==='dm'?'Direct messages':c.kind==='client'?'Clients':'Channels'}))}/></div>
  {target&&<p className="zn-upload-note">Everyone in {label(target)} will be able to open this file.</p>}
  <label className="zn-label">Message (optional)<input className="zn-input" value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder="Add a note"/></label>
  {err&&<p className="zn-error" role="alert">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="zn-btn is-primary" disabled={busy||!dest} onClick={()=>void go()}>{busy?'Posting…':'Post'}</button></div>
 </div></Modal>;
}
