'use client';
import {useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Eye,EyeOff,Moon,Sun} from 'lucide-react';

export default function Login({configured}:{configured:boolean}){
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const [show,setShow]=useState(false);const [light,setLight]=useState(false);
 return <section className={`admin-login-panel${light?' is-light':''}`}>
  <header className="admin-login-top">
   <button type="button" className="admin-login-theme" aria-label={light?'Switch to dark mode':'Switch to light mode'} onClick={()=>setLight(v=>!v)}>{light?<Moon size={18}/>:<Sun size={18}/>}</button>
   <span className="admin-login-badge"><span/>Admin access only</span>
  </header>
  <div className="admin-login-main">
   <div className="admin-login-box">
    <h1>Welcome back, Nnamdi</h1>
    <p className="admin-login-sub">Sign in to your admin dashboard.</p>
    {!configured&&<div className="admin-login-notice">Setup required: add this project’s Supabase environment variables and apply the migration.</div>}
    <form onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');const data=new FormData(e.currentTarget);try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.get('email'),password:data.get('password')})});const result=await r.json();if(!r.ok)throw new Error(result.error);window.location.assign('/admin');}catch(error){setMessage(error instanceof Error?error.message:'Sign-in failed.');}finally{setBusy(false);}}}>
     <label>Email<input type="email" name="email" autoComplete="username" placeholder="you@example.com" required/></label>
     <label>Password<span className="admin-login-pw"><input type={show?'text':'password'} name="password" autoComplete="current-password" placeholder="minimum 8 characters" required/><button type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>
     <button className="admin-login-submit" disabled={!configured||busy}>{busy?'Signing in…':<>Sign In <ArrowRight size={16} strokeWidth={2.5}/></>}</button>
     <p role="status" className="admin-login-status">{message}</p>
    </form>
   </div>
  </div>
  <footer className="admin-login-foot">
   <span>© {new Date().getFullYear()} Zaane</span>
   <nav><Link href="/privacy-policy">Privacy Policy</Link><Link href="/contact">Support</Link></nav>
  </footer>
 </section>;
}
