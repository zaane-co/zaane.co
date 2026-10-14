'use client';
import {useEffect,useRef,useState} from 'react';
import {AtSign,Briefcase,Loader2,Paperclip,Send,X} from 'lucide-react';
import {optimizeImage} from '@/components/admin/blog/shared';
import type {ZAttachment,ZLead,ZMember} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {Avatar,textToTokens} from './format';

type Upload=ZAttachment&{uploading?:boolean;error?:string;tmp:string};
// Message box: @mentions with autocomplete, file attachments, a CRM lead card, Enter to send.
export default function Composer({channelId,parentId,placeholder,onSent,onTyping,disabled}:{channelId:string;parentId?:string;placeholder:string;onSent?:()=>void;onTyping?:()=>void;disabled?:string}){
 const {me,members,db,lead,emit,people}=useZarn();
 const [text,setText]=useState(''),[files,setFiles]=useState<Upload[]>([]),[leadId,setLeadId]=useState<string|null>(null);
 const [mention,setMention]=useState<{q:string;start:number}|null>(null),[pick,setPick]=useState(0);
 const [leadPicker,setLeadPicker]=useState(false),[error,setError]=useState(''),[sending,setSending]=useState(false);
 const box=useRef<HTMLTextAreaElement>(null),fileInput=useRef<HTMLInputElement>(null);
 const draftKey=`zarn-draft-${channelId}-${parentId??''}`;
 useEffect(()=>{try{setText(localStorage.getItem(draftKey)??'');}catch{}},[draftKey]);
 useEffect(()=>{try{if(text)localStorage.setItem(draftKey,text);else localStorage.removeItem(draftKey);}catch{}},[text,draftKey]);
 useEffect(()=>{const el=box.current;if(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,240)+'px';}},[text]);
 useEffect(()=>{box.current?.focus();},[channelId,parentId]);

 // Guests only see people they share a channel with (RLS), so `members` is already scoped for them.
 const active=members.filter(m=>!m.deactivated_at&&m.user_id!==me.user_id&&people[m.user_id]);
 const options:({id:string;label:string;m?:ZMember})[]=mention?[...(('channel'.startsWith(mention.q.toLowerCase()))?[{id:'channel',label:'channel'}]:[]),...active.filter(m=>m.display_name.toLowerCase().includes(mention.q.toLowerCase())||(m.username??'').startsWith(mention.q.toLowerCase())).slice(0,7).map(m=>({id:m.user_id,label:m.display_name,m}))]:[];
 function onChange(v:string,caret:number){
  setText(v);onTyping?.();
  const before=v.slice(0,caret),hit=before.match(/(?:^|\s)@([\w .'-]{0,30})$/);
  if(hit&&!hit[1]!.includes('  ')){setMention({q:hit[1]!,start:caret-hit[1]!.length-1});setPick(0);}else setMention(null);
 }
 function choose(o:{label:string}){
  if(!mention)return;const el=box.current!,caret=el.selectionStart;
  const next=text.slice(0,mention.start)+'@'+o.label+' '+text.slice(caret);
  setText(next);setMention(null);
  requestAnimationFrame(()=>{const pos=mention.start+o.label.length+2;el.focus();el.setSelectionRange(pos,pos);});
 }
 async function addFiles(list:FileList|null){
  if(!list)return;
  for(const raw of Array.from(list).slice(0,10)){
   const tmp=crypto.randomUUID();
   setFiles(f=>[...f,{tmp,key:'',name:raw.name,size:raw.size,type:raw.type,uploading:true}]);
   try{
    const file=raw.type.startsWith('image/')&&raw.type!=='image/gif'&&raw.type!=='image/svg+xml'?await optimizeImage(raw):raw;
    const form=new FormData();form.set('channel_id',channelId);form.set('file',file);
    const r=await fetch('/api/zarn/files',{method:'POST',body:form});const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Upload failed.');
    setFiles(f=>f.map(x=>x.tmp===tmp?{...d,tmp}:x));
   }catch(e){setFiles(f=>f.map(x=>x.tmp===tmp?{...x,uploading:false,error:e instanceof Error?e.message:'Upload failed.'}:x));}
  }
 }
 async function send(){
  const body=textToTokens(text.trim(),members),ready=files.filter(f=>f.key&&!f.uploading&&!f.error);
  if((!body&&!ready.length&&!leadId)||sending)return;
  if(files.some(f=>f.uploading)){setError('Wait for uploads to finish.');return;}
  setSending(true);setError('');
  const msg={id:crypto.randomUUID(),channel_id:channelId,parent_id:parentId??null,user_id:me.user_id,body,attachments:ready.map(({key,name,size,type})=>({key,name,size,type})),lead_id:leadId};
  emit({table:'zarn_messages',type:'INSERT',row:{...msg,invoice_id:null,kind:'user',meta:{},reply_count:0,last_reply_at:null,pinned_at:null,edited_at:null,deleted_at:null,created_at:new Date().toISOString(),pending:true}});
  const {error:e}=await db.from('zarn_messages').insert(msg);
  setSending(false);
  if(e){emit({table:'zarn_messages',type:'DELETE',row:{...msg} as never});setError('Message not sent. Check your connection and try again.');return;}
  setText('');setFiles([]);setLeadId(null);onSent?.();
 }
 function onKey(e:React.KeyboardEvent<HTMLTextAreaElement>){
  if(mention&&options.length){
   if(e.key==='ArrowDown'){e.preventDefault();setPick(p=>(p+1)%options.length);return;}
   if(e.key==='ArrowUp'){e.preventDefault();setPick(p=>(p-1+options.length)%options.length);return;}
   if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();choose(options[pick]!);return;}
   if(e.key==='Escape'){setMention(null);return;}
  }
  if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}
 }
 if(disabled)return <div className="zn-composer is-disabled">{disabled}</div>;
 const l=leadId?lead(leadId):undefined;
 return <div className="zn-composer" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void addFiles(e.dataTransfer.files);}}>
  {mention&&options.length>0&&<ul className="zn-suggest" role="listbox">{options.map((o,i)=><li key={o.id} role="option" aria-selected={i===pick} className={i===pick?'is-on':''} onMouseDown={e=>{e.preventDefault();choose(o);}}>{o.m?<Avatar m={o.m} size={22}/>:<AtSign size={16}/>}<b>{o.label}</b>{o.m&&<small>{o.m.username?`@${o.m.username}`:''}{o.m.username&&o.m.title?' · ':''}{o.m.title}</small>}{!o.m&&<small>Notify everyone in this channel</small>}</li>)}</ul>}
  {(files.length>0||leadId)&&<div className="zn-attach-row">
   {files.map(f=><span key={f.tmp} className={`zn-chip${f.error?' is-error':''}`} title={f.error}>{f.uploading?<Loader2 size={13} className="zn-spin"/>:<Paperclip size={13}/>}{f.name}<button type="button" aria-label="Remove" onClick={()=>setFiles(x=>x.filter(y=>y.tmp!==f.tmp))}><X size={12}/></button></span>)}
   {leadId&&<span className="zn-chip"><Briefcase size={13}/>{l?.company||l?.name||'Lead'}<button type="button" aria-label="Remove lead" onClick={()=>setLeadId(null)}><X size={12}/></button></span>}
  </div>}
  <textarea ref={box} rows={1} value={text} placeholder={placeholder} maxLength={8000} onChange={e=>onChange(e.target.value,e.target.selectionStart)} onKeyDown={onKey} onPaste={e=>{if(e.clipboardData.files.length){e.preventDefault();void addFiles(e.clipboardData.files);}}} aria-label="Message"/>
  <div className="zn-composer-bar">
   <button type="button" aria-label="Attach files" data-tip="Attach files (4 MB each)" onClick={()=>fileInput.current?.click()}><Paperclip size={17}/></button>
   <input ref={fileInput} type="file" multiple hidden onChange={e=>{void addFiles(e.target.files);e.target.value='';}}/>
   <button type="button" aria-label="Mention someone" data-tip="Mention someone" onClick={()=>{const el=box.current!;const pos=el.selectionStart;const v=text.slice(0,pos)+(pos&&!/\s$/.test(text.slice(0,pos))?' @':'@')+text.slice(pos);onChange(v,v.length-(text.length-pos));el.focus();}}><AtSign size={17}/></button>
   {me.can_view_crm&&<button type="button" aria-label="Attach a CRM lead" data-tip="Share a CRM lead" onClick={()=>setLeadPicker(true)}><Briefcase size={17}/></button>}
   <small className="zn-hint">*bold* _italic_ `code` · Shift+Enter for a new line</small>
   <button type="button" className="zn-send" aria-label="Send" disabled={sending||(!text.trim()&&!files.length&&!leadId)} onClick={()=>void send()}><Send size={16}/></button>
  </div>
  {error&&<p className="zn-error">{error}</p>}
  {leadPicker&&<LeadPicker onClose={()=>setLeadPicker(false)} onPick={id=>{setLeadId(id);setLeadPicker(false);box.current?.focus();}}/>}
 </div>;
}

export function LeadPicker({onClose,onPick}:{onClose:()=>void;onPick:(id:string)=>void}){
 const {db,loadLead}=useZarn();
 const [q,setQ]=useState(''),[rows,setRows]=useState<ZLead[]>([]);
 useEffect(()=>{
  const t=setTimeout(async()=>{
   let query=db.from('zarn_leads').select('*').order('last_activity_at',{ascending:false}).limit(20);
   const s=q.trim().replace(/[%,()]/g,'');if(s)query=query.or(`name.ilike.%${s}%,company.ilike.%${s}%`);
   const {data}=await query;setRows((data??[]) as ZLead[]);
  },200);return()=>clearTimeout(t);
 },[q,db]);
 return <div className="zn-modal-scrim" onClick={onClose}><div className="zn-modal" role="dialog" aria-label="Share a lead" onClick={e=>e.stopPropagation()}>
  <div className="zn-modal-head"><h2>Share a CRM lead</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
  <input className="zn-input" autoFocus placeholder="Search by name or company" value={q} onChange={e=>setQ(e.target.value)}/>
  <ul className="zn-list">{rows.map(l=><li key={l.id}><button type="button" onClick={()=>{loadLead(l.id);onPick(l.id);}}><span className="zn-stage-dot" style={{background:l.stage_color??'#52525b'}}/><span><b>{l.name}</b><small>{[l.company,l.stage_label].filter(Boolean).join(' · ')}</small></span></button></li>)}
   {!rows.length&&<li className="zn-empty-row">No leads found.</li>}</ul>
 </div></div>;
}
