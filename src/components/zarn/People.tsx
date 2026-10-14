'use client';
import {useState} from 'react';
import {Contact,MessageSquare,Search} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {Avatar} from './format';

// Team directory: everyone you can see on ZARN, with a one-click DM.
export default function People(){
 const {members,me,online,openDm}=useZarn();
 const [q,setQ]=useState(''),[busy,setBusy]=useState<string|null>(null);
 const list=members.filter(m=>!m.deactivated_at&&`${m.display_name} ${m.title} ${m.email}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>Number(online.has(b.user_id))-Number(online.has(a.user_id))||a.display_name.localeCompare(b.display_name));
 return <div className="zn-page">
  <header className="zn-page-head"><div><h1><Contact size={20}/>People</h1><p>{list.length} {list.length===1?'person':'people'} · {[...online].filter(id=>members.some(m=>m.user_id===id)).length} online</p></div></header>
  <div className="zn-crm-bar"><span className="zn-prefix"><Search size={15}/><input className="zn-input" placeholder="Search by name, title or email" value={q} onChange={e=>setQ(e.target.value)}/></span></div>
  <div className="zn-people" data-lenis-prevent>{list.map(m=><div key={m.user_id} className="zn-person-card">
   <Avatar m={m} size={52} online={online.has(m.user_id)}/>
   <div><b>{m.display_name}{m.user_id===me.user_id&&' (you)'}</b><small>{m.title||m.email}</small>{m.status_text&&<em>{m.status_text}</em>}{m.account_type==='guest'&&<span className="zn-guest-tag">Guest</span>}</div>
   {m.user_id!==me.user_id&&<button type="button" className="zn-btn" disabled={busy===m.user_id} onClick={async()=>{setBusy(m.user_id);try{await openDm([m.user_id]);}finally{setBusy(null);}}}><MessageSquare size={14}/>Message</button>}
  </div>)}</div>
 </div>;
}
