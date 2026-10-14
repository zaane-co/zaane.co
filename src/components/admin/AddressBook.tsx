'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Inbox,Mail,Phone,Plus,Search,Users} from 'lucide-react';
import {ago,initials} from '@/lib/crm';

export type PersonType='lead'|'client'|'contact'|'message';
export type Person={key:string;name:string;email:string;phone:string;company:string;types:PersonType[];stage:{label:string;color:string}|null;detail:string;href:string;last:string};
const typeInfo:Record<PersonType,{label:string;cls:string}>={client:{label:'Client',cls:'za-status-green'},lead:{label:'Lead',cls:'za-status-blue'},contact:{label:'Contact',cls:'za-status-violet'},message:{label:'Form message',cls:'za-status-grey'}};

// Admin > Contacts: everyone the studio deals with, in one list.
export default function AddressBook({people}:{people:Person[]}){
 const [q,setQ]=useState(''),[type,setType]=useState<'all'|PersonType>('all');
 const count=(t:PersonType)=>people.filter(p=>p.types.includes(t)).length;
 const shown=people.filter(p=>(type==='all'||p.types.includes(type))&&`${p.name} ${p.email} ${p.company} ${p.phone} ${p.detail}`.toLowerCase().includes(q.toLowerCase()));
 return <div className="za-page">
  <div className="za-page-head"><div><h1>Contacts</h1><p>Everyone you deal with: leads, clients, people you’ve added and website messages.</p></div>
   <div className="za-toolbar-actions">
    <Link className="za-btn za-btn-ghost" href="/admin/contact_submissions"><Inbox size={15}/>Inbox &amp; add contact</Link>
    <Link className="za-btn za-btn-primary" href="/admin/leads?new=1"><Plus size={15}/>New lead</Link>
   </div></div>
  <div className="za-toolbar">
   <div className="za-search za-search-wide"><Search size={14}/><input placeholder="Search name, email, company or phone" value={q} onChange={e=>setQ(e.target.value)} aria-label="Search contacts"/></div>
   <div className="za-seg za-seg-scroll" role="group" aria-label="Filter">
    {(['all','client','lead','contact','message'] as const).map(t=><button key={t} type="button" className={type===t?'is-on':''} aria-pressed={type===t} onClick={()=>setType(t)}>{t==='all'?'All':t==='message'?'Messages':typeInfo[t].label+'s'} <span className="za-seg-n">{t==='all'?people.length:count(t)}</span></button>)}
   </div>
  </div>
  <section className="za-card">{shown.length?<div className="za-table-wrap"><table className="za-table za-table-click za-ab-table">
   <thead><tr><th>Name</th><th>Type</th><th className="za-hide-sm">Reach</th><th className="za-hide-sm">Latest</th></tr></thead>
   <tbody>{shown.map(p=><tr key={p.key}>
    <td><Link href={p.href} className="za-cell-main"><span className="za-crm-avatar">{initials(p.name||p.email)}</span><span><b>{p.name||p.email}</b><small>{[p.company,p.detail].filter(Boolean).join(' · ')||p.email}</small></span></Link></td>
    <td><div className="za-zm-acct">{p.types.map(t=><span key={t} className={`za-status ${typeInfo[t].cls}`}>{typeInfo[t].label}</span>)}{p.stage&&!p.types.includes('client')&&<span className="za-status" style={{background:p.stage.color}}>{p.stage.label}</span>}</div></td>
    <td className="za-hide-sm"><div className="za-ab-reach">{p.email&&<a href={`mailto:${p.email}`}><Mail size={13}/>{p.email}</a>}{p.phone&&<a href={`tel:${p.phone}`}><Phone size={13}/>{p.phone}</a>}</div></td>
    <td className="za-hide-sm za-cell-muted">{ago(p.last)}</td>
   </tr>)}</tbody>
  </table></div>:<div className="za-empty za-empty-lg"><Users size={28}/><h3>{people.length?'No one matches':'No contacts yet'}</h3><p>{people.length?'Try another search or filter.':'Leads you add and website messages show up here.'}</p></div>}</section>
 </div>;
}
