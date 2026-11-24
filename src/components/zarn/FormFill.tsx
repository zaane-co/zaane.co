'use client';
import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,File as FileIcon,Loader2,Upload,X} from 'lucide-react';
import {FILE_KINDS,OTHER,acceptOf,fileBytes,fileKindOk,isAsk,newQid,pagesOf,parseFile,sizeName,type Answers,type Form,type Q} from '@/lib/form';
import './form.css';
// The form as people answer it, Google Forms style: a coloured header card, one card per question, Submit at the end.
export default function FormFill({id,title,form,who,preview=false,onExit}:{id:string;title:string;form:Form;who?:string|null;preview?:boolean;onExit?:()=>void}){
 const [a,setA]=useState<Answers>({}),[other,setOther]=useState<Record<string,string>>({}),[email,setEmail]=useState(''),[hp,setHp]=useState('');
 const [page,setPage]=useState(0),[bad,setBad]=useState<Set<string>>(new Set()),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[done,setDone]=useState(false);
 const [loading,setLoading]=useState<Set<string>>(new Set());
 const color=form.set.color||'#673ab7';
 const addFile=(q:string,f:string)=>{setA(x=>({...x,[q]:[...((x[q] as string[]|undefined)??[]),f]}));setBad(s=>{if(!s.has(q))return s;const n=new Set(s);n.delete(q);return n;});};
 const onBusy=(q:string,on:boolean)=>setLoading(s=>{if(s.has(q)===on)return s;const n=new Set(s);if(on)n.add(q);else n.delete(q);return n;});
 const needEmail=!!form.set.email&&!who;
 const set=(q:string,v:string|string[])=>{setA(x=>({...x,[q]:v}));setBad(s=>{if(!s.has(q))return s;const n=new Set(s);n.delete(q);return n;});};
 const val=(q:Q)=>{const v=a[q.id];if(q.t==='check')return ((v as string[]|undefined)??[]).map(s=>s===OTHER?`${OTHER}${other[q.id]??''}`:s);return v===OTHER?`${OTHER}${other[q.id]??''}`:v;};
 const pages=pagesOf(form.qs);
 const empty=(v:string|string[]|undefined)=>v===undefined||v===''||(Array.isArray(v)&&!v.length)||v===OTHER||(Array.isArray(v)&&v.includes(OTHER));
 // Marks unanswered required questions in the list; returns true if any (and scrolls to the first).
 function check(qs:Q[],withEmail:boolean){const miss=new Set<string>();
  for(const q of qs)if(isAsk(q)&&q.req&&empty(val(q)))miss.add(q.id);
  if(withEmail&&needEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))miss.add('__email');
  setBad(miss);if(!miss.size)return false;
  setErr('Some questions need an answer.');setTimeout(()=>document.querySelector('.zff-card.is-bad')?.scrollIntoView({behavior:'smooth',block:'center'}),30);return true;}
 async function submit(e:React.FormEvent){
  e.preventDefault();setErr('');
  if(loading.size){setErr('Wait for your files to finish uploading.');return;}
  const out:Answers={};
  if(page<pages.length-1){if(check(pages[page],page===0))return;setPage(p=>p+1);setErr('');window.scrollTo({top:0});document.querySelector('.zfe-previewpage')?.scrollTo({top:0});return;}
  for(const q of form.qs){if(!isAsk(q))continue;const v=val(q);if(empty(v))continue;out[q.id]=v as string|string[];}
  if(check(form.qs,true)){const emailBad=needEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());const first=emailBad?0:pages.findIndex(p=>p.some(q=>q.req&&isAsk(q)&&empty(val(q))));if(first>=0&&first!==page)setPage(first);return;}
  if(preview){setDone(true);return;}
  setBusy(true);
  const r=await fetch('/api/zarn/forms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,answers:out,...(needEmail?{email:email.trim()}:{}),hp})}).catch(()=>null);
  const d=await r?.json().catch(()=>({}));setBusy(false);
  if(!r?.ok){setErr(d?.error||'Could not send your answers. Check your connection and try again.');return;}
  setDone(true);window.scrollTo({top:0,behavior:'smooth'});
 }
 const head=<div className="zff-card zff-head"><h1>{title||'Untitled form'}</h1>{form.desc&&<p className="zff-desc">{form.desc}</p>}
  {!done&&<div className="zff-meta">{who?<span>Answering as <b>{who}</b></span>:needEmail?<span>Your email is recorded with your answers.</span>:null}{form.qs.some(q=>q.req)&&<span className="zff-reqnote">* Required</span>}</div>}</div>;
 return <div className="zff" style={{'--zff':color} as React.CSSProperties}>
  {preview&&<div className="zff-preview"><span>Preview. Answers here aren’t saved.</span>{onExit&&<button type="button" onClick={onExit}>Back to editing</button>}</div>}
  <div className="zff-wrap">
   {done?<>{head}<div className="zff-card zff-done"><CheckCircle2 size={34}/><p>{form.set.done||'Your response has been recorded.'}</p>
    {!form.set.once&&<button type="button" className="zff-link" onClick={()=>{setA({});setOther({});setPage(0);setDone(false);}}>Submit another response</button>}</div></>:
   <form onSubmit={submit} noValidate>
    {page===0?head:<div className="zff-card zff-head zff-pagehead"><h1>{pages[page][0]?.title||title||'Untitled form'}</h1>{pages[page][0]?.help&&<p className="zff-desc">{pages[page][0].help}</p>}</div>}
    {page===0&&needEmail&&<div className={`zff-card${bad.has('__email')?' is-bad':''}`}><label className="zff-q">Email<span className="zff-req">*</span></label>
     <input className="zff-text" type="email" autoComplete="email" value={email} onChange={e=>{setEmail(e.target.value);setBad(s=>{const n=new Set(s);n.delete('__email');return n;});}} placeholder="Your email"/>
     {bad.has('__email')&&<p className="zff-err">Enter a valid email address.</p>}</div>}
    {pages[page].filter(q=>q.t!=='page').map(q=>q.t==='section'?<div key={q.id} className="zff-card zff-section"><h2>{q.title||'Untitled section'}</h2>{q.help&&<p>{q.help}</p>}</div>:
     <div key={q.id} className={`zff-card${bad.has(q.id)?' is-bad':''}`}>
      <div className="zff-q" id={`q-${q.id}`}>{q.title||'Untitled question'}{q.req&&<span className="zff-req">*</span>}</div>
      {q.help&&<p className="zff-help">{q.help}</p>}
      {q.t==='file'?<FileField q={q} formId={id} preview={preview} v={a[q.id]} onAdd={f=>addFile(q.id,f)} onRemove={f=>set(q.id,((a[q.id] as string[]|undefined)??[]).filter(x=>x!==f))} onBusy={on=>onBusy(q.id,on)}/>:
      <Field q={q} v={a[q.id]} other={other[q.id]??''} onOther={s=>{setOther(o=>({...o,[q.id]:s}));if(s&&q.t==='radio')set(q.id,OTHER);if(s&&q.t==='check'&&!((a[q.id] as string[]|undefined)??[]).includes(OTHER))set(q.id,[...((a[q.id] as string[]|undefined)??[]),OTHER]);}} onChange={v=>set(q.id,v)}/>}
      {bad.has(q.id)&&<p className="zff-err">This is a required question</p>}
     </div>)}
    <input className="zff-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={e=>setHp(e.target.value)}/>
    {err&&<p className="zff-formerr" role="alert">{err}</p>}
    <div className="zff-foot"><span className="zff-nav">{page>0&&<button type="button" className="zff-back" onClick={()=>{setPage(p=>p-1);setErr('');setBad(new Set());}}>Back</button>}
     <button type="submit" className="zff-submit" disabled={busy}>{busy&&<Loader2 size={16} className="zff-spin"/>}{page<pages.length-1?'Next':'Submit'}</button>
     {pages.length>1&&<span className="zff-progress" aria-label={`Page ${page+1} of ${pages.length}`}><i style={{width:`${(page+1)/pages.length*100}%`}}/></span>}{pages.length>1&&<small className="zff-pageof">Page {page+1} of {pages.length}</small>}</span>
     <button type="button" className="zff-link" onClick={()=>{setA({});setOther({});setBad(new Set());setErr('');setPage(0);}}>Clear form</button></div>
   </form>}
   <p className="zff-brand">Made with ZARN Forms. Never share passwords here.</p>
  </div>
 </div>;
}

function Field({q,v,other,onOther,onChange}:{q:Q;v:string|string[]|undefined;other:string;onOther:(s:string)=>void;onChange:(v:string|string[])=>void}){
 const opts=q.opts??[];
 if(q.t==='short')return <input className="zff-text" aria-labelledby={`q-${q.id}`} value={(v as string)??''} maxLength={1000} onChange={e=>onChange(e.target.value)} placeholder="Your answer"/>;
 if(q.t==='para')return <textarea className="zff-text zff-area" aria-labelledby={`q-${q.id}`} value={(v as string)??''} maxLength={10000} rows={3} onChange={e=>{onChange(e.target.value);e.currentTarget.style.height='auto';e.currentTarget.style.height=`${e.currentTarget.scrollHeight}px`;}} placeholder="Your answer"/>;
 if(q.t==='date')return <input className="zff-text zff-short" type="date" aria-labelledby={`q-${q.id}`} value={(v as string)??''} onChange={e=>onChange(e.target.value)}/>;
 if(q.t==='time')return <input className="zff-text zff-short" type="time" aria-labelledby={`q-${q.id}`} value={(v as string)??''} onChange={e=>onChange(e.target.value)}/>;
 if(q.t==='drop')return <select className="zff-select" aria-labelledby={`q-${q.id}`} value={(v as string)??''} onChange={e=>onChange(e.target.value)}><option value="">Choose</option>{opts.map(o=><option key={o} value={o}>{o}</option>)}</select>;
 if(q.t==='scale'){const lo=q.min??1,hi=q.max??5;return <div className="zff-scale" role="radiogroup" aria-labelledby={`q-${q.id}`}>
  {q.lo&&<span className="zff-scale-end">{q.lo}</span>}
  {Array.from({length:hi-lo+1},(_,i)=>String(lo+i)).map(n=><label key={n} className="zff-scale-n"><span>{n}</span><input type="radio" name={q.id} checked={v===n} onChange={()=>onChange(n)}/><i/></label>)}
  {q.hi&&<span className="zff-scale-end">{q.hi}</span>}
  {(q.lo||q.hi)&&<div className="zff-scale-legend"><span>{q.lo&&`${lo}: ${q.lo}`}</span><span>{q.hi&&`${hi}: ${q.hi}`}</span></div>}</div>;}
 const multi=q.t==='check',list=multi?((v as string[]|undefined)??[]):[];
 const on=(o:string)=>multi?list.includes(o):v===o;
 const pick=(o:string)=>multi?onChange(on(o)?list.filter(x=>x!==o):[...list,o]):onChange(o);
 return <div className="zff-opts" role={multi?'group':'radiogroup'} aria-labelledby={`q-${q.id}`}>
  {opts.map(o=><label key={o} className="zff-opt"><input type={multi?'checkbox':'radio'} name={q.id} checked={on(o)} onChange={()=>pick(o)}/><i className={multi?'is-box':''}/><span>{o}</span></label>)}
  {q.other&&<label className="zff-opt"><input type={multi?'checkbox':'radio'} name={q.id} checked={on(OTHER)} onChange={()=>pick(OTHER)}/><i className={multi?'is-box':''}/><span>Other:</span><input className="zff-text zff-other" value={other} maxLength={500} onChange={e=>onOther(e.target.value)} aria-label="Other answer"/></label>}
  {!multi&&v&&!q.req&&<button type="button" className="zff-link zff-clear" onClick={()=>onChange('')}>Clear selection</button>}
 </div>;
}

// PUT straight to storage with progress (XHR, since fetch has no upload progress).
function put(url:string,file:File,type:string,onPct:(n:number)=>void){
 return new Promise<void>((ok,bad)=>{const x=new XMLHttpRequest();x.open('PUT',url);x.setRequestHeader('Content-Type',type);
  x.upload.onprogress=e=>{if(e.lengthComputable)onPct(Math.round(e.loaded/e.total*100));};
  x.onload=()=>x.status<300?ok():bad(new Error('upload'));x.onerror=()=>bad(new Error('upload'));x.send(file);});
}
type Up={id:string;name:string;size:number;pct:number;err?:string};
// A file upload question: pick or drop files, each one uploads right away with a progress bar.
function FileField({q,formId,preview,v,onAdd,onRemove,onBusy}:{q:Q;formId:string;preview:boolean;v:string|string[]|undefined;onAdd:(f:string)=>void;onRemove:(f:string)=>void;onBusy:(on:boolean)=>void}){
 const list=Array.isArray(v)?v:[],max=q.maxN??1,mb=q.maxMb??100;
 const [ups,setUps]=useState<Up[]>([]),[err,setErr]=useState(''),[drag,setDrag]=useState(false),input=useRef<HTMLInputElement>(null);
 const going=ups.some(u=>!u.err);
 useEffect(()=>{onBusy(going);},[going,onBusy]);
 const room=max-list.length-ups.filter(u=>!u.err).length;
 const kinds=q.kinds?.length?q.kinds.map(k=>FILE_KINDS.find(x=>x.k===k)?.label).join(', '):'Any file';
 function add(files:File[]){
  setErr('');
  const pick=files.slice(0,Math.max(0,room));
  if(files.length>pick.length)setErr(max===1?'Only one file can be added here.':`You can add up to ${max} files.`);
  for(const file of pick){
   if(!fileKindOk(q,file.name,file.type)){setErr(`${file.name} isn’t a file type this question takes.`);continue;}
   if(file.size>mb*1048576){setErr(`${file.name} is bigger than ${sizeName(mb)}.`);continue;}
   const id=newQid();setUps(u=>[...u,{id,name:file.name,size:file.size,pct:0}]);
   void (async()=>{try{
    if(preview)onAdd(`preview/${id}|${file.size}|${file.name}`);
    else{
     const r=await fetch('/api/zarn/forms/file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:formId,q:q.id,name:file.name,type:file.type,size:file.size})});
     const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Could not start the upload.');
     await put(d.url,file,d.type,pct=>setUps(u=>u.map(x=>x.id===id?{...x,pct}:x)));
     onAdd(`${d.key}|${file.size}|${file.name}`);
    }
    setUps(u=>u.filter(x=>x.id!==id));
   }catch(e){const m=(e as Error).message;setUps(u=>u.map(x=>x.id===id?{...x,err:m==='upload'?'Upload failed. Check your connection and try again.':m}:x));}})();
  }
 }
 return <div className={`zff-files${drag?' is-drag':''}`} onDragOver={e=>{if(room>0){e.preventDefault();setDrag(true);}}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);if(room>0)add([...e.dataTransfer.files]);}}>
  {list.map(f=>{const p=parseFile(f);return p&&<div key={f} className="zff-file"><FileIcon size={18}/><span className="zff-file-n" title={p.name}>{p.name}</span><small>{fileBytes(p.size)}</small>
   <button type="button" className="zff-file-x" aria-label={`Remove ${p.name}`} onClick={()=>onRemove(f)}><X size={16}/></button></div>;})}
  {ups.map(u=><div key={u.id} className={`zff-file${u.err?' is-err':''}`}>{u.err?<FileIcon size={18}/>:<Loader2 size={18} className="zff-spin"/>}
   <span className="zff-file-n" title={u.name}>{u.name}{u.err?<em>{u.err}</em>:<span className="zff-file-bar"><i style={{width:`${u.pct}%`}}/></span>}</span><small>{u.err?'':`${u.pct}%`}</small>
   {u.err&&<button type="button" className="zff-file-x" aria-label={`Dismiss ${u.name}`} onClick={()=>setUps(l=>l.filter(x=>x.id!==u.id))}><X size={16}/></button>}</div>)}
  {room>0&&<button type="button" className="zff-addfile" aria-labelledby={`q-${q.id}`} onClick={()=>input.current?.click()}><Upload size={16}/>Add file</button>}
  <input ref={input} type="file" hidden multiple={max>1} accept={acceptOf(q)||undefined} onChange={e=>{add([...(e.target.files??[])]);e.target.value='';}}/>
  <p className="zff-filenote">{kinds}. Up to {max} file{max===1?'':'s'}, {sizeName(mb)} each{room>0?'. You can also drop files here.':'.'}</p>
  {err&&<p className="zff-err">{err}</p>}
 </div>;
}
