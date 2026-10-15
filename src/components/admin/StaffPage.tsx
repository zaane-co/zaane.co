'use client';
import Dropdown from '@/components/ui/Dropdown';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Send,Trash2,UserPlus,X} from 'lucide-react';
import {roles,roleInfo,type Role} from '@/lib/cms';
import {ago,initials} from '@/lib/crm';
import {F} from './crm/NewLead';

export type Member={id:string;email:string;name:string;role:Role|null;created_at:string;last_sign_in_at:string|null};
const roleColor:Record<Role,string>={super_admin:'#f10c45',admin:'#2563eb',editor:'#7c3aed',sales:'#f59e0b',finance:'#16a34a'};
async function api(body:object){const r=await fetch('/api/admin/staff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;}

export default function StaffPage({members,me}:{members:Member[];me:string}){
 const router=useRouter();
 const [inviting,setInviting]=useState(false),[form,setForm]=useState<{name:string;email:string;role:Role}>({name:'',email:'',role:'editor'});
 const [busy,setBusy]=useState<string|null>(null),[flash,setFlash]=useState(''),[error,setError]=useState(''),[removing,setRemoving]=useState<Member|null>(null);
 const staffers=members.filter(m=>m.role),others=members.filter(m=>!m.role);
 async function run(key:string,body:object,msg:string){
  setBusy(key);setFlash('');
  try{const d=await api(body);setFlash(typeof msg==='string'?msg:'');router.refresh();return d;}
  catch(e){setFlash(e instanceof Error?e.message:'Something went wrong.');return null;}finally{setBusy(null);}
 }
 async function invite(e:React.FormEvent){
  e.preventDefault();setBusy('invite');setError('');
  try{const d=await api({action:'invite',...form});setFlash(d.existing?`${form.name} already had an account, so they’re now ${roleInfo[form.role].label}.`:d.emailed?`Invite sent to ${form.email}.`:`Account created, but the invite email failed. Ask ${form.name} to use “Forgot password” on the login page.`);setInviting(false);setForm({name:'',email:'',role:'editor'});router.refresh();}
  catch(err){setError(err instanceof Error?err.message:'Could not send the invite.');}finally{setBusy(null);}
 }
 const Row=({m}:{m:Member})=><tr>
  <td><div className="za-cell-main"><span className="za-crm-avatar" style={m.role?{background:roleColor[m.role]}:undefined}>{initials(m.name||m.email)}</span><span><b>{m.name||m.email.split('@')[0]}{m.id===me&&' (you)'}</b><small>{m.email}</small></span></div></td>
  <td>{m.id===me?<span className="za-status" style={{background:roleColor[m.role!]}}>{roleInfo[m.role!].label}</span>
   :<Dropdown variant="toolbar" label={`Role for ${m.name||m.email}`} value={m.role??''} disabled={busy===m.id} onChange={x=>void run(m.id,{action:'set_role',id:m.id,role:x||null},x?`Role changed to ${roleInfo[x as Role].label}.`:'Access removed.')} options={[{value:'',label:'No access'},...roles.map(r=>({value:r,label:roleInfo[r].label}))]}/>}</td>
  <td className="za-hide-sm za-cell-muted">{m.last_sign_in_at?ago(m.last_sign_in_at):'Invite pending'}</td>
  <td><div className="za-row-actions">{m.id!==me&&<button type="button" className="za-row-danger" aria-label={`Remove ${m.name||m.email}`} data-tip="Delete account" onClick={()=>setRemoving(m)}><Trash2 size={14}/></button>}</div></td>
 </tr>;

 return <div className="za-page">
  <div className="za-page-head"><div><h1>Users & roles</h1><p>Invite your team and choose what each person can reach.</p></div>
   <button type="button" className="za-btn za-btn-primary" onClick={()=>{setInviting(true);setError('');}}><UserPlus size={15}/>Invite member</button></div>

  <div className="za-roles">{roles.map(r=><div key={r} className="za-card za-role"><span className="za-col-dot" style={{background:roleColor[r]}}/><div><strong>{roleInfo[r].label}</strong><p>{roleInfo[r].summary}</p></div><small>{staffers.filter(m=>m.role===r).length}</small></div>)}</div>
  {flash&&<p role="status" className="za-flash">{flash}</p>}

  <section className="za-card">
   <div className="za-card-head"><h2>Team</h2><small className="za-date">{staffers.length} with access</small></div>
   <div className="za-table-wrap"><table className="za-table"><thead><tr><th>Member</th><th>Role</th><th className="za-hide-sm">Last sign in</th><th className="za-th-actions"><span className="sr-only">Actions</span></th></tr></thead>
    <tbody>{staffers.map(m=><Row key={m.id} m={m}/>)}</tbody></table></div>
  </section>
  {others.length>0&&<section className="za-card">
   <div className="za-card-head"><h2>Accounts without access</h2><small className="za-date">Signed up but no role yet</small></div>
   <div className="za-table-wrap"><table className="za-table"><tbody>{others.map(m=><Row key={m.id} m={m}/>)}</tbody></table></div>
  </section>}

  {inviting&&<div className="za-modal-scrim" onClick={()=>setInviting(false)}>
   <form className="za-modal za-modal-wide" role="dialog" aria-label="Invite member" onClick={e=>e.stopPropagation()} onSubmit={invite}>
    <div className="za-modal-head"><span className="za-modal-icon za-modal-icon-brand"><UserPlus size={18}/></span><div><strong>Invite a team member</strong><small>They get an email to set their password.</small></div><button type="button" className="za-icon-btn za-push" aria-label="Close" onClick={()=>setInviting(false)}><X size={16}/></button></div>
    <div className="za-form-grid">
     <F label="Name *"><input required autoFocus maxLength={120} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></F>
     <F label="Email *"><input required type="email" maxLength={254} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></F>
    </div>
    <div className="za-role-pick" role="radiogroup" aria-label="Role">{roles.map(r=><button key={r} type="button" role="radio" aria-checked={form.role===r} className={form.role===r?'is-on':''} onClick={()=>setForm(f=>({...f,role:r}))}><span className="za-col-dot" style={{background:roleColor[r]}}/><span><strong>{roleInfo[r].label}</strong><small>{roleInfo[r].summary}</small></span></button>)}</div>
    {error&&<p role="alert" className="za-flash">{error}</p>}
    <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setInviting(false)}>Cancel</button><button className="za-btn za-btn-primary" disabled={busy==='invite'}><Send size={14}/>{busy==='invite'?'Sending…':'Send invite'}</button></div>
   </form>
  </div>}
  {removing&&<div className="za-modal-scrim" onClick={()=>setRemoving(null)}>
   <div className="za-modal" role="alertdialog" aria-label="Delete account" onClick={e=>e.stopPropagation()}>
    <div className="za-modal-head"><span className="za-modal-icon"><Trash2 size={18}/></span><div><strong>Delete this account?</strong><small>{removing.email}</small></div></div>
    <p>They lose access immediately and their login is deleted. To keep the account but block access, set the role to “No access” instead.</p>
    <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setRemoving(null)}>Cancel</button><button type="button" className="za-btn za-btn-danger" disabled={!!busy} onClick={async()=>{await run(removing.id,{action:'remove',id:removing.id},'Account deleted.');setRemoving(null);}}>Delete</button></div>
   </div>
  </div>}
 </div>;
}
