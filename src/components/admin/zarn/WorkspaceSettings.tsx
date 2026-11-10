'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Flash from '../Flash';
import {zarnApi} from '@/lib/zarn';
// ZARN admin > Workspace: the name everyone sees at the top of ZARN.
export default function WorkspaceSettings({initial}:{initial:string}){
 const router=useRouter();
 const [name,setName]=useState(initial),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[err,setErr]=useState('');
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMsg('');setErr('');
  try{await zarnApi('/api/zarn/admin',{action:'workspace_name',name});setMsg('Workspace name saved. Everyone sees it next time ZARN loads.');router.refresh();}
  catch(x){setErr(x instanceof Error?x.message:'Could not save.');}finally{setBusy(false);}}
 return <div className="za-page">
  <div className="za-page-head"><div><h1>Workspace</h1><p>How your ZARN workspace appears to everyone.</p></div></div>
  <form className="za-card za-ws-card" onSubmit={save}>
   <label className="za-field"><span>Workspace name</span><input value={name} maxLength={60} required onChange={e=>setName(e.target.value)} placeholder="e.g. Zaane Technologies"/></label>
   <p className="za-ws-hint">Shown at the top of the sidebar in ZARN.</p>
   {msg&&<Flash>{msg}</Flash>}{err&&<Flash tone="error">{err}</Flash>}
   <div><button className="za-btn za-btn-primary" disabled={busy||!name.trim()||name.trim()===initial}>{busy?'Saving…':'Save'}</button></div>
  </form>
 </div>;
}
