'use client';
import {useState} from 'react';
import {CheckCircle2,Loader2} from 'lucide-react';
import {OTHER,isAsk,pagesOf,type Answers,type Form,type Q} from '@/lib/form';
import './form.css';
// The form as people answer it, Google Forms style: a coloured header card, one card per question, Submit at the end.
export default function FormFill({id,title,form,who,preview=false,onExit}:{id:string;title:string;form:Form;who?:string|null;preview?:boolean;onExit?:()=>void}){
 const [a,setA]=useState<Answers>({}),[other,setOther]=useState<Record<string,string>>({}),[email,setEmail]=useState(''),[hp,setHp]=useState('');
 const [page,setPage]=useState(0),[bad,setBad]=useState<Set<string>>(new Set()),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[done,setDone]=useState(false);
 const color=form.set.color||'#673ab7';
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
      <Field q={q} v={a[q.id]} other={other[q.id]??''} onOther={s=>{setOther(o=>({...o,[q.id]:s}));if(s&&q.t==='radio')set(q.id,OTHER);if(s&&q.t==='check'&&!((a[q.id] as string[]|undefined)??[]).includes(OTHER))set(q.id,[...((a[q.id] as string[]|undefined)??[]),OTHER]);}} onChange={v=>set(q.id,v)}/>
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
