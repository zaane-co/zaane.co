'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Briefcase,ExternalLink,Hash,Lock,MoreHorizontal,Pencil,Power,RotateCcw,Search,Send,ShieldCheck,Trash2,UserPlus,X} from 'lucide-react';
import {roleInfo,type Role} from '@/lib/cms';
import {ago,initials} from '@/lib/crm';
import {zarnApi,type ZMember} from '@/lib/zarn';
import {F} from '../crm/NewLead';

export type Row=ZMember&{last_sign_in_at:string|null;staff_role:string|null;channel_ids:string[]};
export type ChannelOpt={id:string;name:string;kind:'public'|'private';is_default:boolean;crm_feed:string|null};
type Access={account_type:'member'|'guest';can_view_crm:boolean;can_create_channels:boolean;channels:string[];expiry:string;custom:string};
type Filter='all'|'member'|'guest'|'invited'|'deactivated';
const expiryOptions=[['never','No time limit'],['7','7 days'],['30','30 days'],['90','90 days'],['custom','Pick a date']] as const;
const status=(r:Row)=>r.deactivated_at?'deactivated':r.expires_at&&new Date(r.expires_at)<=new Date()?'expired':!r.joined_at?'invited':'active';
function expiryIso(a:Access){if(a.account_type!=='guest'||a.expiry==='never')return null;if(a.expiry==='custom')return a.custom?new Date(a.custom+'T23:59:59').toISOString():null;const d=new Date();d.setDate(d.getDate()+Number(a.expiry));return d.toISOString();}
function daysLeft(iso:string){const d=Math.ceil((new Date(iso).getTime()-Date.now())/86400000);return d<=0?'Expired':d===1?'Expires tomorrow':`Expires in ${d} days`;}

// ZARN admin > Members, modelled on Slack's Manage members: filter, change account type, edit access, deactivate.
export default function ZarnMembers({rows,channels,me}:{rows:Row[];channels:ChannelOpt[];me:{id:string;name:string;email:string}}){
 const router=useRouter();
 const [filter,setFilter]=useState<Filter>('all'),[q,setQ]=useState(''),[menu,setMenu]=useState<string|null>(null);
 const [form,setForm]=useState<{mode:'invite'|'edit';row?:Row}|null>(null),[removing,setRemoving]=useState<Row|null>(null);
 const [busy,setBusy]=useState<string|null>(null),[flash,setFlash]=useState('');
 const amMember=rows.some(r=>r.user_id===me.id);
 const counts={all:rows.length,member:rows.filter(r=>r.account_type==='member'&&!r.deactivated_at).length,guest:rows.filter(r=>r.account_type==='guest'&&!r.deactivated_at).length,invited:rows.filter(r=>status(r)==='invited').length,deactivated:rows.filter(r=>r.deactivated_at).length};
 const shown=rows.filter(r=>(filter==='all'||(filter==='deactivated'?!!r.deactivated_at:filter==='invited'?status(r)==='invited':r.account_type===filter&&!r.deactivated_at))&&`${r.display_name} ${r.email} ${r.title}`.toLowerCase().includes(q.toLowerCase()));
 async function run(key:string,body:object,msg:string){
  setBusy(key);setFlash('');setMenu(null);
  try{await zarnApi('/api/zarn/admin',body);setFlash(msg);router.refresh();return true;}catch(e){setFlash(e instanceof Error?e.message:'Something went wrong.');return false;}finally{setBusy(null);}
 }
 const chName=(id:string)=>channels.find(c=>c.id===id)?.name;
 return <div className="za-page">
  <div className="za-page-head"><div><h1>ZARN members</h1><p>Choose exactly what each person can reach. Only admins can invite.</p></div>
   <div className="za-toolbar-actions">
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ZARN is a separate app shell */}
    <a className="za-btn za-btn-ghost" href="/zarn" target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/>Open ZARN</a>
    <button type="button" className="za-btn za-btn-primary" onClick={()=>setForm({mode:'invite'})}><UserPlus size={15}/>Invite people</button></div></div>
  {!amMember&&<div className="za-notice za-zarn-join"><span>You’re not on ZARN yet. Join with your existing login to start chatting.</span><button type="button" className="za-btn za-btn-ghost" disabled={busy==='self'} onClick={()=>void run('self',{action:'invite',name:me.name||me.email.split('@')[0],email:me.email,title:''},'You’re on ZARN. Open it from the button above.')}>Join ZARN</button></div>}
  <div className="za-toolbar">
   <div className="za-search za-search-wide"><Search size={14}/><input placeholder="Search name, email or title" value={q} onChange={e=>setQ(e.target.value)} aria-label="Search members"/></div>
   <div className="za-seg za-seg-scroll" role="group" aria-label="Filter">{(['all','member','guest','invited','deactivated'] as Filter[]).map(f=><button key={f} type="button" className={filter===f?'is-on':''} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f==='all'?'All':f==='member'?'Members':f==='guest'?'Guests':f==='invited'?'Invited':'Deactivated'} <span className="za-seg-n">{counts[f]}</span></button>)}</div>
  </div>
  {flash&&<p role="status" className="za-flash">{flash}</p>}
  <section className="za-card">{shown.length?<div className="za-table-wrap"><table className="za-table za-zm-table"><thead><tr><th>Name</th><th>Account</th><th className="za-hide-sm">Access</th><th className="za-hide-sm">Last active</th><th className="za-th-actions"><span className="sr-only">Actions</span></th></tr></thead>
   <tbody>{shown.map(r=>{const st=status(r);return <tr key={r.user_id} className={r.deactivated_at?'is-off':''}>
    <td><div className="za-cell-main"><span className="za-crm-avatar">{initials(r.display_name)}</span><span><b>{r.display_name}{r.user_id===me.id&&' (you)'}</b><small>{r.email}{r.title?` · ${r.title}`:''}</small></span></div></td>
    <td><div className="za-zm-acct"><span className={`za-status ${r.account_type==='guest'?'za-status-amber':'za-status-blue'}`}>{r.account_type==='guest'?'Guest':'Member'}</span>
     {st!=='active'&&<span className={`za-status ${st==='invited'?'za-status-violet':'za-status-grey'}`}>{st==='invited'?'Invited':st==='expired'?'Expired':'Deactivated'}</span>}
     {r.staff_role&&<span className="za-zm-staff" data-tip={`Studio admin: ${roleInfo[r.staff_role as Role]?.label??r.staff_role}`}><ShieldCheck size={13}/></span>}</div>
     {r.expires_at&&st!=='expired'&&!r.deactivated_at&&<small className="za-zm-exp">{daysLeft(r.expires_at)}</small>}</td>
    <td className="za-hide-sm"><div className="za-zm-access">
     <span className={r.can_view_crm?'is-on':''} data-tip={r.can_view_crm?'Can view CRM':'No CRM access'}><Briefcase size={13}/>CRM</span>
     <span className={r.can_create_channels?'is-on':''} data-tip={r.can_create_channels?'Can create channels':'Can’t create channels'}><Hash size={13}/>Create</span>
     <span className="is-on" data-tip={r.channel_ids.map(chName).filter(Boolean).map(n=>'#'+n).join(', ')||'No channels'}>{r.channel_ids.length} channel{r.channel_ids.length===1?'':'s'}</span>
    </div></td>
    <td className="za-hide-sm za-cell-muted">{st==='invited'?`Invited ${ago(r.created_at)}`:r.last_seen_at||r.last_sign_in_at?ago((r.last_seen_at??r.last_sign_in_at)!):'Never'}</td>
    <td className="za-status-cell"><div className="za-row-actions"><button type="button" aria-label={`Actions for ${r.display_name}`} aria-haspopup="menu" aria-expanded={menu===r.user_id} onClick={()=>setMenu(menu===r.user_id?null:r.user_id)}><MoreHorizontal size={16}/></button></div>
     {menu===r.user_id&&<><button type="button" className="za-menu-scrim" aria-label="Close" onClick={()=>setMenu(null)}/><div className="za-status-menu za-zm-menu" role="menu">
      <button type="button" role="menuitem" onClick={()=>{setMenu(null);setForm({mode:'edit',row:r});}}><Pencil size={14}/>Edit access</button>
      {st==='invited'&&<button type="button" role="menuitem" disabled={busy===r.user_id} onClick={()=>void run(r.user_id,{action:'resend',user_id:r.user_id},`Invite resent to ${r.email}.`)}><Send size={14}/>Resend invite</button>}
      {r.user_id!==me.id&&(r.deactivated_at
       ?<button type="button" role="menuitem" onClick={()=>void run(r.user_id,{action:'reactivate',user_id:r.user_id},`${r.display_name} can use ZARN again.`)}><RotateCcw size={14}/>Reactivate account</button>
       :<button type="button" role="menuitem" onClick={()=>void run(r.user_id,{action:'deactivate',user_id:r.user_id},`${r.display_name} is deactivated. Their messages stay; they can’t sign in.`)}><Power size={14}/>Deactivate account</button>)}
      {r.user_id!==me.id&&<button type="button" role="menuitem" className="za-zm-danger" onClick={()=>{setMenu(null);setRemoving(r);}}><Trash2 size={14}/>Remove from ZARN</button>}
     </div></>}</td>
   </tr>;})}</tbody></table></div>:<p className="za-empty">{rows.length?'No one matches.':'No one on ZARN yet. Invite your team.'}</p>}</section>

  {form&&<AccessForm mode={form.mode} row={form.row} channels={channels} isMe={form.row?.user_id===me.id} onClose={()=>setForm(null)} onDone={msg=>{setForm(null);setFlash(msg);router.refresh();}}/>}
  {removing&&<div className="za-modal-scrim" onClick={()=>setRemoving(null)}><div className="za-modal" role="alertdialog" aria-label="Remove member" onClick={e=>e.stopPropagation()}>
   <div className="za-modal-head"><span className="za-modal-icon"><Trash2 size={18}/></span><div><strong>Remove {removing.display_name}?</strong><small>{removing.email}</small></div></div>
   <p>{removing.staff_role?'They keep their Studio admin login but lose ZARN.':'Their login is deleted.'} Their messages stay, shown as a former member. To pause access instead, deactivate them.</p>
   <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={()=>setRemoving(null)}>Cancel</button><button type="button" className="za-btn za-btn-danger" disabled={!!busy} onClick={async()=>{await run(removing.user_id,{action:'remove',user_id:removing.user_id},`${removing.display_name} was removed.`);setRemoving(null);}}>Remove</button></div>
  </div></div>}
 </div>;
}

function Toggle({on,disabled,onChange,label,hint}:{on:boolean;disabled?:boolean;onChange:(v:boolean)=>void;label:string;hint:string}){
 return <label className={`za-toggle-row${disabled?' is-disabled':''}`}><span><b>{label}</b><small>{hint}</small></span>
  <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`za-switch-btn${on?' is-on':''}`} onClick={()=>onChange(!on)}><i/></button></label>;
}

function AccessForm({mode,row,channels,isMe,onClose,onDone}:{mode:'invite'|'edit';row?:Row;channels:ChannelOpt[];isMe?:boolean;onClose:()=>void;onDone:(msg:string)=>void}){
 const defaults=channels.filter(c=>c.is_default).map(c=>c.id);
 const [who,setWho]=useState({name:'',email:'',title:''});
 const [a,setA]=useState<Access>(row?{account_type:row.account_type,can_view_crm:row.can_view_crm,can_create_channels:row.can_create_channels,channels:row.channel_ids,expiry:row.expires_at?'custom':'never',custom:row.expires_at?row.expires_at.slice(0,10):''}
  :{account_type:'member',can_view_crm:true,can_create_channels:true,channels:defaults,expiry:'never',custom:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const guest=a.account_type==='guest';
 const setType=(t:'member'|'guest')=>setA(x=>({...x,account_type:t,can_create_channels:t==='guest'?false:x.can_create_channels,can_view_crm:t==='guest'?false:x.can_view_crm,channels:mode==='invite'?(t==='guest'?[]:defaults):x.channels}));
 async function submit(e:React.FormEvent){
  e.preventDefault();setError('');
  if(guest&&!a.channels.length)return setError('Pick at least one channel for a guest.');
  if(guest&&a.expiry==='custom'&&!a.custom)return setError('Pick an end date, or choose “No time limit”.');
  setBusy(true);
  const access={account_type:a.account_type,can_view_crm:a.can_view_crm,can_create_channels:!guest&&a.can_create_channels,channels:a.channels,expires_at:expiryIso(a)};
  try{
   if(mode==='invite'){const r=await zarnApi<{existing?:boolean;emailed?:boolean}>('/api/zarn/admin',{action:'invite',...who,...access});onDone(r.existing?`${who.name} already has a login, so they can sign in to ZARN now.`:r.emailed?`Invite sent to ${who.email}.`:'Added, but the email failed. Use “Resend invite”.');}
   else{await zarnApi('/api/zarn/admin',{action:'update_access',user_id:row!.user_id,...access});onDone(`${row!.display_name}’s access was updated.`);}
  }catch(err){setError(err instanceof Error?err.message:'Something went wrong.');setBusy(false);}
 }
 return <div className="za-modal-scrim" onClick={onClose}><form className="za-modal za-modal-wide za-access" role="dialog" aria-label={mode==='invite'?'Invite to ZARN':'Edit access'} onClick={e=>e.stopPropagation()} onSubmit={submit}>
  <div className="za-modal-head"><span className="za-modal-icon za-modal-icon-brand">{mode==='invite'?<UserPlus size={18}/>:<Pencil size={18}/>}</span><div><strong>{mode==='invite'?'Invite to ZARN':`Edit access: ${row!.display_name}`}</strong><small>{mode==='invite'?'They get an email to set their password.':row!.email}</small></div><button type="button" className="za-icon-btn za-push" aria-label="Close" onClick={onClose}><X size={16}/></button></div>
  <div className="za-access-body" data-lenis-prevent>
   {mode==='invite'&&<div className="za-form-grid">
    <F label="Name *"><input required autoFocus maxLength={80} value={who.name} onChange={e=>setWho({...who,name:e.target.value})}/></F>
    <F label="Email *"><input required type="email" maxLength={254} value={who.email} onChange={e=>setWho({...who,email:e.target.value})}/></F>
    <F label="Title" wide><input maxLength={80} placeholder="e.g. Brand designer" value={who.title} onChange={e=>setWho({...who,title:e.target.value})}/></F>
   </div>}
   <p className="za-access-label">Account type</p>
   <div className="za-role-pick za-role-pick-2">{(['member','guest'] as const).map(t=><button key={t} type="button" role="radio" aria-checked={a.account_type===t} disabled={isMe&&t==='guest'} className={a.account_type===t?'is-on':''} onClick={()=>setType(t)}>
    <span className="za-col-dot" style={{background:t==='member'?'#2563eb':'#f59e0b'}}/><span><strong>{t==='member'?'Member':'Guest'}</strong><small>{t==='member'?'Sees all public channels and the team directory.':'Only the channels you pick, only people in them, optional end date.'}</small></span></button>)}</div>
   <p className="za-access-label">Permissions</p>
   <Toggle on={a.can_view_crm} onChange={v=>setA({...a,can_view_crm:v})} label="CRM access" hint="See the pipeline, lead cards and CRM posts (read-only)."/>
   <Toggle on={!guest&&a.can_create_channels} disabled={guest} onChange={v=>setA({...a,can_create_channels:v})} label="Create channels" hint={guest?'Guests can’t create channels.':'Start new public or private channels.'}/>
   <p className="za-access-label">Channels {guest?'(required)':''}<span>{a.channels.length} selected</span></p>
   <div className="za-zarn-pick za-access-channels">{channels.map(c=><label key={c.id} className="za-check-row"><input type="checkbox" checked={a.channels.includes(c.id)} onChange={e=>setA({...a,channels:e.target.checked?[...a.channels,c.id]:a.channels.filter(x=>x!==c.id)})}/>
    <span><b>{c.kind==='private'?<Lock size={12}/>:<Hash size={12}/>} {c.name}</b><small>{[c.is_default&&'Everyone joins',c.crm_feed&&'CRM updates',c.kind==='private'&&'Private'].filter(Boolean).join(' · ')||'Public'}</small></span></label>)}</div>
   {guest&&<><p className="za-access-label">Time limit</p>
    <div className="za-chips za-expiry">{expiryOptions.map(([k,l])=><button key={k} type="button" className={a.expiry===k?'is-on':''} onClick={()=>setA({...a,expiry:k})}>{l}</button>)}
     {a.expiry==='custom'&&<input type="date" aria-label="End date" min={new Date().toISOString().slice(0,10)} value={a.custom} onChange={e=>setA({...a,custom:e.target.value})}/>}</div>
    <p className="za-modal-hint">Access ends automatically on that date. You can extend it here any time.</p></>}
  </div>
  {error&&<p role="alert" className="za-flash">{error}</p>}
  <div className="za-modal-foot"><button type="button" className="za-btn za-btn-ghost" onClick={onClose}>Cancel</button><button className="za-btn za-btn-primary" disabled={busy}>{busy?'Saving…':mode==='invite'?'Send invite':'Save access'}</button></div>
 </form></div>;
}
