'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Check,Hash,Lock,Search as SearchIcon,X} from 'lucide-react';
import {channelHref,channelSlug,usernameOk,zarnApi,type ZChannel,type ZMessage} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {Avatar,dayOf,plain,timeOf} from './format';

function Modal({title,onClose,children,wide}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}){
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose]);
 return <div className="zn-modal-scrim" onClick={onClose}><div className={`zn-modal${wide?' zn-modal-lg':''}`} role="dialog" aria-label={title} onClick={e=>e.stopPropagation()}>
  <div className="zn-modal-head"><h2>{title}</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>{children}</div></div>;
}

export function PeoplePicker({title,exclude=[],confirm,onClose,onPick,max=50}:{title:string;exclude?:string[];confirm:string;onClose:()=>void;onPick:(ids:string[])=>Promise<void>|void;max?:number}){
 const {members,me,online}=useZarn();
 const [q,setQ]=useState(''),[sel,setSel]=useState<string[]>([]),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const list=members.filter(m=>!m.deactivated_at&&m.user_id!==me.user_id&&!exclude.includes(m.user_id)&&`${m.display_name} ${m.title} ${m.email}`.toLowerCase().includes(q.toLowerCase()));
 return <Modal title={title} onClose={onClose}>
  <input className="zn-input" autoFocus placeholder="Search people" value={q} onChange={e=>setQ(e.target.value)}/>
  <ul className="zn-list zn-list-scroll">{list.map(m=><li key={m.user_id}><button type="button" className={sel.includes(m.user_id)?'is-on':''} onClick={()=>setSel(s=>s.includes(m.user_id)?s.filter(x=>x!==m.user_id):s.length<max?[...s,m.user_id]:s)}>
   <Avatar m={m} size={30} online={online.has(m.user_id)}/><span><b>{m.display_name}</b><small>{m.title||m.email}</small></span>{sel.includes(m.user_id)&&<Check size={16} className="zn-check"/>}</button></li>)}
   {!list.length&&<li className="zn-empty-row">No one to add.</li>}</ul>
  {err&&<p className="zn-error">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="button" className="zn-btn is-primary" disabled={!sel.length||busy} onClick={async()=>{setBusy(true);setErr('');try{await onPick(sel);}catch(e){setErr(e instanceof Error?e.message:'Something went wrong.');}finally{setBusy(false);}}}>{busy?'Working…':`${confirm}${sel.length?` (${sel.length})`:''}`}</button></div>
 </Modal>;
}

export function NewChannel({onClose}:{onClose:()=>void}){
 const z=useZarn(),router=useRouter();
 const [name,setName]=useState(''),[kind,setKind]=useState<'public'|'private'>('public'),[topic,setTopic]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 async function create(e:React.FormEvent){
  e.preventDefault();setBusy(true);setErr('');
  try{const r=await zarnApi<{id:string}>('/api/zarn',{action:'channel_create',name,kind,topic});await z.reload();onClose();router.push(`/zarn/c/${r.id}`);}
  catch(x){setErr(x instanceof Error?x.message:'Could not create it.');setBusy(false);}
 }
 return <Modal title="Create a channel" onClose={onClose}><form onSubmit={create} className="zn-modal-body">
  <label className="zn-label">Name<span className="zn-prefix"><Hash size={15}/><input className="zn-input" autoFocus required maxLength={80} placeholder="e.g. design-reviews" value={name} onChange={e=>setName(e.target.value)}/></span>{name&&channelSlug(name)!==name&&<small>Will be created as #{channelSlug(name)}</small>}</label>
  <label className="zn-label">Topic (optional)<input className="zn-input" maxLength={250} value={topic} onChange={e=>setTopic(e.target.value)}/></label>
  <div className="zn-choice">{(['public','private'] as const).map(k=><button key={k} type="button" className={kind===k?'is-on':''} onClick={()=>setKind(k)}>{k==='public'?<Hash size={16}/>:<Lock size={16}/>}<span><b>{k==='public'?'Public':'Private'}</b><small>{k==='public'?'Anyone on ZARN can find and join':'Only people you add can see it'}</small></span></button>)}</div>
  {err&&<p className="zn-error">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy||!channelSlug(name)}>{busy?'Creating…':'Create'}</button></div>
 </form></Modal>;
}

export function NewDm({onClose}:{onClose:()=>void}){
 const {openDm}=useZarn();
 return <PeoplePicker title="New message" confirm="Start conversation" max={8} onClose={onClose} onPick={async ids=>{await openDm(ids);onClose();}}/>;
}

export function Browse({onClose}:{onClose:()=>void}){
 const z=useZarn(),router=useRouter();
 const [q,setQ]=useState('');
 const list=z.channels.filter(c=>c.kind==='public'&&!c.archived_at&&(c.name??'').includes(q.toLowerCase()));
 const join=async(c:ZChannel)=>{if(!z.membership[c.id]){await z.db.from('zarn_channel_members').insert({channel_id:c.id,user_id:z.me.user_id});await z.reload();}onClose();router.push(`/zarn/c/${c.id}`);};
 return <Modal title="Browse channels" onClose={onClose}>
  <input className="zn-input" autoFocus placeholder="Search channels" value={q} onChange={e=>setQ(e.target.value)}/>
  <ul className="zn-list zn-list-scroll">{list.map(c=><li key={c.id}><button type="button" onClick={()=>void join(c)}><Hash size={16}/><span><b>{c.name}</b><small>{c.topic||'No topic'}</small></span><em>{z.membership[c.id]?'Joined':'Join'}</em></button></li>)}
   {!list.length&&<li className="zn-empty-row">No channels match.</li>}</ul>
 </Modal>;
}

export function SearchDialog({onClose}:{onClose:()=>void}){
 const {db,people,channels,title}=useZarn(),router=useRouter();
 const [q,setQ]=useState(''),[rows,setRows]=useState<ZMessage[]>([]),[busy,setBusy]=useState(false);
 useEffect(()=>{
  const s=q.trim();if(s.length<2)return;
  const t=setTimeout(async()=>{setBusy(true);const {data}=await db.from('zarn_messages').select('*').ilike('body',`%${s.replace(/[%_]/g,'')}%`).is('deleted_at',null).order('created_at',{ascending:false}).limit(30);setRows((data??[]) as ZMessage[]);setBusy(false);},250);
  return()=>clearTimeout(t);
 },[q,db]);
 return <Modal title="Search ZARN" onClose={onClose} wide>
  <span className="zn-prefix"><SearchIcon size={16}/><input className="zn-input" autoFocus placeholder="Search messages" value={q} onChange={e=>setQ(e.target.value)}/></span>
  <ul className="zn-list zn-list-scroll">{(q.trim().length>=2?rows:[]).map(m=>{const c=channels.find(x=>x.id===m.channel_id);return <li key={m.id}><button type="button" onClick={()=>{onClose();router.push(`${channelHref(c,m.channel_id)}${m.parent_id?'':`#m-${m.id}`}`);}}>
   <Avatar m={people[m.user_id??'']} size={30}/><span><b>{people[m.user_id??'']?.display_name??'CRM'} <small>in {c?(c.kind==='dm'||c.kind==='client'?title(c):`#${c.name}`):'a channel'} · {dayOf(m.created_at)} {timeOf(m.created_at)}</small></b><small className="zn-snippet">{plain(m.body,people).slice(0,160)}</small></span></button></li>;})}
   {q.trim().length>=2&&!busy&&!rows.length&&<li className="zn-empty-row">No messages found.</li>}</ul>
 </Modal>;
}

export function Profile({onClose}:{onClose:()=>void}){
 const z=useZarn(),me=z.me;
 const [v,setV]=useState({display_name:me.display_name,username:me.username??'',title:me.title,status_text:me.status_text,work_email:me.work_email||me.email,phone:me.phone});
 const [em,setEm]=useState({name:'',relation:'',phone:''}),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 useEffect(()=>{void z.db.from('zarn_emergency').select('name,relation,phone').eq('user_id',me.user_id).maybeSingle().then(({data}:{data:{name:string;relation:string;phone:string}|null})=>{if(data)setEm(data);});},[z.db,me.user_id]);
 const set=(k:keyof typeof v)=>(e:React.ChangeEvent<HTMLInputElement>)=>setV(s=>({...s,[k]:k==='username'?e.target.value.toLowerCase().replace(/[^a-z0-9._]/g,''):e.target.value}));
 async function save(e:React.FormEvent){
  e.preventDefault();setErr('');
  if(!v.display_name.trim())return setErr('Enter your name.');
  if(!usernameOk(v.username))return setErr('Usernames are 2 to 30 characters: letters, numbers, dots or underscores, starting with a letter or number.');
  if(v.work_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.work_email))return setErr('Check the work email.');
  setBusy(true);
  const {error}=await z.db.from('zarn_members').update({display_name:v.display_name.trim(),username:v.username,title:v.title.trim(),status_text:v.status_text.trim(),work_email:v.work_email.trim(),phone:v.phone.trim()}).eq('user_id',me.user_id);
  if(error){setBusy(false);return setErr(error.code==='23505'?`@${v.username} is taken. Try another.`:'Could not save.');}
  const {error:e2}=await z.db.from('zarn_emergency').upsert({user_id:me.user_id,name:em.name.trim(),relation:em.relation.trim(),phone:em.phone.trim(),updated_at:new Date().toISOString()});
  setBusy(false);if(e2)return setErr('Saved your profile, but not the emergency contact. Try again.');
  await z.reload();onClose();window.location.reload();
 }
 return <Modal title="Edit profile" onClose={onClose}><form className="zn-modal-body" onSubmit={save} data-lenis-prevent>
  <div className="zn-grid-2">
   <label className="zn-label">Full name<input className="zn-input" maxLength={80} value={v.display_name} onChange={set('display_name')}/></label>
   <label className="zn-label">Username<span className="zn-prefix zn-at"><AtSignIcon/><input className="zn-input" maxLength={30} value={v.username} onChange={set('username')}/></span></label>
  </div>
  <label className="zn-label">Title<input className="zn-input" maxLength={80} placeholder="e.g. Product designer" value={v.title} onChange={set('title')}/></label>
  <label className="zn-label">Status<input className="zn-input" maxLength={100} placeholder="e.g. In a client call until 3pm" value={v.status_text} onChange={set('status_text')}/></label>
  <div className="zn-grid-2">
   <label className="zn-label">Work email<input className="zn-input" type="email" maxLength={254} value={v.work_email} onChange={set('work_email')}/></label>
   <label className="zn-label">Hotline<input className="zn-input" type="tel" maxLength={40} placeholder="+234 …" value={v.phone} onChange={set('phone')}/></label>
  </div>
  <p className="zn-label">Emergency contact <small>Visible to the team, never to guests.</small></p>
  <div className="zn-grid-3">
   <input className="zn-input" aria-label="Emergency contact name" maxLength={80} placeholder="Name" value={em.name} onChange={e=>setEm({...em,name:e.target.value})}/>
   <input className="zn-input" aria-label="Relationship" maxLength={40} placeholder="Relationship" value={em.relation} onChange={e=>setEm({...em,relation:e.target.value})}/>
   <input className="zn-input" aria-label="Emergency phone" type="tel" maxLength={40} placeholder="Phone" value={em.phone} onChange={e=>setEm({...em,phone:e.target.value})}/>
  </div>
  {err&&<p className="zn-error">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy}>{busy?'Saving…':'Save'}</button></div>
 </form></Modal>;
}
const AtSignIcon=()=><span className="zn-at-sign">@</span>;

// Admin-only: invite straight from inside ZARN.
export function Invite({onClose}:{onClose:()=>void}){
 const z=useZarn();
 const [v,setV]=useState({name:'',email:'',title:''}),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[err,setErr]=useState('');
 async function send(e:React.FormEvent){
  e.preventDefault();setBusy(true);setErr('');setMsg('');
  try{const r=await zarnApi<{existing?:boolean;emailed?:boolean}>('/api/zarn/admin',{action:'invite',...v});setMsg(r.existing?`${v.name} already had a Zaane login, so they can sign in to ZARN now.`:r.emailed?`Invite sent to ${v.email}.`:'They were added, but the email failed. Resend it from ZARN admin.');setV({name:'',email:'',title:''});await z.reload();}
  catch(x){setErr(x instanceof Error?x.message:'Could not invite.');}finally{setBusy(false);}
 }
 return <Modal title="Invite people to ZARN" onClose={onClose}><form className="zn-modal-body" onSubmit={send}>
  <label className="zn-label">Name<input className="zn-input" autoFocus required maxLength={80} value={v.name} onChange={e=>setV({...v,name:e.target.value})}/></label>
  <label className="zn-label">Email<input className="zn-input" required type="email" maxLength={254} value={v.email} onChange={e=>setV({...v,email:e.target.value})}/></label>
  <label className="zn-label">Title (optional)<input className="zn-input" maxLength={80} value={v.title} onChange={e=>setV({...v,title:e.target.value})}/></label>
  <p className="zn-note">They’ll join #general and #random, and get an email to set their password.</p>
  {msg&&<p className="zn-ok">{msg}</p>}{err&&<p className="zn-error">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Done</button><button className="zn-btn is-primary" disabled={busy}>{busy?'Sending…':'Send invite'}</button></div>
 </form></Modal>;
}
