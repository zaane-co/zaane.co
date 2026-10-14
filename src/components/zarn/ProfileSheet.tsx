'use client';
import {useEffect,useState} from 'react';
import {AtSign,Copy,HeartPulse,Mail,MessageSquare,Pencil,Phone,X} from 'lucide-react';
import type {ZEmergency} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {Avatar} from './format';

// Someone's profile (Slack-style): who they are, how to reach them, and a button to message them privately.
export default function ProfileSheet({userId,onClose,onEdit}:{userId:string;onClose:()=>void;onEdit:()=>void}){
 const {people,me,online,db,openDm}=useZarn();
 const p=people[userId],isMe=userId===me.user_id,guestViewer=me.account_type==='guest';
 const [em,setEm]=useState<ZEmergency|null>(null),[copied,setCopied]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!guestViewer)void db.from('zarn_emergency').select('*').eq('user_id',userId).maybeSingle().then(({data}:{data:ZEmergency|null})=>setEm(data));},[db,userId,guestViewer]);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose]);
 if(!p)return null;
 const email=p.work_email||p.email,on=online.has(userId);
 const copy=(v:string,label:string)=>{void navigator.clipboard?.writeText(v).then(()=>{setCopied(label);setTimeout(()=>setCopied(''),1400);});};
 const seen=p.last_seen_at?new Date(p.last_seen_at):null;
 return <div className="zn-sheet-scrim" onClick={onClose}><aside className="zn-sheet" role="dialog" aria-label={`${p.display_name}’s profile`} onClick={e=>e.stopPropagation()}>
  <button type="button" className="zn-sheet-close" aria-label="Close" onClick={onClose}><X size={20}/></button>
  <div className="zn-profile-hero"><Avatar m={p} size={96} online={on}/></div>
  <div className="zn-profile-name">
   <h2>{p.display_name}{p.account_type==='guest'&&<span className="zn-guest-tag">Guest</span>}</h2>
   {p.username&&<p className="zn-handle">@{p.username}</p>}
   {p.title&&<p className="zn-ptitle">{p.title}</p>}
   <p className={`zn-presence${on?' is-on':''}`}>{on?'Active now':seen?`Last seen ${seen.toLocaleDateString()===new Date().toLocaleDateString()?'today':seen.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} at ${seen.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`:'Offline'}</p>
   {p.status_text&&<p className="zn-pstatus">“{p.status_text}”</p>}
  </div>
  <div className="zn-profile-actions">
   {isMe?<button type="button" className="zn-btn is-primary" onClick={onEdit}><Pencil size={15}/>Edit profile</button>
    :<button type="button" className="zn-btn is-primary" disabled={busy} onClick={async()=>{setBusy(true);try{await openDm([userId]);onClose();}finally{setBusy(false);}}}><MessageSquare size={15}/>Message</button>}
   {p.phone&&<a className="zn-btn" href={`tel:${p.phone}`}><Phone size={15}/>Call</a>}
   {email&&<a className="zn-btn" href={`mailto:${email}`}><Mail size={15}/>Email</a>}
  </div>
  <dl className="zn-pfields">
   {p.username&&<><dt><AtSign size={14}/>Username</dt><dd>@{p.username}</dd></>}
   {email&&<><dt><Mail size={14}/>Work email</dt><dd><button type="button" onClick={()=>copy(email,'email')}>{email}<Copy size={12}/>{copied==='email'&&<em>Copied</em>}</button></dd></>}
   <dt><Phone size={14}/>Hotline</dt><dd>{p.phone?<button type="button" onClick={()=>copy(p.phone,'phone')}>{p.phone}<Copy size={12}/>{copied==='phone'&&<em>Copied</em>}</button>:<span className="zn-muted">Not added</span>}</dd>
  </dl>
  {!guestViewer&&<section className="zn-emergency">
   <h3><HeartPulse size={15}/>Emergency contact</h3>
   {em&&(em.name||em.phone)?<div className="zn-em-card"><span><b>{em.name||'Emergency contact'}</b>{em.relation&&<small>{em.relation}</small>}</span>
    {em.phone&&<a className="zn-btn" href={`tel:${em.phone}`}><Phone size={14}/>{em.phone}</a>}</div>
    :<p className="zn-muted">{isMe?'Add someone we can call in an emergency.':'Not added yet.'}</p>}
   <p className="zn-note">Visible to the team, never to guests.</p>
  </section>}
 </aside></div>;
}
