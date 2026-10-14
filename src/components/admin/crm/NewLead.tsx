'use client';
import {useEffect,useState} from 'react';
import {X} from 'lucide-react';
import {sources,currencies,crmApi,type PipelineStage,type Staff} from '@/lib/crm';

// Slide-over for adding a lead by hand (referrals, outbound, event contacts).
export default function NewLead({stages,team,me,onClose,onCreated}:{stages:PipelineStage[];team:Staff[];me:string;onClose:()=>void;onCreated:(id:string)=>void}){
 const [v,setV]=useState({name:'',email:'',company:'',phone:'',service_interested:'',deal_value:'',currency:'NGN',status:stages[0]?.key??'new',source:'referral',owner_id:me,message:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const set=(k:keyof typeof v)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setV(s=>({...s,[k]:e.target.value}));
 useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);},[onClose]);
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{const {id}=await crmApi<{id:string}>({action:'create_lead',values:{...v,deal_value:v.deal_value===''?null:Number(v.deal_value),owner_id:v.owner_id||null}});onCreated(id);}
  catch(err){setError(err instanceof Error?err.message:'Could not create this lead.');setBusy(false);}
 }
 return <>
  <button className="za-drawer-scrim" aria-label="Close" onClick={onClose}/>
  <aside className="za-drawer" role="dialog" aria-label="New lead">
   <div className="za-drawer-head"><div><p>Leads</p><h2>New lead</h2></div><button className="za-icon-btn" onClick={onClose} aria-label="Close" data-tip="Close"><X size={18}/></button></div>
   <form onSubmit={submit} className="za-drawer-body" data-lenis-prevent>
    <div className="za-form-grid">
     <F label="Name *"><input required autoFocus maxLength={120} value={v.name} onChange={set('name')}/></F>
     <F label="Email *"><input required type="email" maxLength={254} value={v.email} onChange={set('email')}/></F>
     <F label="Company"><input maxLength={200} value={v.company} onChange={set('company')}/></F>
     <F label="Phone"><input type="tel" maxLength={40} value={v.phone} onChange={set('phone')}/></F>
     <F label="Service" wide><input maxLength={120} placeholder="e.g. Web app MVP" value={v.service_interested} onChange={set('service_interested')}/></F>
     <F label="Deal value"><input type="number" min={0} step="any" inputMode="decimal" value={v.deal_value} onChange={set('deal_value')}/></F>
     <F label="Currency"><select value={v.currency} onChange={set('currency')}>{currencies.map(c=><option key={c}>{c}</option>)}</select></F>
     <F label="Stage"><select value={v.status} onChange={set('status')}>{stages.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></F>
     <F label="Source"><select value={v.source} onChange={set('source')}>{sources.map(s=><option key={s} value={s}>{s[0]!.toUpperCase()+s.slice(1)}</option>)}</select></F>
     <F label="Owner" wide><select value={v.owner_id} onChange={set('owner_id')}><option value="">Unassigned</option>{team.map(s=><option key={s.id} value={s.id}>{s.name||s.email}</option>)}</select></F>
     <F label="Brief / context" wide><textarea rows={5} maxLength={10000} placeholder="What do they need? How did you meet?" value={v.message} onChange={set('message')}/></F>
    </div>
    {error&&<p role="alert" className="za-flash">{error}</p>}
    <div className="za-drawer-foot"><button type="button" className="za-btn za-btn-ghost" onClick={onClose}>Cancel</button><button disabled={busy} className="za-btn za-btn-primary za-push">{busy?'Creating…':'Create lead'}</button></div>
   </form>
  </aside>
 </>;
}
export function F({label,wide,children}:{label:string;wide?:boolean;children:React.ReactNode}){
 return <label className={`za-field${wide?' za-field-wide':''}`}><span className="za-field-label"><span className="za-field-name">{label}</span></span>{children}</label>;
}
