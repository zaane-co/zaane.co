'use client';
import {useState} from 'react';
import {useZarn} from './ZarnProvider';
import {Modal} from './Dialogs';
const colors=['#71717a','#2563eb','#d97706','#16a34a','#7c3aed','#db2777','#0891b2','#c40a3a'];
// Adds a board column / status that everyone on the team can use.
export default function AddStatusDialog({onClose,onAdded}:{onClose:()=>void;onAdded?:(key:string)=>void}){
 const {reloadStatuses}=useZarn();
 const [label,setLabel]=useState(''),[color,setColor]=useState(colors[1]!),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function add(e:React.FormEvent){
  e.preventDefault();if(!label.trim())return;setBusy(true);setError('');
  try{
   const r=await fetch('/api/zarn/statuses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add',label:label.trim(),color})});
   const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Could not add the status.');
   await reloadStatuses();onAdded?.(d.key);onClose();
  }catch(err){setError(err instanceof Error?err.message:'Could not add the status.');setBusy(false);}
 }
 return <Modal title="Add a status" onClose={onClose}><form className="zn-modal-body" onSubmit={add}>
  <label className="zn-label">Name<input className="zn-input" autoFocus required maxLength={30} value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Blocked, QA, Waiting on client"/></label>
  <div className="zn-label">Colour<div className="zp-colors">{colors.map(c=><button key={c} type="button" aria-label={c} aria-pressed={color===c} className={color===c?'is-on':''} style={{background:c}} onClick={()=>setColor(c)}/>)}</div></div>
  {error&&<p className="zn-error" role="alert">{error}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy||!label.trim()}>{busy?'Adding…':'Add status'}</button></div>
 </form></Modal>;
}
