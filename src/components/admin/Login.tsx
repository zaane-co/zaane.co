'use client';
import {useState} from 'react';
export default function Login({configured}:{configured:boolean}){
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 return <form className="contact-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');const data=new FormData(e.currentTarget);try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.get('email'),password:data.get('password')})});const result=await r.json();if(!r.ok)throw new Error(result.error);window.location.assign('/admin');}catch(error){setMessage(error instanceof Error?error.message:'Sign-in failed.');}finally{setBusy(false);}}}>
 <label>Email<input type="email" name="email" autoComplete="username" required/></label><label>Password<input type="password" name="password" autoComplete="current-password" required/></label>
 <button className="studio-button orange-button" disabled={!configured||busy}>{busy?'Signing in…':'Sign in →'}</button><p role="status">{message}</p></form>;
}
