'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Check,UserPlus,Users} from 'lucide-react';
import Dropdown from '@/components/ui/Dropdown';
import Flash from '../Flash';
import {currencies,invoiceTotals,money,invoiceApi,type PipelineStage} from '@/lib/crm';
import {F} from './NewLead';
import {InvoiceLines,type LinesValue} from './InvoiceEditor';

type Client={id:string;name:string;company:string;email:string;currency:string;status:string};
const today=()=>new Date().toISOString().slice(0,10);
const plusDays=(from:string,n:number)=>{const d=new Date(from+'T00:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};

// New invoice as a full page: choose who it's for (or add them), fill in the lines, then create the draft.
export default function NewInvoice({clients,stages,initialClient}:{clients:Client[];stages:PipelineStage[];initialClient?:string}){
 const router=useRouter();
 const first=clients.find(c=>c.id===initialClient);
 const [mode,setMode]=useState<'existing'|'new'>(clients.length?'existing':'new');
 const [leadId,setLeadId]=useState(initialClient??'');
 const [nc,setNc]=useState({name:'',email:'',company:'',phone:''});
 // Which stage the client is at is the user's call: an existing client starts on their current stage, a new one must be chosen.
 const [stage,setStage]=useState(first?.status??'');
 const current=clients.find(c=>c.id===leadId);
 const stageOptions=stages.map(s=>({value:s.key,label:s.label,color:s.color}));
 const [v,setV]=useState<LinesValue&{issue_date:string;due_date:string}>({currency:first?.currency||'NGN',items:[{description:'',qty:1,unit_price:0}],tax_rate:'0',discount:'0',notes:'',issue_date:today(),due_date:plusDays(today(),14)});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const items=v.items.map(i=>({...i,qty:Number(i.qty)||0,unit_price:Number(i.unit_price)||0}));
 const total=invoiceTotals(items,Number(v.tax_rate),Number(v.discount)).total;
 const ready=mode==='existing'?!!leadId:!!nc.name.trim()&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nc.email);

 async function create(){
  setError('');
  if(mode==='new'&&!stage){setError('Choose which stage this client is at.');document.getElementById('bill-to')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(!ready){setError(mode==='existing'?'Choose who this invoice is for.':'Enter the new client’s name and email.');document.getElementById('bill-to')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  setBusy(true);
  try{
   const r=await invoiceApi<{id:string;lead_id:string}>({action:'create_full',client:mode==='existing'?{lead_id:leadId}:{new:nc},stage:mode==='new'||stage!==current?.status?stage||undefined:undefined,values:{...v,items:items.filter(i=>i.description.trim()||i.unit_price),tax_rate:Number(v.tax_rate)||0,discount:Number(v.discount)||0}});
   router.replace(`/admin/leads/${r.lead_id}?section=invoices`);
  }catch(e){setError(e instanceof Error?e.message:'Could not create the invoice.');setBusy(false);}
 }

 return <div className="za-page za-invoice-edit">
  <Link href="/admin/invoices" className="za-back"><ArrowLeft size={14}/>All invoices</Link>
  <div className="za-lead-head">
   <div className="za-lead-title"><h1>New invoice <span className="za-status" style={{background:'#52525b'}}>Not saved</span></h1><p><span>{money(total,v.currency)} total</span></p></div>
   <div className="za-toolbar-actions">
    <Link href="/admin/invoices" className="za-btn za-btn-ghost">Cancel</Link>
    <button type="button" className="za-btn za-btn-primary" disabled={busy} onClick={()=>void create()}><Check size={14}/>{busy?'Creating…':'Create invoice'}</button>
   </div>
  </div>
  {error&&<Flash tone="error">{error}</Flash>}

  <div className="za-inv-stack">
   <section className="za-card" id="bill-to">
    <div className="za-card-head"><h2>Bill to</h2>
     {!!clients.length&&<div className="za-seg" role="group" aria-label="Client type"><button type="button" className={mode==='existing'?'is-on':''} aria-pressed={mode==='existing'} onClick={()=>setMode('existing')}><Users size={13}/>Existing client</button><button type="button" className={mode==='new'?'is-on':''} aria-pressed={mode==='new'} onClick={()=>setMode('new')}><UserPlus size={13}/>New client</button></div>}</div>
    <div className="za-card-pad">
     {mode==='existing'?<F label="Client" wide><Dropdown label="Client" placeholder="Choose a client…" value={leadId} onChange={x=>{setLeadId(x);const c=clients.find(k=>k.id===x);if(c){setStage(c.status);if(c.currency)setV(s=>({...s,currency:c.currency}));}}} options={clients.map(c=>({value:c.id,label:c.company||c.name,hint:c.company?`${c.name} · ${c.email}`:c.email}))}/></F>
     :<><div className="za-form-grid">
       <F label="Name *"><input autoFocus maxLength={120} value={nc.name} onChange={e=>setNc(c=>({...c,name:e.target.value}))}/></F>
       <F label="Email *"><input type="email" maxLength={254} value={nc.email} onChange={e=>setNc(c=>({...c,email:e.target.value}))}/></F>
       <F label="Company"><input maxLength={200} value={nc.company} onChange={e=>setNc(c=>({...c,company:e.target.value}))}/></F>
       <F label="Phone"><input type="tel" maxLength={40} value={nc.phone} onChange={e=>setNc(c=>({...c,phone:e.target.value}))}/></F>
      </div><p className="za-muted-note" style={{marginTop:12}}>They’re added to Leads. If the email already exists, the invoice goes to that client.</p></>}
     {(mode==='new'||!!leadId)&&<div className="za-stage-ask"><F label={mode==='new'?'What stage is this client at? *':'Client stage'}><Dropdown label="Client stage" placeholder="Choose a stage…" value={stage} onChange={setStage} options={stageOptions}/></F><p className="za-muted-note">{mode==='new'?'Shown on the Leads board. Nothing is assumed.':'Their stage only changes if you pick a different one.'}</p></div>}
    </div>
   </section>

   <section className="za-card">
    <div className="za-card-head"><h2>Line items</h2><small className="za-date">{v.items.length} line{v.items.length===1?'':'s'}</small></div>
    <InvoiceLines v={v} setV={setV}/>
   </section>

   <section className="za-card">
    <div className="za-card-head"><h2>Details</h2></div>
    <div className="za-card-pad za-form-grid">
     <F label="Issue date"><input type="date" value={v.issue_date} onChange={e=>setV(s=>({...s,issue_date:e.target.value}))}/></F>
     <F label="Due date"><input type="date" value={v.due_date} min={v.issue_date} onChange={e=>setV(s=>({...s,due_date:e.target.value}))}/></F>
     <div className="za-field-wide za-chips">{[7,14,30].map(n=><button key={n} type="button" onClick={()=>setV(s=>({...s,due_date:plusDays(s.issue_date,n)}))}>Net {n}</button>)}<button type="button" onClick={()=>setV(s=>({...s,due_date:s.issue_date}))}>On receipt</button></div>
     <F label="Currency"><Dropdown label="Currency" value={v.currency} onChange={x=>setV(s=>({...s,currency:x}))} options={currencies.map(c=>({value:c,label:c}))}/></F>
    </div>
   </section>

   <div className="za-new-inv-foot"><Link href="/admin/invoices" className="za-btn za-btn-ghost">Cancel</Link><button type="button" className="za-btn za-btn-primary" disabled={busy} onClick={()=>void create()}><Check size={14}/>{busy?'Creating…':'Create invoice'}</button></div>
  </div>
 </div>;
}
