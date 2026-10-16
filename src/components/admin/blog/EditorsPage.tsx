'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {AlertTriangle,Check,ChevronRight,Copy,Mail,X} from 'lucide-react';
import {t,fmt} from './shared';

export type Editor={id:string;name:string;first_name:string|null;last_name:string|null;email:string;bio:string|null;verified:boolean;last_sign_in_at:string|null;post_count:number;created_at:string};
const PERMISSIONS=['Write blog posts and save drafts','View comments and post metrics','Edit their drafts until an admin publishes'];
const initials=(e:Editor)=>((e.first_name??e.name.split(' ')[0]??'')[0]??'')+((e.last_name??e.name.split(' ')[1]??'')[0]??'');
function timeAgo(d:string|null,now:number){
 if(!d)return 'Never';const mins=Math.floor((now-new Date(d).getTime())/60000);
 if(mins<1)return 'Just now';if(mins<60)return `${mins}m ago`;const hrs=Math.floor(mins/60);if(hrs<24)return `${hrs}h ago`;const days=Math.floor(hrs/24);return days<30?`${days}d ago`:fmt(d);
}
async function api(body:object){const r=await fetch('/api/admin/editors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;}
const Badge=({on,long}:{on:boolean;long?:boolean})=><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${on?'bg-[#16a34a] text-white':'bg-[#f59e0b] text-[#1a1200]'}`}><span className={`h-1.5 w-1.5 rounded-full inline-block ${on?'bg-white':'bg-[#1a1200]'}`}/>{on?'Active':long?'Pending login':'Pending'}</span>;

export default function EditorsPage({initialEditors,now}:{initialEditors:Editor[];now:number}){
 const router=useRouter();
 const [editors,setEditors]=useState(initialEditors);
 const [selected,setSelected]=useState<Editor|null>(null);
 const [firstName,setFirstName]=useState(''),[lastName,setLastName]=useState(''),[email,setEmail]=useState(''),[bio,setBio]=useState('');
 const [saving,setSaving]=useState(false),[formError,setFormError]=useState(''),[success,setSuccess]=useState<{editor:Editor;emailed:boolean;existing?:boolean}|null>(null);
 const [subject,setSubject]=useState(''),[message,setMessage]=useState(''),[sending,setSending]=useState(false),[sent,setSent]=useState(false),[emailError,setEmailError]=useState(''),[compose,setCompose]=useState(false);
 const [deleteConfirm,setDeleteConfirm]=useState<Editor|null>(null),[deleting,setDeleting]=useState(false),[copied,setCopied]=useState(false);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')setSelected(null);};document.addEventListener('keydown',k);return()=>document.removeEventListener('keydown',k);},[]);

 async function handleAdd(){
  if(!firstName.trim()||!email.trim())return setFormError('First name and email are required.');
  setSaving(true);setFormError('');
  try{const d=await api({action:'invite',first_name:firstName,last_name:lastName,email,bio});setEditors(p=>[d.editor,...p]);setSuccess({editor:d.editor,emailed:d.emailed,existing:d.existing});setFirstName('');setLastName('');setEmail('');setBio('');router.refresh();}
  catch(e){setFormError(e instanceof Error?e.message:'Failed to invite editor.');}
  setSaving(false);
 }
 async function handleDelete(){
  if(!deleteConfirm)return;setDeleting(true);
  try{await api({action:'delete',id:deleteConfirm.id});setEditors(p=>p.filter(e=>e.id!==deleteConfirm.id));if(selected?.id===deleteConfirm.id)setSelected(null);setDeleteConfirm(null);router.refresh();}
  catch(e){setEmailError(e instanceof Error?e.message:'Could not remove.');setDeleteConfirm(null);}
  setDeleting(false);
 }
 async function handleSend(){
  if(!selected||!subject.trim()||!message.trim())return;setSending(true);setEmailError('');
  try{await api({action:'email',id:selected.id,subject,body:message});setSent(true);setSubject('');setMessage('');setTimeout(()=>{setSent(false);setCompose(false);},2500);}
  catch(e){setEmailError(e instanceof Error?e.message:'Failed to send.');}
  setSending(false);
 }
 const open=(e:Editor)=>{setSelected(e);setCompose(false);setSent(false);setSubject('');setMessage('');setEmailError('');};
 const field=`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none transition-colors ${t.input}`;
 const avatar=(e:Editor,size:string)=><div className={`${size} rounded-full flex items-center justify-center shrink-0 font-bold uppercase bg-[var(--accent)] text-white`}>{initials(e)||e.name[0]}</div>;

 return <div className="flex flex-col lg:flex-row gap-6 min-h-0">
  <div className="w-full lg:w-72 flex-none space-y-5 self-start lg:sticky lg:top-0">
   <div className={`rounded-2xl border p-5 space-y-4 ${t.card}`}>
    <div><p className={`text-sm font-bold ${t.heading}`}>Add Editor</p><p className={`text-xs mt-0.5 ${t.sub}`}>They’ll get an invite email to set their password.</p></div>
    {formError&&<div className="rounded-lg bg-[#dc2626] px-3 py-2.5 text-xs text-white">{formError}</div>}
    <div className="space-y-3">
     <div className="grid grid-cols-2 gap-2">
      <label className="space-y-1"><span className={`text-xs font-medium ${t.sub}`}>First Name *</span><input value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Amaka" className={field}/></label>
      <label className="space-y-1"><span className={`text-xs font-medium ${t.sub}`}>Last Name</span><input value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Okafor" className={field}/></label>
     </div>
     <label className="block space-y-1"><span className={`text-xs font-medium ${t.sub}`}>Email Address *</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="amaka@example.com" className={field}/></label>
     <label className="block space-y-1"><span className={`text-xs font-medium ${t.sub}`}>Bio <span className={t.faint}>(optional)</span></span><textarea value={bio} onChange={e=>setBio(e.target.value)} rows={3} maxLength={600} placeholder="Short bio shown on published articles…" className={`${field} resize-none`}/></label>
    </div>
    <button onClick={handleAdd} disabled={saving} className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-opacity disabled:opacity-50 ${t.brandBtn}`}>{saving?'Inviting…':'Invite Editor →'}</button>
   </div>
   <div className={`rounded-2xl border p-5 space-y-3 ${t.card}`}>
    <p className={`text-xs font-semibold uppercase tracking-wide ${t.sub}`}>Editor Permissions</p>
    {PERMISSIONS.map(p=><div key={p} className="flex items-center gap-2.5"><div className="h-5 w-5 rounded-md bg-[#16a34a] flex items-center justify-center flex-none"><Check className="h-2.5 w-2.5 text-white" strokeWidth={3}/></div><p className={`text-xs ${t.sub}`}>{p}</p></div>)}
    <p className={`text-[11px] pt-1 ${t.faint}`}>Editors can’t publish, delete posts, or access leads, contacts, settings or users.</p>
   </div>
  </div>

  <div className="flex-1 min-w-0">
   {emailError&&!selected&&<div className="mb-3 rounded-lg bg-[#dc2626] px-4 py-3 text-xs text-white">{emailError}</div>}
   <div className={`rounded-2xl border overflow-hidden ${t.card}`}>
    <div className={`flex items-center justify-between px-5 py-4 border-b ${t.divider}`}><div><p className={`text-sm font-bold ${t.heading}`}>All Editors</p><p className={`text-xs mt-0.5 ${t.sub}`}>{editors.length} editor{editors.length!==1?'s':''}</p></div></div>
    {editors.length===0?<div className={`py-20 text-center text-sm ${t.sub}`}>No editors yet. Add your first editor on the left.</div>:<div>
     {editors.map(ed=><button key={ed.id} onClick={()=>open(ed)} className={`w-full text-left flex items-center gap-4 px-5 py-4 border-b last:border-0 transition-colors ${t.divider} hover:bg-[var(--a-hover)] ${selected?.id===ed.id?'bg-[var(--a-hover)]':''}`}>
      {avatar(ed,'h-10 w-10 text-sm')}
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><p className={`text-sm font-semibold ${t.heading}`}>{ed.name}</p><Badge on={ed.verified}/></div><p className={`text-xs mt-0.5 truncate ${t.sub}`}>{ed.email}</p></div>
      <div className={`text-xs text-right shrink-0 hidden sm:block ${t.sub}`}><p>Added {fmt(ed.created_at)}</p>{ed.last_sign_in_at&&<p className="mt-0.5">Last seen {timeAgo(ed.last_sign_in_at,now)}</p>}</div>
      <ChevronRight className={`h-4 w-4 shrink-0 ${t.sub}`}/>
     </button>)}
    </div>}
   </div>
  </div>

  {selected&&<div className="fixed inset-0 z-40 bg-black/40" onClick={()=>setSelected(null)}/>}
  <div className={`fixed top-0 right-0 h-full z-50 w-full max-w-96 border-l shadow-2xl flex flex-col transition-transform duration-300 ease-out ${t.card} ${selected?'translate-x-0':'translate-x-full'}`}>
   {selected&&<>
    <div className={`flex items-center justify-between px-5 py-4 border-b ${t.divider}`}><p className={`text-sm font-bold ${t.heading}`}>Editor Profile</p><button onClick={()=>setSelected(null)} aria-label="Close" data-tip="Close" className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${t.iconBtn}`}><X className="h-4 w-4" strokeWidth={2.5}/></button></div>
    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5" data-lenis-prevent>
     <div className={`rounded-xl border p-4 ${t.soft} ${t.divider}`}>
      <div className="flex items-start gap-4">{avatar(selected,'h-14 w-14 text-xl')}
       <div className="min-w-0 flex-1"><p className={`text-base font-bold leading-tight ${t.heading}`}>{selected.name}</p><p className={`text-xs mt-0.5 truncate ${t.sub}`}>{selected.email}</p><div className="flex items-center gap-2 mt-2"><Badge on={selected.verified} long/><span className={`text-[10px] ${t.sub}`}>Joined {fmt(selected.created_at)}</span></div></div>
      </div>
      {selected.bio&&<p className={`mt-3 text-xs leading-relaxed ${t.sub}`}>{selected.bio}</p>}
     </div>
     <div><p className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${t.sub}`}>Analytics</p>
      <div className="grid grid-cols-2 gap-3">
       <div className={`rounded-xl border p-3 text-center ${t.soft} ${t.divider}`}><p className={`text-2xl font-bold ${t.heading}`}>{selected.post_count}</p><p className={`text-[11px] mt-0.5 ${t.sub}`}>Posts written</p></div>
       <div className={`rounded-xl border p-3 text-center ${t.soft} ${t.divider}`}><p className={`text-sm font-bold ${t.heading}`}>{timeAgo(selected.last_sign_in_at,now)}</p><p className={`text-[11px] mt-0.5 ${t.sub}`}>Last active</p></div>
      </div>
     </div>
     <div><p className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${t.sub}`}>Actions</p>
      <div className="flex gap-2">
       <button onClick={()=>{setCompose(v=>!v);setSent(false);setEmailError('');}} className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition-colors ${t.ghostBtn}`}><Mail className="h-3.5 w-3.5"/>Send Email</button>
       <button onClick={()=>{void navigator.clipboard.writeText(selected.email);setCopied(true);setTimeout(()=>setCopied(false),1500);}} className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition-colors ${t.ghostBtn}`}>{copied?<Check className="h-3.5 w-3.5"/>:<Copy className="h-3.5 w-3.5"/>}{copied?'Copied':'Copy Email'}</button>
      </div>
     </div>
     {compose&&<div className={`rounded-xl border p-4 space-y-3 ${t.soft} ${t.divider}`}>
      <p className={`text-xs font-semibold ${t.heading}`}>Compose email to {selected.first_name??selected.name.split(' ')[0]}</p>
      {sent&&<div className="rounded-lg bg-[#16a34a] px-3 py-2.5 text-xs text-white flex items-center gap-2"><Check className="h-3.5 w-3.5" strokeWidth={2.5}/>Email sent!</div>}
      {emailError&&<div className="rounded-lg bg-[#dc2626] px-3 py-2.5 text-xs text-white">{emailError}</div>}
      <label className="block space-y-1"><span className={`text-[11px] font-medium ${t.sub}`}>Subject</span><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Welcome to the Zaane blog" className={field}/></label>
      <label className="block space-y-1"><span className={`text-[11px] font-medium ${t.sub}`}>Message</span><textarea value={message} onChange={e=>setMessage(e.target.value)} rows={5} placeholder="Write your message here…" className={`${field} resize-none`}/></label>
      <button onClick={handleSend} disabled={sending||!subject.trim()||!message.trim()} className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${t.brandBtn}`}>{sending?'Sending…':'Send Email'}</button>
     </div>}
     <div className={`rounded-xl border p-4 border-[#dc2626] ${t.soft}`}>
      <p className="text-xs font-semibold mb-2 text-[#dc2626]">Danger Zone</p>
      <p className={`text-[11px] mb-3 ${t.sub}`}>Removing this editor will delete their account and revoke all access.</p>
      <button onClick={()=>setDeleteConfirm(selected)} className="w-full py-2 rounded-xl text-xs font-semibold text-white bg-[#dc2626] hover:bg-[#b91c1c] transition-colors">Remove Editor</button>
     </div>
    </div>
   </>}
  </div>

  {success&&<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
   <div className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-5 ${t.modal}`}>
    <div className="flex items-center gap-4">
     <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-none text-white ${success.emailed?'bg-[#16a34a]':'bg-[#f59e0b]'}`}>{success.emailed?<Check className="h-6 w-6"/>:<AlertTriangle className="h-6 w-6"/>}</div>
     <div><p className={`text-base font-bold ${t.heading}`}>{success.existing?'Editor Added!':success.emailed?'Invite Sent!':'Editor Created'}</p><p className={`text-xs mt-0.5 ${t.sub}`}>{success.existing?`${success.editor.name} already had an account, so they’re now an editor and can sign in with their current password.`:success.emailed?`${success.editor.name} will get an email to set their password.`:'The invite email could not be sent. Remove and re-add them to try again.'}</p></div>
    </div>
    <div className={`rounded-xl p-4 space-y-1 border ${t.soft} ${t.divider}`}><p className={`text-xs font-medium ${t.sub}`}>Login Email</p><p className={`text-sm font-semibold ${t.heading}`}>{success.editor.email}</p></div>
    <button onClick={()=>setSuccess(null)} className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${t.brandBtn}`}>Done</button>
   </div>
  </div>}

  {deleteConfirm&&<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={()=>setDeleteConfirm(null)}>
   <div className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-4 ${t.modal}`} onClick={e=>e.stopPropagation()}>
    <div className="flex items-center gap-4"><div className="h-11 w-11 rounded-full bg-[#dc2626] flex items-center justify-center flex-none"><AlertTriangle className="h-5 w-5 text-white"/></div><div><p className={`text-sm font-bold ${t.heading}`}>Remove Editor?</p><p className={`text-xs mt-0.5 ${t.sub}`}>{deleteConfirm.name}</p></div></div>
    <p className={`text-sm ${t.sub}`}>This will permanently delete their account. This action cannot be undone.</p>
    <div className="flex gap-2 pt-1">
     <button onClick={()=>setDeleteConfirm(null)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${t.ghostBtn}`}>Cancel</button>
     <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#dc2626] hover:bg-[#b91c1c] transition-colors disabled:opacity-50">{deleting?'Removing…':'Remove'}</button>
    </div>
   </div>
  </div>}
 </div>;
}
