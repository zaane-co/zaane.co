'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Landmark,Pencil,Plus,Trash2} from 'lucide-react';
import Flash from './Flash';
import {BankAccountForm,deleteBankAccount} from './crm/BankAccountField';
import type {BankAccount} from '@/lib/bank';

// Settings card listing the company's bank accounts, with add, edit and delete.
export default function BankAccounts({initial}:{initial:BankAccount[]}){
 const router=useRouter();
 const [list,setList]=useState(initial),[editing,setEditing]=useState<BankAccount|'new'|null>(null),[removing,setRemoving]=useState<BankAccount|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const saved=(a:BankAccount)=>{setList(l=>{const rest=l.filter(x=>x.id!==a.id).map(x=>a.is_default&&x.currency===a.currency?{...x,is_default:false}:x);return [...rest,a].sort((p,q)=>Number(q.is_default)-Number(p.is_default));});setEditing(null);router.refresh();};
 async function remove(){
  if(!removing)return;setBusy(true);setError('');
  try{await deleteBankAccount(removing.id);setList(l=>l.filter(x=>x.id!==removing.id));setRemoving(null);router.refresh();}
  catch(e){setError(e instanceof Error?e.message:'Could not delete.');}finally{setBusy(false);}
 }
 return <section className="za-card za-set-group" id="bank">
  <header><h2>Bank accounts</h2><p>The accounts clients pay into. Choose one on each invoice, and it’s printed on the invoice and in the invoice email.</p></header>
  <div className="za-set-fields">
   {list.length?<ul className="za-bank-list">{list.map(a=><li key={a.id}>
    <span className="za-bank-icon"><Landmark size={16}/></span>
    <div><b>{a.bank}{a.is_default&&<em>Default</em>}</b><small>{a.account_number}{a.account_name?` · ${a.account_name}`:''} · {a.currency||'Any currency'}</small></div>
    <div className="za-row-actions"><button type="button" aria-label={`Edit ${a.bank}`} data-tip="Edit" onClick={()=>setEditing(a)}><Pencil size={14}/></button><button type="button" className="za-row-danger" aria-label={`Delete ${a.bank}`} data-tip="Delete" onClick={()=>setRemoving(a)}><Trash2 size={14}/></button></div>
   </li>)}</ul>:<p className="za-set-hint">No bank accounts yet. Add the account clients should pay into.</p>}
   <div><button type="button" className="za-btn za-btn-ghost" onClick={()=>setEditing('new')}><Plus size={14}/>Add bank account</button></div>
  </div>
  {editing&&<BankAccountForm account={editing==='new'?undefined:editing} onClose={()=>setEditing(null)} onSaved={saved}/>}
  {removing&&<div className="za-modal-scrim" onClick={()=>setRemoving(null)}><div className="za-modal" role="alertdialog" aria-label="Delete bank account" onClick={e=>e.stopPropagation()}>
   <div className="za-modal-head"><span className="za-modal-icon"><Trash2 size={18}/></span><div><strong>Delete {removing.bank}?</strong><small>{removing.account_number}</small></div></div>
   <p>Invoices that use this account will fall back to your default account. Printed copies you already sent keep the old details.</p>
   {error&&<Flash tone="error">{error}</Flash>}
   <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setRemoving(null)}>Cancel</button><button type="button" className="za-btn za-btn-danger" disabled={busy} onClick={()=>void remove()}>Delete</button></div>
  </div></div>}
 </section>;
}
