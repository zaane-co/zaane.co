'use client';
import Dropdown from '@/components/ui/Dropdown';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {KeyRound,MessagesSquare,Send,Trash2,UserPlus,X} from 'lucide-react';
import {roles,roleInfo,type Role} from '@/lib/cms';
import {ago,initials} from '@/lib/crm';
import {F} from './crm/NewLead';

export type ZarnAccess={type:'member'|'guest';state:'active'|'pending'|'deactivated'};
export type Member={id:string;email:string;name:string;role:Role|null;created_at:string;last_sign_in_at:string|null;zarn:ZarnAccess|null};
const roleColor:Record<Role,string>={super_admin:'#f10c45',admin:'#2563eb',editor:'#7c3aed',sales:'#f59e0b',finance:'#16a34a'};
// What each Studio role reaches, in a couple of words.
const roleArea:Record<Role,string>={super_admin:'Full access',admin:'All of Studio',editor:'Blog & content',sales:'CRM & contacts',finance:'Invoices & payments'};
const zarnLabel=(z:ZarnAccess)=>z.state==='deactivated'?'Deactivated':z.state==='pending'?'Invite pending':z.type==='guest'?'Guest':'Member';
const zarnColor=(z:ZarnAccess)=>z.state==='deactivated'?'#3f3f46':z.state==='pending'?'#52525b':z.type==='guest'?'#d97706':'#0891b2';
type View='all'|'studio'|'zarn'|'none';
async function api(body:object){const r=await fetch('/api/admin/staff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;}

export default function StaffPage({members,me}:{members:Member[];me:string}){
 const router=useRouter();
 const [inviting,setInviting]=useState(false),[form,setForm]=useState<{name:string;email:string;role:Role}>({name:'',email:'',role:'editor'});
 const [busy,setBusy]=useState<string|null>(null),[flash,setFlash]=useState(''),[error,setError]=useState(''),[removing,setRemoving]=useState<Member|null>(null),[resetting,setResetting]=useState<Member|null>(null);
 const [view,setView]=useState<View>('all');
 const staffers=members.filter(m=>m.role),chat=members.filter(m=>m.zarn&&m.zarn.state!=='deactivated'),none=members.filter(m=>!m.role&&(!m.zarn||m.zarn.state==='deactivated'));
 const shown=view==='studio'?staffers:view==='zarn'?members.filter(m=>m.zarn):view==='none'?none:members;
 const zarnCount=(f:(z:ZarnAccess)=>boolean)=>members.filter(m=>m.zarn&&f(m.zarn)).length;
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
  <td><div className="za-cell-main"><span className="za-crm-avatar" style={{background:m.role?roleColor[m.role]:m.zarn?zarnColor(m.zarn):'#52525b'}}>{initials(m.name||m.email)}</span><span><b>{m.name||m.email.split('@')[0]}{m.id===me&&' (you)'}</b><small>{m.email}</small></span></div></td>
  <td>{m.id===me?<span className="za-status" style={{background:roleColor[m.role!]}}>{roleInfo[m.role!].label}</span>
   :<Dropdown variant="toolbar" label={`Studio role for ${m.name||m.email}`} value={m.role??''} disabled={busy===m.id} onChange={x=>void run(m.id,{action:'set_role',id:m.id,role:x||null},x?`Studio role changed to ${roleInfo[x as Role].label}.`:'Studio access removed.')} options={[{value:'',label:'No Studio access'},...roles.map(r=>({value:r,label:roleInfo[r].label,color:roleColor[r],hint:roleArea[r]}))]}/>}
   {m.role&&<small className="za-access-area">{roleArea[m.role]}</small>}</td>
  <td>{m.zarn?<Link href="/admin/zarn" className="za-zarn-badge" style={{background:zarnColor(m.zarn)}} data-tip="Manage in ZARN admin"><MessagesSquare size={12}/>{zarnLabel(m.zarn)}</Link>:<span className="za-cell-muted">Not on ZARN</span>}</td>
  <td className="za-hide-sm za-cell-muted">{m.last_sign_in_at?ago(m.last_sign_in_at):'Invite pending'}</td>
  <td><div className="za-row-actions"><button type="button" className="za-row-btn" aria-label={`Send ${m.name||m.email} a new password`} data-tip="Email a new password" onClick={()=>setResetting(m)}><KeyRound size={14}/></button>{m.id!==me&&<button type="button" className="za-row-danger" aria-label={`Remove ${m.name||m.email}`} data-tip="Delete account" onClick={()=>setRemoving(m)}><Trash2 size={14}/></button>}</div></td>
 </tr>;

 return <div className="za-page">
  <div className="za-page-head"><div><h1>Users & roles</h1><p>Invite your team and choose what each person can reach.</p></div>
   <button type="button" className="za-btn za-btn-primary" onClick={()=>{setInviting(true);setError('');}}><UserPlus size={15}/>Invite member</button></div>

  <div className="za-access-groups">
   <section><h2 className="za-access-title">Studio admin</h2><p className="za-access-sub">The admin at zaane.co/admin. Each person has one role.</p>
    <div className="za-roles">{roles.map(r=><div key={r} className="za-card za-role"><span className="za-col-dot" style={{background:roleColor[r]}}/><div><strong>{roleInfo[r].label}</strong><p>{roleInfo[r].summary}</p></div><small>{staffers.filter(m=>m.role===r).length}</small></div>)}</div></section>
   <section><h2 className="za-access-title">ZARN team chat</h2><p className="za-access-sub">Separate from Studio roles. Invite and manage people in <Link href="/admin/zarn">ZARN admin</Link>.</p>
    <div className="za-roles za-roles-zarn">
     <div className="za-card za-role"><span className="za-col-dot" style={{background:'#0891b2'}}/><div><strong>Members</strong><p>Full team: channels, DMs and assigned clients.</p></div><small>{zarnCount(z=>z.state==='active'&&z.type==='member')}</small></div>
     <div className="za-card za-role"><span className="za-col-dot" style={{background:'#d97706'}}/><div><strong>Guests</strong><p>Only the channels they’re added to.</p></div><small>{zarnCount(z=>z.state==='active'&&z.type==='guest')}</small></div>
     <div className="za-card za-role"><span className="za-col-dot" style={{background:'#52525b'}}/><div><strong>Pending</strong><p>Invited, not joined yet.</p></div><small>{zarnCount(z=>z.state==='pending')}</small></div>
    </div></section>
  </div>
  {flash&&<p role="status" className="za-flash">{flash}</p>}

  <section className="za-card">
   <div className="za-card-head"><h2>People</h2>
    <div className="za-seg za-seg-scroll" role="tablist" aria-label="Filter people">{([['all','Everyone',members.length],['studio','Studio admin',staffers.length],['zarn','ZARN',chat.length],['none','No access',none.length]] as [View,string,number][]).map(([k,l,n])=><button key={k} type="button" role="tab" aria-selected={view===k} className={view===k?'is-on':''} onClick={()=>setView(k)}>{l}<span className="za-seg-n">{n}</span></button>)}</div></div>
   {shown.length?<div className="za-table-wrap"><table className="za-table"><thead><tr><th>Member</th><th>Studio admin</th><th>ZARN</th><th className="za-hide-sm">Last sign in</th><th className="za-th-actions"><span className="sr-only">Actions</span></th></tr></thead>
    <tbody>{shown.map(m=><Row key={m.id} m={m}/>)}</tbody></table></div>
   :<p className="za-empty-note">{view==='none'?'Everyone has access to Studio or ZARN.':'Nobody here yet.'}</p>}
  </section>

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
  {resetting&&<div className="za-modal-scrim" onClick={()=>!busy&&setResetting(null)}>
   <div className="za-modal" role="alertdialog" aria-label="Send a new password" onClick={e=>e.stopPropagation()}>
    <div className="za-modal-head"><span className="za-modal-icon za-modal-icon-brand"><KeyRound size={18}/></span><div><strong>Email a new password?</strong><small>{resetting.email}</small></div></div>
    <p>{resetting.id===me?'You':(resetting.name||resetting.email.split('@')[0]!).split(' ')[0]} will get a new password by email, with a link to set {resetting.id===me?'your':'their'} own instead. {resetting.id===me?'Your':'Their'} current password stops working straight away{resetting.id===me?', so check your inbox before signing out':''}.</p>
    <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" disabled={!!busy} onClick={()=>setResetting(null)}>Cancel</button><button type="button" className="za-btn za-btn-primary" disabled={!!busy} onClick={async()=>{const d=await run(`pw-${resetting.id}`,{action:'send_password',id:resetting.id},`New password sent to ${resetting.email}.`);if(d)setResetting(null);}}><Send size={14}/>{busy?'Sending…':'Send new password'}</button></div>
   </div>
  </div>}
  {removing&&<div className="za-modal-scrim" onClick={()=>setRemoving(null)}>
   <div className="za-modal" role="alertdialog" aria-label="Delete account" onClick={e=>e.stopPropagation()}>
    <div className="za-modal-head"><span className="za-modal-icon"><Trash2 size={18}/></span><div><strong>Delete this account?</strong><small>{removing.email}</small></div></div>
    <p>{removing.zarn&&removing.zarn.state!=='deactivated'?'This deletes their login everywhere, including ZARN. To remove only Studio access, set the role to “No Studio access”. To pause ZARN, deactivate them in ZARN admin.':'They lose access immediately and their login is deleted. To keep the account but block access, set the role to “No Studio access” instead.'}</p>
    <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setRemoving(null)}>Cancel</button><button type="button" className="za-btn za-btn-danger" disabled={!!busy} onClick={async()=>{await run(removing.id,{action:'remove',id:removing.id},'Account deleted.');setRemoving(null);}}>Delete</button></div>
   </div>
  </div>}
 </div>;
}
