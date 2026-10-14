'use client';
import {useState} from 'react';
import {ArrowLeft,ArrowRight,Eye,EyeOff} from 'lucide-react';
import {useAdminTheme} from '@/lib/admin-theme';

type View='login'|'forgot'|'welcome'|'password';
const copy:Record<View,{title:string;sub:string}>={
 login:{title:'Sign in to ZARN',sub:'The Zaane team’s home for conversations and deals.'},
 forgot:{title:'Reset your password',sub:'Enter your ZARN email and we’ll send a reset link.'},
 welcome:{title:'Welcome to ZARN',sub:'Set up your profile and choose a password.'},
 password:{title:'Choose a new password',sub:'You’ll use it to sign in to ZARN.'},
};
async function post(body:object){const r=await fetch('/api/zarn/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;}
function Pw({name,label,auto}:{name:string;label:string;auto:string}){const [show,setShow]=useState(false);return <label className="zn-label">{label}<span className="zn-pw"><input className="zn-input" name={name} type={show?'text':'password'} autoComplete={auto} required minLength={name==='password'&&auto==='current-password'?1:8}/><button type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></span></label>;}

export default function ZarnAuth({initial,name='',title='',notice=''}:{initial:View;name?:string;title?:string;notice?:string}){
 const {light}=useAdminTheme();
 const [view,setView]=useState<View>(initial),[busy,setBusy]=useState(false),[msg,setMsg]=useState(notice),[sent,setSent]=useState(false);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setMsg('');const f=new FormData(e.currentTarget);
  try{
   if(view==='login'){await post({action:'login',email:f.get('email'),password:f.get('password')});window.location.assign('/zarn');}
   else if(view==='forgot'){await post({action:'forgot',email:f.get('email')});setSent(true);}
   else{
    if(f.get('password')!==f.get('confirm'))throw new Error('Passwords don’t match.');
    await post(view==='welcome'?{action:'welcome',password:f.get('password'),display_name:f.get('display_name'),title:f.get('title')}:{action:'password',password:f.get('password')});
    window.location.assign('/zarn');
   }
  }catch(err){setMsg(err instanceof Error?err.message:'Something went wrong.');}finally{setBusy(false);}
 }
 return <main className={`zarn-auth${light?' is-light':''}`}>
  <section className="zn-auth-brand"><span className="zn-logo zn-logo-lg">Z</span><h1>ZARN</h1><p>Channels, DMs and the studio pipeline, in one place. Invite-only for the Zaane team.</p></section>
  <section className="zn-auth-card">
   <h2>{copy[view].title}</h2><p className="zn-note">{copy[view].sub}</p>
   {sent?<div className="zn-ok">If that email belongs to a ZARN member, a reset link is on its way.</div>:
   <form onSubmit={submit} className="zn-auth-form">
    {(view==='login'||view==='forgot')&&<label className="zn-label">Email<input className="zn-input" name="email" type="email" autoComplete="email" required autoFocus/></label>}
    {view==='login'&&<Pw name="password" label="Password" auto="current-password"/>}
    {view==='welcome'&&<><label className="zn-label">Your name<input className="zn-input" name="display_name" required maxLength={80} defaultValue={name}/></label><label className="zn-label">Title (optional)<input className="zn-input" name="title" maxLength={80} defaultValue={title} placeholder="e.g. Product designer"/></label></>}
    {(view==='welcome'||view==='password')&&<><Pw name="password" label="Password (8+ characters)" auto="new-password"/><Pw name="confirm" label="Confirm password" auto="new-password"/></>}
    {msg&&<p className="zn-error" role="alert">{msg}</p>}
    <button className="zn-btn is-primary is-block" disabled={busy}>{busy?'Please wait…':view==='login'?'Sign in':view==='forgot'?'Send reset link':view==='welcome'?'Join ZARN':'Save password'}<ArrowRight size={16}/></button>
   </form>}
   {view==='login'&&<button type="button" className="zn-link" onClick={()=>{setView('forgot');setMsg('');}}>Forgot your password?</button>}
   {view==='forgot'&&<button type="button" className="zn-link" onClick={()=>{setView('login');setMsg('');setSent(false);}}><ArrowLeft size={14}/>Back to sign in</button>}
   <p className="zn-auth-foot">No account? ZARN is invite-only. Ask a Zaane admin.</p>
  </section>
 </main>;
}
