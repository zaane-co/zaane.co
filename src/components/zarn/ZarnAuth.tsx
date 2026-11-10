'use client';
import {useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {ArrowRight,Eye,EyeOff,Moon,Sun} from 'lucide-react';
import {useAdminTheme,writeTheme} from '@/lib/admin-theme';

// Same layout as the Studio admin login (/admin/login): photo panel on the left, sign-in panel on the right.
type View='login'|'welcome'|'password';
const copy:Record<View,{title:string;sub:string}>={
 login:{title:'Welcome back',sub:'Sign in to ZARN, the Zaane team chat.'},
 welcome:{title:'Welcome to ZARN',sub:'Set up your profile and choose a password.'},
 password:{title:'Choose a new password',sub:'You’ll use it to sign in to ZARN.'},
};
async function post(body:object){const r=await fetch('/api/zarn/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;}
function PasswordField({name,label,placeholder,autoComplete}:{name:string;label:string;placeholder:string;autoComplete:string}){
 const [show,setShow]=useState(false);
 return <label>{label}<span className="admin-login-pw"><input type={show?'text':'password'} name={name} autoComplete={autoComplete} placeholder={placeholder} required minLength={autoComplete==='new-password'?8:1}/><button type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>;
}

export default function ZarnAuth({initial,name='',title='',notice=''}:{initial:View;name?:string;title?:string;notice?:string}){
 const {light}=useAdminTheme();
 const [view]=useState<View>(initial),[busy,setBusy]=useState(false),[msg,setMsg]=useState(notice);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setMsg('');const f=new FormData(e.currentTarget);
  try{
   if(view==='login')await post({action:'login',email:f.get('email'),password:f.get('password')});
   else{
    if(f.get('password')!==f.get('confirm'))throw new Error('Passwords don’t match.');
    await post(view==='welcome'?{action:'welcome',password:f.get('password'),display_name:f.get('display_name'),title:f.get('title')}:{action:'password',password:f.get('password')});
   }
   window.location.assign('/zarn');
  }catch(err){setMsg(err instanceof Error?err.message:'Something went wrong.');}finally{setBusy(false);}
 }
 const label=view==='login'?'Sign In':view==='welcome'?'Join ZARN':'Save password';
 return <main className="admin-login zarn-login">
  <aside className="admin-login-hero"><div className="admin-login-photo">
   <Image src="/admin.png" alt="" fill priority sizes="50vw" className="object-cover object-[50%_40%]"/>
   <div className="admin-login-shade"/>
   <span className="zarn-login-logo"><img src="/zarn%20logo2.png" alt=""/>ZARN</span>
   <div className="admin-login-caption"><h2>ZARN</h2><p>Channels, DMs and the studio pipeline, in one place.</p></div>
  </div></aside>
  <section className={`admin-login-panel${light?' is-light':''}`}>
   <header className="admin-login-top">
    <button type="button" className="admin-login-theme" aria-label={light?'Switch to dark mode':'Switch to light mode'} onClick={()=>writeTheme(!light)}>{light?<Moon size={18}/>:<Sun size={18}/>}</button>
    <span className="admin-login-badge"><span/>Team access only</span>
   </header>
   <div className="admin-login-main">
    <div className="admin-login-box">
     <h1>{copy[view].title}</h1>
     <p className="admin-login-sub">{copy[view].sub}</p>
     <form onSubmit={submit}>
      {view==='login'&&<label>Email<input type="email" name="email" autoComplete="username" autoCapitalize="none" placeholder="you@example.com" required/></label>}
      {view==='login'&&<PasswordField name="password" label="Password" placeholder="minimum 8 characters" autoComplete="current-password"/>}
      {view==='welcome'&&<><label>Your name<input name="display_name" required maxLength={80} defaultValue={name}/></label><label>Title (optional)<input name="title" maxLength={80} defaultValue={title} placeholder="e.g. Product designer"/></label></>}
      {view!=='login'&&<><PasswordField name="password" label="New password" placeholder="minimum 8 characters" autoComplete="new-password"/><PasswordField name="confirm" label="Confirm password" placeholder="repeat your new password" autoComplete="new-password"/></>}
      <button className="admin-login-submit" disabled={busy}>{busy?'Please wait…':<>{label} <ArrowRight size={16} strokeWidth={2.5}/></>}</button>
      {view==='login'&&<p className="admin-login-sub zarn-login-note">No account? ZARN is invite-only. Ask a Zaane admin.</p>}
      <p role="status" className="admin-login-status">{msg}</p>
     </form>
    </div>
   </div>
   <footer className="admin-login-foot">
    <span>© {new Date().getFullYear()} Zaane</span>
    <nav><Link href="/privacy-policy">Privacy Policy</Link><Link href="/contact">Support</Link></nav>
   </footer>
  </section>
 </main>;
}
