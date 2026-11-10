'use client';
import {useEffect,useState} from 'react';
import {Clock,HeartPulse,Mail,MessageSquare,Phone,Plus,Smile,X} from 'lucide-react';
import {liveStatus,usernameOk,type ZEmergency} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {Avatar} from './format';
import {Modal,squareCrop} from './Dialogs';

type Edit=null|'profile'|'contact'|'about';
// Someone's profile (Slack-style): photo, who they are, how to reach them, and about them. Your own has Edit links on each part.
export default function ProfileSheet({userId,onClose,onEdit}:{userId:string;onClose:()=>void;onEdit:()=>void}){
 const {people,me,online,db,openDm}=useZarn();
 const p=people[userId],isMe=userId===me.user_id,guestViewer=me.account_type==='guest';
 const [em,setEm]=useState<ZEmergency|null>(null),[busy,setBusy]=useState(false),[edit,setEdit]=useState<Edit>(null);
 useEffect(()=>{if(!guestViewer)void db.from('zarn_emergency').select('*').eq('user_id',userId).maybeSingle().then(({data}:{data:ZEmergency|null})=>setEm(data));},[db,userId,guestViewer]);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!edit)onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose,edit]);
 if(!p)return null;
 const email=p.work_email||p.email,on=online.has(userId),bio=(p.bio??'').trim();
 const seen=p.last_seen_at?new Date(p.last_seen_at):null;
 const local=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Lagos'});
 const st=liveStatus(p);
 return <>
  <div className="zn-sheet-scrim" onClick={onClose}><aside className="zn-sheet zn-prof" role="dialog" aria-label={`${p.display_name}’s profile`} onClick={e=>e.stopPropagation()}>
   <header className="zn-prof-head"><b>Profile</b><button type="button" aria-label="Close" onClick={onClose}><X size={20}/></button></header>
   <div className="zn-prof-photo">{p.avatar_url?<img src={p.avatar_url} alt=""/>:<Avatar m={p} size={220}/>}</div>
   <div className="zn-prof-name"><h2>{p.display_name}{p.account_type==='guest'&&<span className="zn-guest-tag">Guest</span>}</h2>{isMe&&<button type="button" className="zn-prof-edit" onClick={()=>setEdit('profile')}>Edit</button>}</div>
   {p.title&&<p className="zn-prof-title">{p.title}</p>}
   {p.username&&<p className="zn-prof-muted">@{p.username}</p>}
   <p className={`zn-prof-line${on?' is-on':''}`}><i/>{on?'Active':seen?`Last seen ${seen.toLocaleDateString()===new Date().toLocaleDateString()?'today':seen.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} at ${seen.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`:'Away'}</p>
   <p className="zn-prof-line"><Clock size={15}/>{local} local time</p>
   {st&&<p className="zn-prof-line"><span>{st.emoji}</span>{st.text}</p>}
   <div className="zn-prof-actions">
    {isMe?<button type="button" className="zn-btn" onClick={onEdit}><Smile size={15}/>{st?'Update status':'Set a status'}</button>
     :<button type="button" className="zn-btn is-primary" disabled={busy} onClick={async()=>{setBusy(true);try{await openDm([userId]);onClose();}finally{setBusy(false);}}}><MessageSquare size={15}/>Message</button>}
    {email&&<a className="zn-btn" href={`mailto:${email}`}><Mail size={15}/>Email</a>}
    {p.phone&&<a className="zn-btn" href={`tel:${p.phone}`}><Phone size={15}/>Call</a>}
   </div>

   <section className="zn-prof-sec">
    <div className="zn-prof-sec-head"><h3>Contact information</h3>{isMe&&<button type="button" className="zn-prof-edit" onClick={()=>setEdit('contact')}>Edit</button>}</div>
    {email&&<a className="zn-prof-contact" href={`mailto:${email}`}><span><Mail size={18}/></span><div><small>Email address</small><b>{email}</b></div></a>}
    {p.phone?<a className="zn-prof-contact" href={`tel:${p.phone}`}><span><Phone size={18}/></span><div><small>Phone</small><b>{p.phone}</b></div></a>
     :isMe?<button type="button" className="zn-prof-add" onClick={()=>setEdit('contact')}><Plus size={15}/>Add phone</button>:null}
   </section>

   <section className="zn-prof-sec">
    <div className="zn-prof-sec-head"><h3>About me</h3>{isMe&&<button type="button" className="zn-prof-edit" onClick={()=>setEdit('about')}>Edit</button>}</div>
    {bio?<p className="zn-prof-bio">{bio}</p>:isMe?<button type="button" className="zn-prof-add" onClick={()=>setEdit('about')}><Plus size={15}/>Add a short bio</button>:<p className="zn-prof-muted">Nothing here yet.</p>}
   </section>

   {!guestViewer&&<section className="zn-prof-sec">
    <div className="zn-prof-sec-head"><h3><HeartPulse size={15}/>Emergency contact</h3>{isMe&&<button type="button" className="zn-prof-edit" onClick={onEdit}>Edit</button>}</div>
    {em&&(em.name||em.phone)?<div className="zn-em-card"><span><b>{em.name||'Emergency contact'}</b>{em.relation&&<small>{em.relation}</small>}</span>
     {em.phone&&<a className="zn-btn" href={`tel:${em.phone}`}><Phone size={14}/>{em.phone}</a>}</div>
     :<p className="zn-prof-muted">{isMe?'Add someone we can call in an emergency.':'Not added yet.'}</p>}
    <p className="zn-prof-muted zn-prof-small">Visible to the team, never to guests.</p>
   </section>}
  </aside></div>
  {edit&&<div className="zn-over-sheet">
   {edit==='profile'&&<EditProfile onClose={()=>setEdit(null)}/>}
   {edit==='contact'&&<EditContact onClose={()=>setEdit(null)}/>}
   {edit==='about'&&<EditAbout onClose={()=>setEdit(null)}/>}
  </div>}
 </>;
}

// Saves fields on your own member row, then refreshes the team list so every profile shows the change.
function useSave(onClose:()=>void){
 const z=useZarn();const [busy,setBusy]=useState(false),[err,setErr]=useState('');
 const save=async(patch:Record<string,unknown>)=>{setBusy(true);setErr('');
  const {error}=await z.db.from('zarn_members').update(patch).eq('user_id',z.me.user_id);
  if(error){setBusy(false);setErr(error.code==='23505'?'That username is taken. Try another.':'Could not save. Try again.');return;}
  await z.reload();setBusy(false);onClose();};
 return {busy,err,setErr,save};
}
const Foot=({busy,onClose}:{busy:boolean;onClose:()=>void})=><div className="zn-prof-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy}>{busy?'Saving…':'Save changes'}</button></div>;

function EditProfile({onClose}:{onClose:()=>void}){
 const z=useZarn(),me=z.people[z.me.user_id]??z.me;
 const [v,setV]=useState({display_name:me.display_name,username:me.username??'',title:me.title});
 const [photo,setPhoto]=useState(me.avatar_url),[uploading,setUploading]=useState(false);
 const {busy,err,setErr,save}=useSave(onClose);
 async function upload(f?:File){if(!f)return;setUploading(true);setErr('');
  try{const form=new FormData();form.set('file',await squareCrop(f));const r=await fetch('/api/zarn/avatar',{method:'POST',body:form});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Upload failed.');setPhoto(d.url);}
  catch(x){setErr(x instanceof Error?x.message:'Upload failed.');}finally{setUploading(false);}}
 async function removePhoto(){setUploading(true);await fetch('/api/zarn/avatar',{method:'DELETE'});setPhoto(null);setUploading(false);}
 return <Modal title="Edit your profile" onClose={onClose} wide><form className="zn-modal-body" onSubmit={e=>{e.preventDefault();
   if(!v.display_name.trim())return setErr('Enter your full name.');
   if(!usernameOk(v.username))return setErr('Usernames are 2 to 30 characters: letters, numbers, dots or underscores.');
   void save({display_name:v.display_name.trim(),username:v.username,title:v.title.trim()});}} data-lenis-prevent>
  <div className="zn-edit-grid">
   <div className="zn-edit-fields">
    <label className="zn-label">Full name<input className="zn-input" autoFocus maxLength={80} value={v.display_name} onChange={e=>setV({...v,display_name:e.target.value})}/></label>
    <label className="zn-label">Username<input className="zn-input" maxLength={30} value={v.username} onChange={e=>setV({...v,username:e.target.value.toLowerCase().replace(/[^a-z0-9._]/g,'')})}/><small className="zn-hint">How people @mention you in ZARN.</small></label>
    <label className="zn-label">Title<input className="zn-input" maxLength={80} placeholder="e.g. Brand designer" value={v.title} onChange={e=>setV({...v,title:e.target.value})}/><small className="zn-hint">Let people know what you do at Zaane.</small></label>
   </div>
   <div className="zn-edit-photo"><span className="zn-label">Profile photo</span>
    <div className="zn-edit-photo-box">{photo?<img src={photo} alt=""/>:<Avatar m={{...me,avatar_url:null}} size={180}/>}</div>
    <label className="zn-btn">{uploading?'Uploading…':'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden disabled={uploading} onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label>
    {photo&&<button type="button" className="zn-link-btn" disabled={uploading} onClick={()=>void removePhoto()}>Remove photo</button>}
   </div>
  </div>
  {err&&<p className="zn-error" role="alert">{err}</p>}
  <Foot busy={busy||uploading} onClose={onClose}/>
 </form></Modal>;
}

function EditContact({onClose}:{onClose:()=>void}){
 const z=useZarn(),me=z.people[z.me.user_id]??z.me;
 const [v,setV]=useState({work_email:me.work_email||me.email,phone:me.phone});
 const {busy,err,setErr,save}=useSave(onClose);
 return <Modal title="Edit contact information" onClose={onClose}><form className="zn-modal-body" onSubmit={e=>{e.preventDefault();
   if(v.work_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.work_email))return setErr('Check the email address.');
   void save({work_email:v.work_email.trim(),phone:v.phone.trim()});}}>
  <label className="zn-label">Email address<input className="zn-input" type="email" maxLength={254} value={v.work_email} onChange={e=>setV({...v,work_email:e.target.value})}/><small className="zn-hint">Shown on your profile. You sign in with {me.email}.</small></label>
  <label className="zn-label">Phone<input className="zn-input" type="tel" maxLength={30} placeholder="+234 …" value={v.phone} onChange={e=>setV({...v,phone:e.target.value})}/><small className="zn-hint">Visible to the team so they can call you.</small></label>
  {err&&<p className="zn-error" role="alert">{err}</p>}
  <Foot busy={busy} onClose={onClose}/>
 </form></Modal>;
}

function EditAbout({onClose}:{onClose:()=>void}){
 const z=useZarn(),me=z.people[z.me.user_id]??z.me;
 const [bio,setBio]=useState(me.bio??'');
 const {busy,err,save}=useSave(onClose);
 return <Modal title="About me" onClose={onClose}><form className="zn-modal-body" onSubmit={e=>{e.preventDefault();void save({bio:bio.trim()});}}>
  <label className="zn-label">Bio<textarea className="zn-input zn-bio-in" autoFocus rows={5} maxLength={600} placeholder="A few lines about you: what you work on, what you're good at, how you like to work." value={bio} onChange={e=>setBio(e.target.value)}/><small className="zn-hint">{bio.length} / 600</small></label>
  {err&&<p className="zn-error" role="alert">{err}</p>}
  <Foot busy={busy} onClose={onClose}/>
 </form></Modal>;
}
