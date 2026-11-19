'use client';
import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,AtSign,Check,CheckCircle2,Loader2} from 'lucide-react';
import {OTHER,isAsk,pagesOf,type Answers,type Form,type Q} from '@/lib/form';
import './form.css';
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// The form as people answer it: an optional cover picture and background photo, numbered questions,
// choices as tiles that fill with the form's colour, and a progress bar along the top.
export default function FormFill({id,title,form,who,preview=false,onExit}:{id:string;title:string;form:Form;who?:string|null;preview?:boolean;onExit?:()=>void}){
 const [a,setA]=useState<Answers>({}),[other,setOther]=useState<Record<string,string>>({}),[email,setEmail]=useState(''),[hp,setHp]=useState('');
 const [page,setPage]=useState(0),[bad,setBad]=useState<Set<string>>(new Set()),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[done,setDone]=useState(false);
 const color=form.set.color||'#673ab7';
 const needEmail=!!form.set.email&&!who;
 const set=(q:string,v:string|string[])=>{setA(x=>({...x,[q]:v}));setBad(s=>{if(!s.has(q))return s;const n=new Set(s);n.delete(q);return n;});};
 const val=(q:Q)=>{const v=a[q.id];if(q.t==='check')return ((v as string[]|undefined)??[]).map(s=>s===OTHER?`${OTHER}${other[q.id]??''}`:s);return v===OTHER?`${OTHER}${other[q.id]??''}`:v;};
 const pages=pagesOf(form.qs);
 const empty=(v:string|string[]|undefined)=>v===undefined||v===''||(Array.isArray(v)&&!v.length)||v===OTHER||(Array.isArray(v)&&v.includes(OTHER));
 // Question numbers run through the whole form, skipping headings and page breaks.
 const num=useMemo(()=>{const m:Record<string,number>={};let n=0;for(const q of form.qs)if(isAsk(q))m[q.id]=++n;return m;},[form.qs]);
 const asks=form.qs.filter(isAsk),answered=asks.filter(q=>!empty(val(q))).length;
 const progress=done?1:asks.length?answered/asks.length:0;
 const top=()=>{window.scrollTo({top:0,behavior:'smooth'});document.querySelector('.zfe-previewpage')?.scrollTo({top:0,behavior:'smooth'});};
 // Marks unanswered required questions; returns true if any (and scrolls to the first).
 function check(qs:Q[],withEmail:boolean){const miss=new Set<string>();
  for(const q of qs)if(isAsk(q)&&q.req&&empty(val(q)))miss.add(q.id);
  if(withEmail&&needEmail&&!EMAIL.test(email.trim()))miss.add('__email');
  setBad(miss);if(!miss.size)return false;
  setErr('A few questions still need an answer.');setTimeout(()=>document.querySelector('.zff-q.is-bad')?.scrollIntoView({behavior:'smooth',block:'center'}),30);return true;}
 async function submit(e:React.FormEvent){
  e.preventDefault();setErr('');
  if(page<pages.length-1){if(check(pages[page],page===0))return;setPage(p=>p+1);setErr('');top();return;}
  const out:Answers={};
  for(const q of form.qs){if(!isAsk(q))continue;const v=val(q);if(empty(v))continue;out[q.id]=v as string|string[];}
  if(check(form.qs,true)){const first=needEmail&&!EMAIL.test(email.trim())?0:pages.findIndex(p=>p.some(q=>q.req&&isAsk(q)&&empty(val(q))));if(first>=0&&first!==page)setPage(first);return;}
  if(preview){setDone(true);top();return;}
  setBusy(true);
  const r=await fetch('/api/zarn/forms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,answers:out,...(needEmail?{email:email.trim()}:{}),hp})}).catch(()=>null);
  const d=await r?.json().catch(()=>({}));setBusy(false);
  if(!r?.ok){setErr(d?.error||'Could not send your answers. Check your connection and try again.');return;}
  setDone(true);top();
 }
 function reset(){setA({});setOther({});setBad(new Set());setErr('');setPage(0);setDone(false);}
 const pg=page>0?pages[page][0]:null;
 return <div className={`zff${form.set.bg?' has-bg':''}`} style={{'--zff':color} as React.CSSProperties}>
  {form.set.bg&&<div className="zff-photo" style={{backgroundImage:`url("${form.set.bg}")`}} aria-hidden="true"/>}
  <div className="zff-bar" aria-hidden="true"><i style={{width:`${Math.round(progress*100)}%`}}/></div>
  {preview&&<div className="zff-preview"><span>Preview. Answers here aren’t saved.</span>{onExit&&<button type="button" onClick={onExit}>Back to editing</button>}</div>}
  <div className="zff-wrap">
   <header className="zff-hero">
    {form.set.cover?<div className="zff-cover"><img src={form.set.cover} alt=""/></div>:<div className="zff-band"/>}
    <div className="zff-hero-text">
     <h1>{pg?.title||title||'Untitled form'}</h1>
     {(pg?pg.help:form.desc)&&<p>{pg?pg.help:form.desc}</p>}
     {!done&&<div className="zff-meta">
      {who?<span className="zff-chip">Answering as {who}</span>:needEmail?<span className="zff-chip">Your email is saved with your answers</span>:null}
      {pages.length>1&&<span className="zff-chip">Step {page+1} of {pages.length}</span>}
      {asks.some(q=>q.req)&&<span className="zff-reqnote"><b>*</b> required</span>}
     </div>}
    </div>
   </header>
   {done?<section className="zff-sheet zff-done">
    <span className="zff-done-ic"><CheckCircle2 size={30}/></span>
    <h2>Thank you!</h2>
    <p>{form.set.done||'Your response has been recorded.'}</p>
    {!form.set.once&&<button type="button" className="zff-ghost" onClick={reset}>Send another response</button>}
   </section>:
   <form className="zff-sheet" onSubmit={submit} noValidate>
    {page===0&&needEmail&&<div className={`zff-q${bad.has('__email')?' is-bad':''}`}>
     <label className="zff-title" htmlFor="zff-email"><span className="zff-num"><AtSign size={14}/></span><span>Your email<span className="zff-req">*</span></span></label>
     <input id="zff-email" className="zff-field" type="email" autoComplete="email" value={email} onChange={e=>{setEmail(e.target.value);setBad(s=>{const n=new Set(s);n.delete('__email');return n;});}} placeholder="name@example.com"/>
     {bad.has('__email')&&<p className="zff-err">Enter a valid email address.</p>}
    </div>}
    {pages[page].filter(q=>q.t!=='page').map(q=>q.t==='section'?<div key={q.id} className="zff-heading"><h2>{q.title||'Untitled section'}</h2>{q.help&&<p>{q.help}</p>}</div>:
     <div key={q.id} className={`zff-q${bad.has(q.id)?' is-bad':''}`}>
      <div className="zff-title" id={`q-${q.id}`}><span className="zff-num">{num[q.id]}</span><span>{q.title||'Untitled question'}{q.req&&<span className="zff-req">*</span>}</span></div>
      {q.help&&<p className="zff-help">{q.help}</p>}
      <Field q={q} v={a[q.id]} other={other[q.id]??''} onOther={s=>{setOther(o=>({...o,[q.id]:s}));if(s&&q.t==='radio')set(q.id,OTHER);if(s&&q.t==='check'&&!((a[q.id] as string[]|undefined)??[]).includes(OTHER))set(q.id,[...((a[q.id] as string[]|undefined)??[]),OTHER]);}} onChange={v=>set(q.id,v)}/>
      {bad.has(q.id)&&<p className="zff-err">This question needs an answer.</p>}
     </div>)}
    <input className="zff-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={e=>setHp(e.target.value)}/>
    {err&&<p className="zff-formerr" role="alert">{err}</p>}
    <div className="zff-foot">
     {page>0&&<button type="button" className="zff-ghost" onClick={()=>{setPage(p=>p-1);setErr('');setBad(new Set());top();}}><ArrowLeft size={16}/>Back</button>}
     <button type="submit" className="zff-submit" disabled={busy}>{busy?<Loader2 size={17} className="zff-spin"/>:null}{page<pages.length-1?'Continue':'Submit'}{!busy&&<ArrowRight size={17}/>}</button>
     <button type="button" className="zff-clear" onClick={reset}>Clear</button>
    </div>
   </form>}
   <p className="zff-brand">Made with ZARN Forms · Never share passwords here</p>
  </div>
 </div>;
}

function Field({q,v,other,onOther,onChange}:{q:Q;v:string|string[]|undefined;other:string;onOther:(s:string)=>void;onChange:(v:string|string[])=>void}){
 const opts=q.opts??[];
 if(q.t==='short')return <input className="zff-field" aria-labelledby={`q-${q.id}`} value={(v as string)??''} maxLength={1000} onChange={e=>onChange(e.target.value)} placeholder="Type your answer"/>;
 if(q.t==='para')return <textarea className="zff-field zff-area" aria-labelledby={`q-${q.id}`} value={(v as string)??''} maxLength={10000} rows={3} onChange={e=>{onChange(e.target.value);e.currentTarget.style.height='auto';e.currentTarget.style.height=`${e.currentTarget.scrollHeight}px`;}} placeholder="Type your answer"/>;
 if(q.t==='date')return <input className="zff-field zff-fit" type="date" aria-labelledby={`q-${q.id}`} value={(v as string)??''} onChange={e=>onChange(e.target.value)}/>;
 if(q.t==='time')return <input className="zff-field zff-fit" type="time" aria-labelledby={`q-${q.id}`} value={(v as string)??''} onChange={e=>onChange(e.target.value)}/>;
 if(q.t==='drop')return <select className="zff-field zff-select" aria-labelledby={`q-${q.id}`} value={(v as string)??''} onChange={e=>onChange(e.target.value)}><option value="">Choose an option</option>{opts.map(o=><option key={o} value={o}>{o}</option>)}</select>;
 if(q.t==='scale'){const lo=q.min??1,hi=q.max??5;return <div className="zff-scale-wrap">
  <div className="zff-scale" role="radiogroup" aria-labelledby={`q-${q.id}`}>
   {Array.from({length:hi-lo+1},(_,i)=>String(lo+i)).map(n=><label key={n} className={`zff-scale-n${v===n?' is-on':''}`}><input type="radio" name={q.id} checked={v===n} onChange={()=>onChange(n)}/>{n}</label>)}
  </div>
  {(q.lo||q.hi)&&<div className="zff-scale-legend"><span>{q.lo}</span><span>{q.hi}</span></div>}</div>;}
 const multi=q.t==='check',list=multi?((v as string[]|undefined)??[]):[];
 const on=(o:string)=>multi?list.includes(o):v===o;
 const pick=(o:string)=>multi?onChange(on(o)?list.filter(x=>x!==o):[...list,o]):onChange(o);
 const tile=(o:string,i:number,label:React.ReactNode)=><label key={o} className={`zff-tile${on(o)?' is-on':''}`}>
  <input type={multi?'checkbox':'radio'} name={q.id} checked={on(o)} onChange={()=>pick(o)}/>
  <span className={`zff-key${multi?' is-box':''}`}>{on(o)?<Check size={13} strokeWidth={3}/>:LETTERS[i]??''}</span>{label}</label>;
 return <div className="zff-tiles" role={multi?'group':'radiogroup'} aria-labelledby={`q-${q.id}`}>
  {multi&&<small className="zff-hint">Pick as many as you like</small>}
  {opts.map((o,i)=>tile(o,i,<span className="zff-tile-t">{o}</span>))}
  {q.other&&tile(OTHER,opts.length,<span className="zff-tile-t zff-tile-other">Other<input className="zff-other" value={other} maxLength={500} placeholder="Type here" onClick={e=>e.stopPropagation()} onChange={e=>onOther(e.target.value)} aria-label="Other answer"/></span>)}
  {!multi&&v&&!q.req&&<button type="button" className="zff-clear zff-unpick" onClick={()=>onChange('')}>Clear choice</button>}
 </div>;
}
