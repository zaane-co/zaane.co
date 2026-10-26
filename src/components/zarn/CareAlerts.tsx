'use client';
import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Bell,PackageCheck,X} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {dueText,lagosToday} from '@/lib/zarn-care';
type Alert={id:string;lead_id:string;kind:'reminder'|'deliverable';due_on:string;title:string;client:string};
// Pops up client reminders and due deliverables while you're in ZARN. Checks on open, when you come back to the tab, and every 15 minutes.
export default function CareAlerts(){
 const {me}=useZarn(),router=useRouter();
 const [alerts,setAlerts]=useState<Alert[]>([]);
 const check=useCallback(async()=>{
  try{const r=await fetch('/api/zarn/care',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'due'})});if(r.ok)setAlerts((await r.json()).alerts??[]);}catch{}
 },[]);
 useEffect(()=>{
  if(me.account_type==='guest')return;
  const t=setTimeout(()=>void check(),1500),i=setInterval(()=>void check(),15*60_000);
  const v=()=>{if(document.visibilityState==='visible')void check();};
  document.addEventListener('visibilitychange',v);
  return()=>{clearTimeout(t);clearInterval(i);document.removeEventListener('visibilitychange',v);};
 },[check,me.account_type]);
 const dismiss=(ids:string[])=>{setAlerts(a=>a.filter(x=>!ids.includes(x.id)));void fetch('/api/zarn/care',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'dismiss',ids})});};
 if(!alerts.length)return null;
 const today=lagosToday();
 return <div className="zn-prompt zc-alerts" role="dialog" aria-label="Client reminders">
  <span className="zn-prompt-ico"><Bell size={18}/></span>
  <div className="zn-prompt-text"><b>{alerts.length===1?'Client reminder':`${alerts.length} client reminders`}</b><small>Due today or still open.</small></div>
  <button type="button" className="zn-prompt-x" aria-label="Dismiss all" onClick={()=>dismiss(alerts.map(a=>a.id))}><X size={16}/></button>
  <ul className="zc-alert-list">{alerts.slice(0,5).map(a=><li key={a.id}>
   {a.kind==='deliverable'?<PackageCheck size={15}/>:<Bell size={15}/>}
   <button type="button" className="zc-alert-open" onClick={()=>{dismiss([a.id]);router.push(`/zarn/clients/${a.lead_id}`);}}><b>{a.title}</b><small>{a.client} · {a.kind==='deliverable'?'Deliverable':'Reminder'} · {dueText(a.due_on,today)}</small></button>
   <button type="button" className="zn-btn" onClick={()=>dismiss([a.id])}>Done</button>
  </li>)}</ul>
  {alerts.length>5&&<p className="zc-alert-more">+{alerts.length-5} more</p>}
 </div>;
}
