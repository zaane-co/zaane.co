'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Lock} from 'lucide-react';
export default function VaultUnlock({token}:{token:string}){
 const router=useRouter();
 const [password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  const r=await fetch('/api/vault/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})});
  const d=await r.json().catch(()=>({}));
  if(r.ok){router.refresh();return;}
  setError(d.error||'Could not unlock.');setBusy(false);
 }
 return <form className="docpub-card" onSubmit={submit}>
  <span className="docpub-lock"><Lock size={20}/></span>
  <h1>Secure handover</h1><p>Enter the password Zaane sent you to see your project details.</p>
  <input type="password" autoFocus autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" aria-label="Password"/>
  {error&&<small role="alert">{error}</small>}
  <button disabled={busy||!password}>{busy?'Checking…':'Open'}</button>
 </form>;
}
