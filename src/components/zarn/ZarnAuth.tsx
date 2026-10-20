'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Eye,EyeOff,X} from 'lucide-react';
import {useAdminTheme} from '@/lib/admin-theme';

type View='login'|'welcome'|'password';
const copy:Record<View,{title:string;sub:string}>={
 login:{title:'Sign in to ZARN',sub:'The Zaane team’s home for conversations and deals.'},
 welcome:{title:'Welcome to ZARN',sub:'Set up your profile and choose a password.'},
 password:{title:'Choose a new password',sub:'You’ll use it to sign in to ZARN.'},
};
// Phone sign-in opens on a full-screen photo carousel, like a native app's welcome screen.
const slides=[
 {image:'/zarn-auth/brand.jpg',title:'The Zaane team, in one place',description:'Channels, DMs and calls for everyone building at Zaane.'},
 {image:'/zarn-auth/team.jpg',title:'Talk it through',description:'Threads, voice notes and files, right where the work happens.'},
 {image:'/zarn-auth/clients.jpg',title:'Clients and pipeline',description:'Client spaces, projects and deals, without switching apps.'},
];
async function post(body:object){const r=await fetch('/api/zarn/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;}
function Pw({name,label,auto}:{name:string;label:string;auto:string}){const [show,setShow]=useState(false);return <label className="zn-label">{label}<span className="zn-pw"><input className="zn-input" name={name} type={show?'text':'password'} autoComplete={auto} required minLength={name==='password'&&auto==='current-password'?1:8}/><button type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></span></label>;}

function Slides({onLogin,paused}:{onLogin:()=>void;paused:boolean}){
 const [active,setActive]=useState(0),scroller=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(paused)return;
  const t=setInterval(()=>{const el=scroller.current;if(!el)return;const next=(Math.round(el.scrollLeft/el.clientWidth)+1)%slides.length;el.scrollTo({left:next*el.clientWidth,behavior:'smooth'});},4500);
  return()=>clearInterval(t);
 },[paused]);
 const go=(i:number)=>{const el=scroller.current;if(el)el.scrollTo({left:i*el.clientWidth,behavior:'smooth'});};
 return <div className="zn-slides">
  <div ref={scroller} className="zn-slides-track" onScroll={e=>setActive(Math.round(e.currentTarget.scrollLeft/e.currentTarget.clientWidth))}>
   {slides.map((s,i)=><div key={s.image} className="zn-slide">
    <img src={s.image} alt="" loading={i?'lazy':'eager'} draggable={false}/>
    <div className="zn-slide-copy"><h2>{s.title}</h2><p>{s.description}</p></div>
   </div>)}
  </div>
  <div className="zn-slides-top">
   <div className="zn-slides-bars">{slides.map((s,i)=><button key={s.title} type="button" aria-label={`Go to slide ${i+1}`} onClick={()=>go(i)}><span className={i===active?'is-on':''}/></button>)}</div>
   <span className="zn-slides-brand"><img src="/zarnlogo.png" alt=""/>ZARN</span>
  </div>
  <div className="zn-slides-actions">
   <button type="button" className="zn-pill is-solid" onClick={onLogin}>Log in</button>
   <p>Invite-only for the Zaane team.</p>
  </div>
 </div>;
}

export default function ZarnAuth({initial,name='',title='',notice=''}:{initial:View;name?:string;title?:string;notice?:string}){
 const {light}=useAdminTheme();
 const [view]=useState<View>(initial),[busy,setBusy]=useState(false),[msg,setMsg]=useState(notice);
 // Phones: the sign-in form lives in a sheet that slides up from the carousel. An error notice opens it straight away.
 const [sheet,setSheet]=useState(!!notice);
 const email=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(!window.matchMedia('(max-width: 860px)').matches)email.current?.focus();},[]);
 function openSheet(){setSheet(true);email.current?.focus();}
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setMsg('');const f=new FormData(e.currentTarget);
  try{
   if(view==='login'){await post({action:'login',email:f.get('email'),password:f.get('password')});window.location.assign('/zarn');}
   else{
    if(f.get('password')!==f.get('confirm'))throw new Error('Passwords don’t match.');
    await post(view==='welcome'?{action:'welcome',password:f.get('password'),display_name:f.get('display_name'),title:f.get('title')}:{action:'password',password:f.get('password')});
    window.location.assign('/zarn');
   }
  }catch(err){setMsg(err instanceof Error?err.message:'Something went wrong.');}finally{setBusy(false);}
 }
 const login=view==='login';
 return <main className={`zarn-auth${light?' is-light':''}${login?' has-slides':''}${sheet?' is-sheet':''}`}>
  {login&&<Slides onLogin={openSheet} paused={sheet}/>}
  {login&&<div className="zn-sheet-scrim" onClick={()=>setSheet(false)}/>}
  <section className="zn-auth-brand"><span className="zn-auth-mark"><img src="/zarnlogo.png" alt="ZARN"/></span><h1>ZARN</h1><p>Channels, DMs and the studio pipeline, in one place. Invite-only for the Zaane team.</p></section>
  <section className="zn-auth-card" role={login?'dialog':undefined} aria-label={login?'Sign in':undefined}>
   {login&&<span className="zn-sheet-grab" aria-hidden/>}
   {login&&<button type="button" className="zn-sheet-close" aria-label="Close" onClick={()=>setSheet(false)}><X size={18}/></button>}
   <h2>{copy[view].title}</h2><p className="zn-note">{copy[view].sub}</p>
   <form onSubmit={submit} className="zn-auth-form">
    {login&&<label className="zn-label">Email<input ref={email} className="zn-input" name="email" type="email" autoComplete="email" autoCapitalize="none" required/></label>}
    {login&&<Pw name="password" label="Password" auto="current-password"/>}
    {view==='welcome'&&<><label className="zn-label">Your name<input className="zn-input" name="display_name" required maxLength={80} defaultValue={name}/></label><label className="zn-label">Title (optional)<input className="zn-input" name="title" maxLength={80} defaultValue={title} placeholder="e.g. Product designer"/></label></>}
    {(view==='welcome'||view==='password')&&<><Pw name="password" label="Password (8+ characters)" auto="new-password"/><Pw name="confirm" label="Confirm password" auto="new-password"/></>}
    {msg&&<p className="zn-error" role="alert">{msg}</p>}
    <button className="zn-btn is-primary is-block" disabled={busy}>{busy?'Please wait…':login?'Sign in':view==='welcome'?'Join ZARN':'Save password'}<ArrowRight size={16}/></button>
   </form>
   <p className="zn-auth-foot">No account? ZARN is invite-only. Ask a Zaane admin.</p>
  </section>
 </main>;
}
