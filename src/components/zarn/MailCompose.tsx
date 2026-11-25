'use client';
import {useRef,useState} from 'react';
import {Bold,Italic,Underline,List,ListOrdered,Link2,RemoveFormatting,Paperclip,Send,Trash2,Minus,Maximize2,Minimize2,X,Loader2} from 'lucide-react';
import {useConfirm} from './ConfirmProvider';

export type ComposeInit={to:string[];cc:string[];subject:string;reply?:{folderId:string;messageId:string;mode:'reply'|'replyall'|'forward'}};
type Att={id:string;name:string;size:number;pct:number;state:'up'|'done'|'err';err?:string;zoho?:{storeName:string;attachmentName:string;attachmentPath:string};link?:{key:string;name:string;size:number}};
const DIRECT=3.5*1024*1024,MAX=5*1024**3;
const okAddr=(s:string)=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
const size=(b:number)=>b<1024*1024?`${Math.max(1,Math.round(b/1024))} KB`:b<1024**3?`${(b/1024/1024).toFixed(1)} MB`:`${(b/1024**3).toFixed(2)} GB`;

// Upload with progress. Resolves with the parsed JSON (for our own routes) or nothing (for a signed R2 link).
function xhr(method:string,url:string,body:Document|XMLHttpRequestBodyInit,onPct:(n:number)=>void,type?:string){
 return new Promise<unknown>((res,rej)=>{const x=new XMLHttpRequest();x.open(method,url);if(type)x.setRequestHeader('Content-Type',type);
  x.upload.onprogress=e=>{if(e.lengthComputable)onPct(Math.round(e.loaded/e.total*100));};
  x.onload=()=>{let j:{error?:string}|null=null;try{j=x.responseText?JSON.parse(x.responseText):null;}catch{}
   if(x.status>=200&&x.status<300)res(j);else rej(new Error(j?.error??'Upload failed. Try again.'));};
  x.onerror=()=>rej(new Error('Upload failed. Check your connection.'));x.send(body);});
}

function Recipients({label,list,setList,extra,auto}:{label:string;list:string[];setList:(l:string[])=>void;extra?:React.ReactNode;auto?:boolean}){
 const [t,setT]=useState('');
 const add=(raw:string)=>{const parts=raw.split(/[,;\s]+/).map(x=>x.trim().replace(/^<|>$/g,'')).filter(Boolean);if(!parts.length)return;
  setList([...list,...parts.filter(p=>!list.some(l=>l.toLowerCase()===p.toLowerCase()))]);setT('');};
 return <div className="zmc-field" onClick={e=>(e.currentTarget.querySelector('input') as HTMLInputElement|null)?.focus()}>
  <span className="zmc-lbl">{label}</span>
  <div className="zmc-chips">{list.map(a=><span key={a} className={`zmc-chip${okAddr(a)?'':' is-bad'}`} title={okAddr(a)?a:'Check this address'}>{a}
   <button type="button" aria-label={`Remove ${a}`} onClick={e=>{e.stopPropagation();setList(list.filter(x=>x!==a));}}><X size={12}/></button></span>)}
   <input value={t} autoFocus={auto} type="email" multiple aria-label={label} onChange={e=>{const v=e.target.value;if(/[,;]\s*$/.test(v))add(v);else setT(v);}}
    onKeyDown={e=>{if((e.key==='Enter'||e.key==='Tab')&&t.trim()){e.preventDefault();add(t);}else if(e.key==='Backspace'&&!t&&list.length)setList(list.slice(0,-1));}}
    onPaste={e=>{const v=e.clipboardData.getData('text');if(/[,;\s]/.test(v.trim())){e.preventDefault();add(v);}}} onBlur={()=>add(t)}/></div>
  {extra}
 </div>;
}

export default function MailCompose({init,from,onClose,onSent}:{init:ComposeInit;from:string;onClose:()=>void;onSent:()=>void}){
 const confirm=useConfirm();
 const [to,setTo]=useState(init.to),[cc,setCc]=useState(init.cc),[bcc,setBcc]=useState<string[]>([]),[showCc,setShowCc]=useState(init.cc.length>0),[showBcc,setShowBcc]=useState(false);
 const [subject,setSubject]=useState(init.subject),[atts,setAtts]=useState<Att[]>([]),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const [view,setView]=useState<'dock'|'min'|'big'>('dock');
 const ed=useRef<HTMLDivElement>(null),pick=useRef<HTMLInputElement>(null);
 const title=init.reply?init.reply.mode==='forward'?'Forward':'Reply':'New message';
 const patch=(id:string,p:Partial<Att>)=>setAtts(l=>l.map(a=>a.id===id?{...a,...p}:a));
 const cmd=(c:string,v?:string)=>{ed.current?.focus();document.execCommand(c,false,v);};

 async function addFiles(files:FileList|File[]){
  for(const f of Array.from(files)){
   const id=crypto.randomUUID();
   if(f.size>MAX){setAtts(l=>[...l,{id,name:f.name,size:f.size,pct:0,state:'err',err:'Over 5 GB'}]);continue;}
   setAtts(l=>[...l,{id,name:f.name,size:f.size,pct:0,state:'up'}]);
   try{
    if(f.size<=DIRECT){const fd=new FormData();fd.append('file',f);
     const z=await xhr('POST','/api/zarn/mail/attach',fd,p=>patch(id,{pct:p})) as Att['zoho'];patch(id,{state:'done',pct:100,zoho:z});}
    else{
     const r=await fetch('/api/zarn/mail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'link_sign',name:f.name,type:f.type,size:f.size})});
     const j=await r.json();if(!r.ok)throw new Error(j.error??'Upload failed.');
     await xhr('PUT',j.url,f,p=>patch(id,{pct:p}),f.type||'application/octet-stream');
     patch(id,{state:'done',pct:100,link:{key:j.key,name:f.name,size:f.size}});
    }
   }catch(e){patch(id,{state:'err',err:(e as Error).message});}
  }
 }
 const empty=()=>!to.length&&!cc.length&&!subject.trim()&&!(ed.current?.innerText.trim())&&!atts.length;
 async function discard(){if(empty()||await confirm({title:'Discard this email?',message:'What you’ve written will be lost.',confirm:'Discard',danger:true}))onClose();}
 async function send(){
  setErr('');
  const all=[...to,...cc,...bcc];
  if(!to.length)return setErr('Add who it’s to.');
  if(all.some(a=>!okAddr(a)))return setErr('One of the addresses doesn’t look right. It’s marked in red.');
  if(atts.some(a=>a.state==='up'))return setErr('Wait for your files to finish uploading.');
  const html=ed.current?.innerHTML??'';
  if(!subject.trim()&&!(ed.current?.innerText.trim())&&!await confirm({title:'Send without a subject or message?',message:'',confirm:'Send'}))return;
  setBusy(true);
  try{
   const r=await fetch('/api/zarn/mail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'send',to:to.join(','),cc:cc.join(','),bcc:bcc.join(','),subject,html,
    attachments:atts.filter(a=>a.zoho).map(a=>a.zoho),links:atts.filter(a=>a.link).map(a=>a.link),reply:init.reply})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error??'Could not send. Try again.');
   window.dispatchEvent(new CustomEvent('zarn-toast',{detail:'Email sent'}));onSent();
  }catch(e){setErr((e as Error).message);setBusy(false);}
 }

 return <div className={`zmc is-${view}`} role="dialog" aria-label={title}
  onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();}} onDrop={e=>{if(e.dataTransfer.files.length){e.preventDefault();void addFiles(e.dataTransfer.files);}}}>
  <header className="zmc-head" onClick={()=>view==='min'&&setView('dock')}>
   <b>{subject.trim()||title}</b>
   <button type="button" aria-label={view==='min'?'Open':'Minimise'} onClick={e=>{e.stopPropagation();setView(v=>v==='min'?'dock':'min');}}><Minus size={16}/></button>
   <button type="button" className="zmc-big-btn" aria-label={view==='big'?'Smaller':'Bigger'} onClick={e=>{e.stopPropagation();setView(v=>v==='big'?'dock':'big');}}>{view==='big'?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button>
   <button type="button" aria-label="Close" onClick={e=>{e.stopPropagation();void discard();}}><X size={16}/></button>
  </header>
  {view!=='min'&&<>
   <div className="zmc-from"><span className="zmc-lbl">From</span>{from}</div>
   <Recipients label="To" list={to} setList={setTo} auto={!init.to.length} extra={<span className="zmc-ccbtns">{!showCc&&<button type="button" onClick={()=>setShowCc(true)}>Cc</button>}{!showBcc&&<button type="button" onClick={()=>setShowBcc(true)}>Bcc</button>}</span>}/>
   {showCc&&<Recipients label="Cc" list={cc} setList={setCc}/>}
   {showBcc&&<Recipients label="Bcc" list={bcc} setList={setBcc}/>}
   <div className="zmc-field"><input className="zmc-subject" value={subject} maxLength={500} placeholder="Subject" onChange={e=>setSubject(e.target.value)}/></div>
   <div className="zmc-body" data-lenis-prevent>
    <div ref={ed} className="zmc-editor" contentEditable suppressContentEditableWarning role="textbox" aria-multiline aria-label="Message" data-ph="Write your message" autoFocus={!!init.to.length}
     onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();void send();}}}/>
    {init.reply&&<p className="zmc-quote-note">{init.reply.mode==='forward'?'The original email is added below your message.':'The earlier email is quoted below your reply.'}</p>}
    {atts.length>0&&<div className="zmc-atts">{atts.map(a=><div key={a.id} className={`zmc-att is-${a.state}`}>
     <Paperclip size={13}/><span className="zmc-att-name">{a.name}</span>
     <small>{a.state==='err'?a.err:a.state==='up'?`${a.pct}%`:a.link?`${size(a.size)} · sent as link`:size(a.size)}</small>
     <button type="button" aria-label={`Remove ${a.name}`} onClick={()=>setAtts(l=>l.filter(x=>x.id!==a.id))}><X size={13}/></button>
     {a.state==='up'&&<i style={{width:`${a.pct}%`}}/>}</div>)}</div>}
   </div>
   {err&&<p className="zmc-err" role="alert">{err}</p>}
   <footer className="zmc-foot">
    <button type="button" className="zn-btn is-primary zmc-send" disabled={busy} onClick={()=>void send()}>{busy?<Loader2 size={15} className="zn-spin"/>:<Send size={15}/>}{busy?'Sending…':'Send'}</button>
    <div className="zmc-tools" role="toolbar" aria-label="Formatting">
     {([[Bold,'bold','Bold'],[Italic,'italic','Italic'],[Underline,'underline','Underline'],[List,'insertUnorderedList','Bullet list'],[ListOrdered,'insertOrderedList','Numbered list']] as const).map(([I,c,l])=>
      <button key={c} type="button" aria-label={l} data-tip={l} onMouseDown={e=>{e.preventDefault();cmd(c);}}><I size={16}/></button>)}
     <button type="button" aria-label="Link" data-tip="Link" onMouseDown={e=>{e.preventDefault();const u=prompt('Link address');if(u)cmd('createLink',/^(https?:|mailto:)/i.test(u)?u:`https://${u}`);}}><Link2 size={16}/></button>
     <button type="button" aria-label="Clear formatting" data-tip="Clear formatting" onMouseDown={e=>{e.preventDefault();cmd('removeFormat');}}><RemoveFormatting size={16}/></button>
     <span className="zmc-sep"/>
     <button type="button" aria-label="Attach files" data-tip="Attach files" onClick={()=>pick.current?.click()}><Paperclip size={16}/></button>
     <input ref={pick} type="file" multiple hidden onChange={e=>{if(e.target.files)void addFiles(e.target.files);e.target.value='';}}/>
    </div>
    <button type="button" className="zmc-trash" aria-label="Discard" data-tip="Discard" onClick={()=>void discard()}><Trash2 size={16}/></button>
   </footer>
  </>}
 </div>;
}
