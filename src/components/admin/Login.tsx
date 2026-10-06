'use client';
import {useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,Eye,EyeOff,Moon,Sun} from 'lucide-react';

type View='login'|'forgot'|'reset';
const copy:Record<View,{title:string;sub:string}>={
 login:{title:'Welcome back',sub:'Sign in to your admin dashboard.'},
 forgot:{title:'Reset your password',sub:'Enter your staff email and we’ll send you a reset link.'},
 reset:{title:'Set a new password',sub:'Choose a new password for your admin account.'},
};

async function post(body:Record<string,unknown>){const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw new Error(result.error);return result;}

function PasswordField({name,placeholder,autoComplete,label}:{name:string;placeholder:string;autoComplete:string;label:string}){
 const [show,setShow]=useState(false);
 return <label>{label}<span className="admin-login-pw"><input type={show?'text':'password'} name={name} autoComplete={autoComplete} placeholder={placeholder} required/><button type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>;
}

export default function Login({configured,initialView='login',notice=''}:{configured:boolean;initialView?:View;notice?:string}){
 const [view,setView]=useState<View>(initialView);
 const [message,setMessage]=useState(notice);const [sent,setSent]=useState(false);const [busy,setBusy]=useState(false);
 const [light,setLight]=useState(false);
 const go=(v:View)=>{setView(v);setMessage('');setSent(false);};
 const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();setBusy(true);setMessage('');const data=new FormData(e.currentTarget);try{
  if(view==='login'){await post({email:data.get('email'),password:data.get('password')});window.location.assign('/admin');}
  else if(view==='forgot'){await post({action:'forgot',email:data.get('email')});setSent(true);}
  else{const password=String(data.get('password'));if(password.length<8)throw new Error('Use at least 8 characters.');if(password!==data.get('confirm'))throw new Error('Passwords do not match.');await post({action:'update',password});window.location.assign('/admin');}
 }catch(error){setMessage(error instanceof Error?error.message:'Something went wrong.');}finally{setBusy(false);}};
 const label=view==='login'?'Sign In':view==='forgot'?'Send reset link':'Update password';
 return <section className={`admin-login-panel${light?' is-light':''}`}>
  <header className="admin-login-top">
   <button type="button" className="admin-login-theme" aria-label={light?'Switch to dark mode':'Switch to light mode'} onClick={()=>setLight(v=>!v)}>{light?<Moon size={18}/>:<Sun size={18}/>}</button>
   <span className="admin-login-badge"><span/>Admin access only</span>
  </header>
  <div className="admin-login-main">
   <div className="admin-login-box">
    {view==='forgot'&&<button type="button" className="admin-login-back" onClick={()=>go('login')}><ArrowLeft size={16}/>Back to sign in</button>}
    <h1>{copy[view].title}</h1>
    <p className="admin-login-sub">{copy[view].sub}</p>
    {!configured&&<div className="admin-login-notice">Setup required: add this project’s Supabase environment variables and apply the migration.</div>}
    {sent?<div className="admin-login-sent">If that email belongs to a staff account, a reset link is on its way. Open it in this browser to set a new password.</div>:
    <form onSubmit={submit}>
     {view!=='reset'&&<label>Email<input type="email" name="email" autoComplete="username" placeholder="you@example.com" required/></label>}
     {view==='login'&&<PasswordField name="password" label="Password" placeholder="minimum 8 characters" autoComplete="current-password"/>}
     {view==='reset'&&<><PasswordField name="password" label="New password" placeholder="minimum 8 characters" autoComplete="new-password"/><PasswordField name="confirm" label="Confirm password" placeholder="repeat your new password" autoComplete="new-password"/></>}
     <button className="admin-login-submit" disabled={!configured||busy}>{busy?'Please wait…':<>{label} <ArrowRight size={16} strokeWidth={2.5}/></>}</button>
     {view==='login'&&<button type="button" className="admin-login-forgot" onClick={()=>go('forgot')}>Forgot password?</button>}
     <p role="status" className="admin-login-status">{message}</p>
    </form>}
   </div>
  </div>
  <footer className="admin-login-foot">
   <span>© {new Date().getFullYear()} Zaane</span>
   <nav><Link href="/privacy-policy">Privacy Policy</Link><Link href="/contact">Support</Link></nav>
  </footer>
 </section>;
}
