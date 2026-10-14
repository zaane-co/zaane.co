'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {ExternalLink,MailPlus,Power,RotateCcw,Send,Trash2,UserPlus,X} from 'lucide-react';
import {roleInfo,type Role} from '@/lib/cms';
import {ago,initials} from '@/lib/crm';
import {zarnApi,type ZMember} from '@/lib/zarn';
import {F} from '../crm/NewLead';

export type Row=ZMember&{last_sign_in_at:string|null;staff_role:string|null};
// ZARN members: invite, resend, deactivate, remove. Staff admins only.
export default function ZarnMembers({rows,me}:{rows:Row[];me:{id:string;name:string;email:string}}){
 const router=useRouter();
 const [inviting,setInviting]=useState(false),[v,setV]=useState({name:'',email:'',title:''}),[busy,setBusy]=useState<string|null>(null),[flash,setFlash]=useState(''),[error,setError]=useState(''),[removing,setRemoving]=useState<Row|null>(null);
 const amMember=rows.some(r=>r.user_id===me.id);
 const active=rows.filter(r=>!r.deactivated_at&&r.joined_at),pending=rows.filter(r=>!r.deactivated_at&&!r.joined_at),off=rows.filter(r=>r.deactivated_at);
 async function run(key:string,body:object,msg:string){
  setBusy(key);setFlash('');
  try{await zarnApi('/api/zarn/admin',body);setFlash(msg);router.refresh();return true;}catch(e){setFlash(e instanceof Error?e.message:'Something went wrong.');return false;}finally{setBusy(null);}
 }
 async function invite(e:React.FormEvent){
  e.preventDefault();setBusy('invite');setError('');
  try{const r=await zarnApi<{existing?:boolean;emailed?:boolean}>('/api/zarn/admin',{action:'invite',...v});setFlash(r.existing?`${v.name} already has a Zaane login, so they can sign in to ZARN now${r.emailed?' (we emailed them)':''}.`:r.emailed?`Invite sent to ${v.email}.`:'Added, but the invite email failed. Use “Resend”.');setInviting(false);setV({name:'',email:'',title:''});router.refresh();}
  catch(err){setError(err instanceof Error?err.message:'Could not invite.');}finally{setBusy(null);}
 }
 const table=(list:Row[],kind:'active'|'pending'|'off')=><div className="za-table-wrap"><table className="za-table"><tbody>{list.map(r=><tr key={r.user_id}>
  <td><div className="za-cell-main"><span className="za-crm-avatar">{initials(r.display_name)}</span><span><b>{r.display_name}{r.user_id===me.id&&' (you)'}</b><small>{r.email}{r.title?` · ${r.title}`:''}</small></span></div></td>
  <td className="za-hide-sm">{r.staff_role?<span className="za-status za-status-blue">{roleInfo[r.staff_role as Role]?.label??r.staff_role}</span>:<span className="za-cell-muted">Chat only</span>}</td>
  <td className="za-hide-sm za-cell-muted">{kind==='pending'?`Invited ${ago(r.created_at)}`:r.last_sign_in_at?`Seen ${ago(r.last_seen_at??r.last_sign_in_at)}`:'Never signed in'}</td>
  <td><div className="za-row-actions">
   {kind==='pending'&&<button type="button" data-tip="Resend invite" aria-label="Resend invite" disabled={busy===r.user_id} onClick={()=>void run(r.user_id,{action:'resend',user_id:r.user_id},`Invite resent to ${r.email}.`)}><Send size={14}/></button>}
   {kind!=='off'&&r.user_id!==me.id&&<button type="button" data-tip="Deactivate" aria-label="Deactivate" disabled={busy===r.user_id} onClick={()=>void run(r.user_id,{action:'deactivate',user_id:r.user_id},`${r.display_name} can no longer sign in to ZARN.`)}><Power size={14}/></button>}
   {kind==='off'&&<button type="button" data-tip="Reactivate" aria-label="Reactivate" disabled={busy===r.user_id} onClick={()=>void run(r.user_id,{action:'reactivate',user_id:r.user_id},`${r.display_name} is back on ZARN.`)}><RotateCcw size={14}/></button>}
   {r.user_id!==me.id&&<button type="button" className="za-row-danger" data-tip="Remove" aria-label="Remove" onClick={()=>setRemoving(r)}><Trash2 size={14}/></button>}
  </div></td>
 </tr>)}</tbody></table></div>;

 return <div className="za-page">
  <div className="za-page-head"><div><h1>ZARN members</h1><p>Your team chat. Only admins can invite people.</p></div>
   <div className="za-toolbar-actions">
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ZARN is a separate app shell */}
    <a className="za-btn za-btn-ghost" href="/zarn" target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/>Open ZARN</a>
    <button type="button" className="za-btn za-btn-primary" onClick={()=>{setInviting(true);setError('');}}><UserPlus size={15}/>Invite people</button></div></div>
  {!amMember&&<div className="za-notice za-zarn-join"><span>You’re not on ZARN yet. Join with your existing login to start chatting.</span><button type="button" className="za-btn za-btn-ghost" disabled={busy==='self'} onClick={()=>void run('self',{action:'invite',name:me.name||me.email.split('@')[0],email:me.email,title:''},'You’re on ZARN. Open it from the button above.')}>Join ZARN</button></div>}
  <div className="za-stats za-stats-3">
   <div className="za-card za-stat za-crm-stat"><span className="za-stat-icon"><UserPlus size={19}/></span><div><p>Active</p><strong>{active.length}</strong></div></div>
   <div className="za-card za-stat za-crm-stat"><span className="za-stat-icon"><MailPlus size={19}/></span><div><p>Invite pending</p><strong>{pending.length}</strong></div></div>
   <div className="za-card za-stat za-crm-stat"><span className="za-stat-icon"><Power size={19}/></span><div><p>Deactivated</p><strong>{off.length}</strong></div></div>
  </div>
  {flash&&<p role="status" className="za-flash">{flash}</p>}
  <section className="za-card"><div className="za-card-head"><h2>Members</h2><small className="za-date">{active.length}</small></div>{active.length?table(active,'active'):<p className="za-empty">No one has joined yet.</p>}</section>
  {pending.length>0&&<section className="za-card"><div className="za-card-head"><h2>Invited</h2><small className="za-date">Waiting to set a password</small></div>{table(pending,'pending')}</section>}
  {off.length>0&&<section className="za-card"><div className="za-card-head"><h2>Deactivated</h2></div>{table(off,'off')}</section>}

  {inviting&&<div className="za-modal-scrim" onClick={()=>setInviting(false)}>
   <form className="za-modal za-modal-wide" role="dialog" aria-label="Invite to ZARN" onClick={e=>e.stopPropagation()} onSubmit={invite}>
    <div className="za-modal-head"><span className="za-modal-icon za-modal-icon-brand"><UserPlus size={18}/></span><div><strong>Invite to ZARN</strong><small>They join #general and #random automatically.</small></div><button type="button" className="za-icon-btn za-push" aria-label="Close" onClick={()=>setInviting(false)}><X size={16}/></button></div>
    <div className="za-form-grid">
     <F label="Name *"><input required autoFocus maxLength={80} value={v.name} onChange={e=>setV({...v,name:e.target.value})}/></F>
     <F label="Email *"><input required type="email" maxLength={254} value={v.email} onChange={e=>setV({...v,email:e.target.value})}/></F>
     <F label="Title" wide><input maxLength={80} placeholder="e.g. Brand designer" value={v.title} onChange={e=>setV({...v,title:e.target.value})}/></F>
    </div>
    <p className="za-modal-hint">ZARN access is separate from admin access. To give someone admin powers too, use Users &amp; roles.</p>
    {error&&<p role="alert" className="za-flash">{error}</p>}
    <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setInviting(false)}>Cancel</button><button className="za-btn za-btn-primary" disabled={busy==='invite'}><Send size={14}/>{busy==='invite'?'Sending…':'Send invite'}</button></div>
   </form>
  </div>}
  {removing&&<div className="za-modal-scrim" onClick={()=>setRemoving(null)}>
   <div className="za-modal" role="alertdialog" aria-label="Remove member" onClick={e=>e.stopPropagation()}>
    <div className="za-modal-head"><span className="za-modal-icon"><Trash2 size={18}/></span><div><strong>Remove {removing.display_name}?</strong><small>{removing.email}</small></div></div>
    <p>{removing.staff_role?'They keep their admin login but lose ZARN. Their messages stay, shown as a former member.':'Their login is deleted. Their messages stay, shown as a former member. To pause access instead, deactivate them.'}</p>
    <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setRemoving(null)}>Cancel</button><button type="button" className="za-btn za-btn-danger" disabled={!!busy} onClick={async()=>{await run(removing.user_id,{action:'remove',user_id:removing.user_id},`${removing.display_name} was removed.`);setRemoving(null);}}>Remove</button></div>
   </div>
  </div>}
 </div>;
}
