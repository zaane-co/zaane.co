'use client';
import {useState} from 'react';
import {Landmark,Loader2,X} from 'lucide-react';
import Dropdown from '@/components/ui/Dropdown';
import Flash from '../Flash';
import {currencies} from '@/lib/crm';
import {bankLabel,type BankAccount} from '@/lib/bank';
import {F} from './NewLead';

async function bankApi(body:object){const r=await fetch('/api/admin/bank-accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d as {account?:BankAccount};}
export const deleteBankAccount=(id:string)=>bankApi({action:'delete',id});

// Add or edit one of the company's bank accounts. Used from the invoice and from Settings.
export function BankAccountForm({account,defaultCurrency='',onSaved,onClose}:{account?:BankAccount;defaultCurrency?:string;onSaved:(a:BankAccount)=>void;onClose:()=>void}){
 const [v,setV]=useState({currency:account?.currency??defaultCurrency,bank:account?.bank??'',account_name:account?.account_name??'',account_number:account?.account_number??'',extra:account?.extra??'',is_default:account?.is_default??false});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){
  e.preventDefault();e.stopPropagation();setBusy(true);setError('');
  try{const d=await bankApi({action:'save',id:account?.id,values:v});if(d.account)onSaved(d.account);}
  catch(err){setError(err instanceof Error?err.message:'Could not save.');setBusy(false);}
 }
 return <div className="za-modal-scrim" onClick={onClose}>
  <form className="za-modal za-modal-wide" role="dialog" aria-label={account?'Edit bank account':'Add bank account'} onClick={e=>e.stopPropagation()} onSubmit={submit}>
   <div className="za-modal-head"><span className="za-modal-icon za-modal-icon-brand"><Landmark size={18}/></span><div><strong>{account?'Edit bank account':'Add a bank account'}</strong><small>Clients pay into this account. It’s printed on the invoice.</small></div><button type="button" className="za-icon-btn za-push" aria-label="Close" onClick={onClose}><X size={16}/></button></div>
   <div className="za-form-grid">
    <F label="Bank name *"><input required autoFocus maxLength={120} placeholder="e.g. Access Bank" value={v.bank} onChange={e=>setV(s=>({...s,bank:e.target.value}))}/></F>
    <F label="Account number *"><input required maxLength={60} inputMode="numeric" placeholder="0123456789" value={v.account_number} onChange={e=>setV(s=>({...s,account_number:e.target.value}))}/></F>
    <F label="Account name" wide><input maxLength={160} placeholder="e.g. Zaane Studio Ltd" value={v.account_name} onChange={e=>setV(s=>({...s,account_name:e.target.value}))}/></F>
    <F label="Receives"><Dropdown label="Currency" value={v.currency} onChange={x=>setV(s=>({...s,currency:x}))} options={[{value:'',label:'Any currency'},...currencies.map(c=>({value:c,label:c}))]}/></F>
    <F label="Other details"><input maxLength={500} placeholder="SWIFT / IBAN, if paying from abroad" value={v.extra} onChange={e=>setV(s=>({...s,extra:e.target.value}))}/></F>
   </div>
   <label className="za-check-row"><input type="checkbox" checked={v.is_default} onChange={e=>setV(s=>({...s,is_default:e.target.checked}))}/>Use as the default account for {v.currency||'all currencies'}</label>
   {error&&<Flash tone="error">{error}</Flash>}
   <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={onClose}>Cancel</button><button className="za-btn za-btn-primary" disabled={busy}>{busy&&<Loader2 size={14} className="za-spin"/>}{account?'Save account':'Add account'}</button></div>
  </form>
 </div>;
}

// Pick the account an invoice is paid into, or add a new one without leaving the invoice.
export default function BankAccountField({accounts,onAccounts,value,onChange,currency,locked}:{accounts:BankAccount[];onAccounts:(a:BankAccount[])=>void;value:string;onChange:(id:string)=>void;currency:string;locked?:boolean}){
 const [adding,setAdding]=useState(false);
 return <>
  <Dropdown label="Pay to" placeholder="Choose a bank account…" disabled={locked} value={value} onChange={x=>x==='__add__'?setAdding(true):onChange(x)}
   options={[...accounts.map(a=>({value:a.id,label:bankLabel(a),hint:[a.account_name,a.currency||'Any currency'].filter(Boolean).join(' · ')})),{value:'__add__',label:'+ Add a bank account'}]}/>
  {adding&&<BankAccountForm defaultCurrency={currency} onClose={()=>setAdding(false)} onSaved={a=>{onAccounts([...accounts.map(x=>a.is_default&&x.currency===a.currency?{...x,is_default:false}:x),a]);onChange(a.id);setAdding(false);}}/>}
 </>;
}
