'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Check,X} from 'lucide-react';
import {currencies} from '@/lib/crm';
import {zarnApi} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {Avatar} from './format';

// New client from inside ZARN: saves it to the CRM (Won stage) and opens a private client space for the chosen team.
export default function AddClient({onClose}:{onClose:()=>void}){
 const z=useZarn(),router=useRouter();
 const [v,setV]=useState({name:'',company:'',email:'',phone:'',service:'',deal_value:'',currency:'NGN',brief:''});
 const [team,setTeam]=useState<string[]>([]),[q,setQ]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const people=z.members.filter(m=>!m.deactivated_at&&m.account_type==='member'&&m.user_id!==z.me.user_id&&`${m.display_name} ${m.title}`.toLowerCase().includes(q.toLowerCase()));
 const set=(k:keyof typeof v)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setV(s=>({...s,[k]:e.target.value}));
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setErr('');
  try{const r=await zarnApi<{lead_id:string}>('/api/zarn/clients',{action:'create',...v,deal_value:v.deal_value===''?null:Number(v.deal_value),team});await z.reload();onClose();router.push(`/zarn/clients/${r.lead_id}`);}
  catch(x){setErr(x instanceof Error?x.message:'Could not add the client.');setBusy(false);}
 }
 return <div className="zn-modal-scrim" onClick={onClose}><form className="zn-modal zn-modal-lg" role="dialog" aria-label="Add client" onClick={e=>e.stopPropagation()} onSubmit={save}>
  <div className="zn-modal-head"><h2>Add client</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
  <div className="zn-modal-body" data-lenis-prevent>
   <div className="zn-grid-2">
    <label className="zn-label">Contact name *<input className="zn-input" required autoFocus maxLength={120} value={v.name} onChange={set('name')}/></label>
    <label className="zn-label">Company<input className="zn-input" maxLength={200} value={v.company} onChange={set('company')}/></label>
    <label className="zn-label">Email<input className="zn-input" type="email" maxLength={254} value={v.email} onChange={set('email')}/></label>
    <label className="zn-label">Phone<input className="zn-input" type="tel" maxLength={40} value={v.phone} onChange={set('phone')}/></label>
    <label className="zn-label">Service<input className="zn-input" maxLength={120} placeholder="e.g. Brand identity" value={v.service} onChange={set('service')}/></label>
    <div className="zn-grid-2 zn-tight"><label className="zn-label">Deal value<input className="zn-input" type="number" min={0} step="any" value={v.deal_value} onChange={set('deal_value')}/></label>
     <label className="zn-label">Currency<select className="zn-input" value={v.currency} onChange={set('currency')}>{currencies.map(c=><option key={c}>{c}</option>)}</select></label></div>
   </div>
   <label className="zn-label">Brief<textarea className="zn-input" rows={3} maxLength={10000} placeholder="What are we doing for them?" value={v.brief} onChange={set('brief')}/></label>
   <div className="zn-label">Team <small>Only these people (and admins) can see this client’s space. You’re added automatically.</small></div>
   <input className="zn-input" placeholder="Search staff" value={q} onChange={e=>setQ(e.target.value)}/>
   <ul className="zn-list zn-list-scroll zn-team-pick">{people.map(m=><li key={m.user_id}><button type="button" className={team.includes(m.user_id)?'is-on':''} onClick={()=>setTeam(t=>t.includes(m.user_id)?t.filter(x=>x!==m.user_id):[...t,m.user_id])}>
    <Avatar m={m} size={28}/><span><b>{m.display_name}</b><small>{m.title||m.email}</small></span>{team.includes(m.user_id)&&<Check size={16} className="zn-check"/>}</button></li>)}
    {!people.length&&<li className="zn-empty-row">No other staff on ZARN yet.</li>}</ul>
  </div>
  {err&&<p className="zn-error">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy}>{busy?'Adding…':`Add client${team.length?` + ${team.length} on team`:''}`}</button></div>
 </form></div>;
}
