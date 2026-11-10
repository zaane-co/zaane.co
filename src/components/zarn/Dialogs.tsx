'use client';
import Dropdown from '@/components/ui/Dropdown';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Check,FileText,Hash,HeartPulse,Lock,MessageSquare,Phone,Search as SearchIcon,Smile,UserRound,X} from 'lucide-react';
const MessageSquareIcon=()=><MessageSquare size={15}/>;
import {channelHref,channelSlug,clearAt,clearOptions,liveStatus,statusPresets,usernameOk,zarnApi,type ZAttachment,type ZChannel,type ZMessage} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {Avatar,dayOf,plain,timeOf} from './format';
import AssigneePicker from './AssigneePicker';

export function Modal({title,onClose,children,wide}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}){
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose]);
 return <div className="zn-modal-scrim" onClick={onClose}><div className={`zn-modal${wide?' zn-modal-lg':''}`} role="dialog" aria-label={title} data-lenis-prevent onClick={e=>e.stopPropagation()}>
  <div className="zn-modal-head"><h2>{title}</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>{children}</div></div>;
}

export function PeoplePicker({title,exclude=[],confirm,onClose,onPick,max=50,instant=false}:{title:string;exclude?:string[];confirm:string;onClose:()=>void;onPick:(ids:string[])=>Promise<void>|void;max?:number;instant?:boolean}){
 const {members,me,online}=useZarn();
 const [q,setQ]=useState(''),[sel,setSel]=useState<string[]>([]),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const list=members.filter(m=>!m.deactivated_at&&m.user_id!==me.user_id&&!exclude.includes(m.user_id)&&`${m.display_name} ${m.title} ${m.email}`.toLowerCase().includes(q.toLowerCase()));
 return <Modal title={title} onClose={onClose}>
  <input className="zn-input" autoFocus placeholder="Search people" value={q} onChange={e=>setQ(e.target.value)}/>
  <ul className="zn-list zn-list-scroll">{list.map(m=><li key={m.user_id}><button type="button" className={sel.includes(m.user_id)?'is-on':''} onClick={instant?async()=>{if(busy)return;setBusy(true);setErr('');try{await onPick([m.user_id]);}catch(e){setErr(e instanceof Error?e.message:'Something went wrong.');setBusy(false);}}:()=>setSel(s=>s.includes(m.user_id)?s.filter(x=>x!==m.user_id):s.length<max?[...s,m.user_id]:s)}>
   <Avatar m={m} size={30} online={online.has(m.user_id)}/><span><b>{m.display_name}</b><small>{m.title||m.email}</small></span>{sel.includes(m.user_id)&&<Check size={16} className="zn-check"/>}</button></li>)}
   {!list.length&&<li className="zn-empty-row">No one to add.</li>}</ul>
  {err&&<p className="zn-error">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button>{!instant&&<button type="button" className="zn-btn is-primary" disabled={!sel.length||busy} onClick={async()=>{setBusy(true);setErr('');try{await onPick(sel);}catch(e){setErr(e instanceof Error?e.message:'Something went wrong.');}finally{setBusy(false);}}}>{busy?'Working…':`${confirm}${sel.length?` (${sel.length})`:''}`}</button>}</div>
 </Modal>;
}

export function NewChannel({onClose}:{onClose:()=>void}){
 const z=useZarn(),router=useRouter();
 const [name,setName]=useState(''),[kind,setKind]=useState<'public'|'private'>('public'),[topic,setTopic]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[people,setPeople]=useState<string[]>([]);
 async function create(e:React.FormEvent){
  e.preventDefault();setBusy(true);setErr('');
  try{const r=await zarnApi<{id:string}>('/api/zarn',{action:'channel_create',name,kind,topic,members:people});await z.reload();onClose();router.push(`/zarn/c/${r.id}`);}
  catch(x){setErr(x instanceof Error?x.message:'Could not create it.');setBusy(false);}
 }
 return <Modal title="Create a channel" onClose={onClose}><form onSubmit={create} className="zn-modal-body">
  <label className="zn-label">Name<span className="zn-prefix"><Hash size={15}/><input className="zn-input" autoFocus required maxLength={80} placeholder="e.g. design-reviews" value={name} onChange={e=>setName(e.target.value)}/></span>{name&&channelSlug(name)!==name&&<small>Will be created as #{channelSlug(name)}</small>}</label>
  <label className="zn-label">Topic (optional)<input className="zn-input" maxLength={250} value={topic} onChange={e=>setTopic(e.target.value)}/></label>
  <div className="zn-choice">{(['public','private'] as const).map(k=><button key={k} type="button" className={kind===k?'is-on':''} onClick={()=>setKind(k)}>{k==='public'?<Hash size={16}/>:<Lock size={16}/>}<span><b>{k==='public'?'Public':'Private'}</b><small>{k==='public'?'Anyone on ZARN can find and join':'Only people you add can see it'}</small></span></button>)}</div>
  <div className="zn-label">{kind==='private'?'Invite people (optional)':'Add people (optional)'}<AssigneePicker candidates={z.members.filter(m=>!m.deactivated_at&&m.joined_at&&m.account_type==='member'&&m.user_id!==z.me.user_id).map(m=>m.user_id)} value={people} onToggle={u=>setPeople(p=>p.includes(u)?p.filter(x=>x!==u):[...p,u])}/>{kind==='private'&&people.length>0&&<small>They get an invitation and join once they accept.</small>}</div>
  {err&&<p className="zn-error">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy||!channelSlug(name)}>{busy?'Creating…':'Create'}</button></div>
 </form></Modal>;
}

export function NewDm({onClose}:{onClose:()=>void}){
 const {openDm}=useZarn();
 return <PeoplePicker title="New message" confirm="Start conversation" instant onClose={onClose} onPick={async ids=>{await openDm(ids);onClose();}}/>;
}

export function Browse({onClose}:{onClose:()=>void}){
 const z=useZarn(),router=useRouter();
 const [q,setQ]=useState('');
 const list=z.channels.filter(c=>(c.kind==='public'||c.kind==='private')&&!c.archived_at&&(c.name??'').includes(q.toLowerCase()));
 const join=async(c:ZChannel)=>{if(!z.membership[c.id]){await z.db.from('zarn_channel_members').insert({channel_id:c.id,user_id:z.me.user_id});await z.reload();}onClose();router.push(`/zarn/c/${c.id}`);};
 return <Modal title="Browse channels" onClose={onClose}>
  <input className="zn-input" autoFocus placeholder="Search channels" value={q} onChange={e=>setQ(e.target.value)}/>
  <ul className="zn-list zn-list-scroll">{list.map(c=><li key={c.id}><button type="button" onClick={()=>void join(c)}>{c.kind==='private'?<Lock size={16}/>:<Hash size={16}/>}<span><b>{c.name}</b><small>{c.topic||'No topic'}</small></span><em>{z.membership[c.id]?'Joined':'Join'}</em></button></li>)}
   {!list.length&&<li className="zn-empty-row">No channels match.</li>}</ul>
 </Modal>;
}

export function SearchDialog({onClose}:{onClose:()=>void}){
 const {db,me,people,channels,title,openDm}=useZarn(),router=useRouter();
 const [tab,setTab]=useState<'all'|'messages'|'files'|'chats'|'people'|'docs'>('all'),[files,setFiles]=useState<{m:ZMessage;a:ZAttachment}[]>([]);
 const [q,setQ]=useState(''),[rows,setRows]=useState<ZMessage[]>([]),[busy,setBusy]=useState(false),[docs,setDocs]=useState<{id:string;title:string;snippet:string}[]>([]);
 // Past conversations with deactivated people are hidden everywhere else; searching their name finds them.
 const past=q.trim().length>=2?channels.filter(c=>c.kind==='dm'&&(c.dm_key??'').split(',').some(id=>id!==me.user_id&&people[id]?.deactivated_at&&people[id]!.display_name.toLowerCase().includes(q.trim().toLowerCase()))):[];
 useEffect(()=>{
  const s=q.trim();if(s.length<2)return;
  const t=setTimeout(async()=>{setBusy(true);const term=s.replace(/[%_,()]/g,'');const {data}=await db.from('zarn_messages').select('*').ilike('body',`%${term}%`).is('deleted_at',null).order('created_at',{ascending:false}).limit(30);setRows((data??[]) as ZMessage[]);
   // Documents you can open, matched on title or text.
   const {data:dd}=await db.from('zarn_docs').select('id,title,content').or(`title.ilike.%${term}%,content.ilike.%${term}%`).order('updated_at',{ascending:false}).limit(8);
   setDocs(((dd??[]) as {id:string;title:string;content:string}[]).map(d=>{const text=d.content.replace(/<[^>]+>/g,' ').replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g,' ').replace(/\s+/g,' ').trim(),i=text.toLowerCase().indexOf(term.toLowerCase());return {id:d.id,title:d.title||'Untitled',snippet:i<0?text.slice(0,110):(i>40?'…':'')+text.slice(Math.max(0,i-40),i+90)};}));
   // Files shared in chats, matched on file name (recent 400 messages with attachments).
   const {data:fm}=await db.from('zarn_messages').select('*').neq('attachments','[]').is('deleted_at',null).order('created_at',{ascending:false}).limit(400);
   setFiles(((fm??[]) as ZMessage[]).flatMap(m=>(m.attachments??[]).filter(x=>x.name.toLowerCase().includes(term.toLowerCase())).map(x=>({m,a:x}))).slice(0,30));
   setBusy(false);},250);
  return()=>clearTimeout(t);
 },[q,db]);
 const term=q.trim().toLowerCase(),on=term.length>=2;
 const chats=on?channels.filter(c=>!c.archived_at&&(c.kind==='dm'||c.kind==='client'||c.kind==='project'?title(c):c.name??'').toLowerCase().includes(term)).slice(0,20):[];
 const folks=on?Object.values(people).filter(p=>!p.deactivated_at&&p.user_id!==me.user_id&&`${p.display_name} ${p.username??''} ${p.title} ${p.email}`.toLowerCase().includes(term)).slice(0,20):[];
 const go=(href:string)=>{onClose();router.push(href);};
 const counts={messages:rows.length,files:files.length,chats:chats.length,people:folks.length,docs:docs.length};
 const show=(k:keyof typeof counts)=>on&&(tab==='all'||tab===k)&&counts[k]>0;
 const cap=<T,>(list:T[])=>tab==='all'?list.slice(0,4):list;
 const Head=({k,label}:{k:keyof typeof counts;label:string})=>tab==='all'?<li className="zn-srch-head"><span>{label}</span>{counts[k]>4&&<button type="button" onClick={()=>setTab(k)}>See all {counts[k]}</button>}</li>:null;
 const tabs:[typeof tab,string][]=[['all','All'],['messages','Messages'],['files','Files'],['chats','Channels & DMs'],['people','People'],['docs','Docs']];
 return <div className="zn-modal-scrim zn-srch-scrim" onClick={onClose}><div className="zn-srch" role="dialog" aria-label="Search ZARN" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')onClose();}}>
  <div className="zn-srch-bar"><SearchIcon size={18}/><input autoFocus placeholder="Search messages, files, chats, people and docs" value={q} onChange={e=>setQ(e.target.value)}/>{busy&&<small>Searching…</small>}<button type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
  <div className="zn-srch-tabs">{tabs.map(([k,l])=><button key={k} type="button" className={tab===k?'is-on':''} onClick={()=>setTab(k)}>{l}{on&&k!=='all'&&counts[k as keyof typeof counts]>0&&<em>{counts[k as keyof typeof counts]}</em>}</button>)}</div>
  <ul className="zn-list zn-srch-list" data-lenis-prevent>
   {!on&&<li className="zn-empty-row">Type at least 2 letters to search.</li>}
   {show('chats')&&<><Head k="chats" label="Channels & DMs"/>{cap(chats).map(c=><li key={c.id}><button type="button" onClick={()=>go(channelHref(c,c.id))}><span className="zd-ico">{c.kind==='private'?<Lock size={15}/>:c.kind==='dm'?<MessageSquareIcon/>:<Hash size={15}/>}</span><span><b>{c.kind==='dm'||c.kind==='client'||c.kind==='project'?title(c):`#${c.name}`}</b><small>{c.kind==='dm'?'Direct message':c.kind==='client'?'Client space':c.kind==='project'?'Project chat':c.kind==='private'?'Private channel':'Channel'}</small></span></button></li>)}</>}
   {show('people')&&<><Head k="people" label="People"/>{cap(folks).map(p=><li key={p.user_id}><button type="button" onClick={()=>{onClose();void openDm([p.user_id]);}}><Avatar m={p} size={30}/><span><b>{p.display_name}</b><small>{[p.title,p.username&&`@${p.username}`].filter(Boolean).join(' · ')||p.email}</small></span></button></li>)}</>}
   {show('files')&&<><Head k="files" label="Files"/>{cap(files).map(({m,a},i)=>{const c=channels.find(x=>x.id===m.channel_id);return <li key={m.id+i}><button type="button" onClick={()=>go(`${channelHref(c,m.channel_id)}#m-${m.id}`)}><span className="zd-ico"><FileText size={15}/></span><span><b>{a.name}</b><small>{people[m.user_id??'']?.display_name??'Someone'} · {c?(c.kind==='dm'||c.kind==='client'||c.kind==='project'?title(c):`#${c.name}`):'a chat'} · {dayOf(m.created_at)}</small></span></button></li>;})}</>}
   {show('docs')&&<><Head k="docs" label="Docs"/>{cap(docs).map(d=><li key={d.id}><button type="button" onClick={()=>go(`/zarn/docs/${d.id}`)}><span className="zd-ico"><FileText size={15}/></span><span><b>{d.title}</b><small className="zn-snippet">{d.snippet}</small></span></button></li>)}</>}
   {on&&(tab==='all'||tab==='chats')&&past.map(c=>{const o=(c.dm_key??'').split(',').find(id=>id!==me.user_id)!;return <li key={c.id}><button type="button" onClick={()=>go(channelHref(c,c.id))}><Avatar m={people[o]} size={30}/><span><b>{people[o]?.display_name}</b><small>Deactivated · open past conversation</small></span></button></li>;})}
   {show('messages')&&<><Head k="messages" label="Messages"/>{cap(rows).map(m=>{const c=channels.find(x=>x.id===m.channel_id);return <li key={m.id}><button type="button" onClick={()=>go(`${channelHref(c,m.channel_id)}${m.parent_id?'':`#m-${m.id}`}`)}>
    <Avatar m={people[m.user_id??'']} size={30}/><span><b>{people[m.user_id??'']?.display_name??'CRM'} <small>in {c?(c.kind==='dm'||c.kind==='client'||c.kind==='project'?title(c):`#${c.name}`):'a channel'} · {dayOf(m.created_at)} {timeOf(m.created_at)}</small></b><small className="zn-snippet">{plain(m.body,people).slice(0,160)}</small></span></button></li>;})}</>}
   {on&&!busy&&(tab==='all'?Object.values(counts).every(n=>!n)&&!past.length:!counts[tab as keyof typeof counts])&&<li className="zn-empty-row">Nothing found for “{q.trim()}”.</li>}
  </ul>
 </div></div>;
}

// Crop to a centred square and shrink to 512px WebP before upload.
export async function squareCrop(file:File):Promise<File>{
 const bmp=await createImageBitmap(file),side=Math.min(bmp.width,bmp.height),size=Math.min(512,side);
 const c=document.createElement('canvas');c.width=c.height=size;
 c.getContext('2d')!.drawImage(bmp,(bmp.width-side)/2,(bmp.height-side)/2,side,side,0,0,size,size);bmp.close();
 const blob=await new Promise<Blob|null>(r=>c.toBlob(r,'image/webp',.88));
 if(!blob)throw new Error('Could not read that image.');
 return new File([blob],'avatar.webp',{type:blob.type||'image/webp'});
}
type ProfileTab='profile'|'status'|'contact'|'emergency';
// Edit your profile: a centred window with sections on the left and one Save for everything.
export function Profile({onClose,initialTab='profile'}:{onClose:()=>void;initialTab?:ProfileTab}){
 const z=useZarn(),me=z.people[z.me.user_id]??z.me;
 const [tab,setTab]=useState<ProfileTab>(initialTab),[bio,setBio]=useState(me.bio??'');
 const [x,setX]=useState({phone2:me.phone2??'',phone3:me.phone3??'',whatsapp:me.whatsapp??''}),[more,setMore]=useState(me.phone3?2:me.phone2?1:0);
 const [v,setV]=useState({display_name:me.display_name,username:me.username??'',title:me.title,work_email:me.work_email||me.email,phone:me.phone});
 const live=liveStatus(me);
 const [st,setSt]=useState({emoji:live?.emoji??'',text:live?.text??'',clear:'',date:''});
 const [photo,setPhoto]=useState(me.avatar_url),[uploading,setUploading]=useState(false);
 const [em,setEm]=useState({name:'',relation:'',phone:''}),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 useEffect(()=>{void z.db.from('zarn_emergency').select('name,relation,phone').eq('user_id',me.user_id).maybeSingle().then(({data}:{data:{name:string;relation:string;phone:string}|null})=>{if(data)setEm(data);});},[z.db,me.user_id]);
 const set=(k:keyof typeof v)=>(e:React.ChangeEvent<HTMLInputElement>)=>setV(s=>({...s,[k]:k==='username'?e.target.value.toLowerCase().replace(/[^a-z0-9._]/g,''):e.target.value}));
 async function upload(f?:File){
  if(!f)return;setUploading(true);setErr('');
  try{const form=new FormData();form.set('file',await squareCrop(f));const r=await fetch('/api/zarn/avatar',{method:'POST',body:form});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Upload failed.');setPhoto(d.url);}
  catch(x){setErr(x instanceof Error?x.message:'Upload failed.');}finally{setUploading(false);}
 }
 async function removePhoto(){setUploading(true);await fetch('/api/zarn/avatar',{method:'DELETE'});setPhoto(null);setUploading(false);}
 async function save(e:React.FormEvent){
  e.preventDefault();setErr('');
  if(!v.display_name.trim())return setErr('Enter your name.');
  if(!usernameOk(v.username))return setErr('Usernames are 2 to 30 characters: letters, numbers, dots or underscores, starting with a letter or number.');
  if(v.work_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.work_email))return setErr('Check the work email.');
  if(st.clear==='pick'&&!st.date)return setErr('Pick the date your status should clear.');
  setBusy(true);
  const hasStatus=!!(st.emoji||st.text.trim());
  const {error}=await z.db.from('zarn_members').update({display_name:v.display_name.trim(),username:v.username,title:v.title.trim(),work_email:v.work_email.trim(),phone:v.phone.trim(),
   status_emoji:hasStatus?st.emoji:'',status_text:hasStatus?st.text.trim():'',status_until:hasStatus?(st.clear?clearAt(st.clear,st.date):(live?.until??null)):null}).eq('user_id',me.user_id);
  if(error){setBusy(false);return setErr(error.code==='23505'?`@${v.username} is taken. Try another.`:'Could not save.');}
  const {error:e2}=await z.db.from('zarn_emergency').upsert({user_id:me.user_id,name:em.name.trim(),relation:em.relation.trim(),phone:em.phone.trim(),updated_at:new Date().toISOString()});
  // About me is saved on its own so the rest still saves while the bio column rolls out.
  const extra={bio:bio.trim(),phone2:x.phone2.trim(),phone3:x.phone3.trim(),whatsapp:x.whatsapp.trim()};
  if(Object.entries(extra).some(([k,val])=>val!==((me as Record<string,unknown>)[k]??''))){const {error:e3}=await z.db.from('zarn_members').update(extra).eq('user_id',me.user_id);
   if(e3){setBusy(false);await z.reload();return setErr('Saved, except About me, extra phone numbers and WhatsApp. Those need a quick update on our side first.');}}
  setBusy(false);if(e2)return setErr('Saved your profile, but not the emergency contact. Try again.');
  await z.reload();onClose();window.dispatchEvent(new CustomEvent('zarn-toast',{detail:'Profile saved'}));
 }
 const pick=(p:typeof statusPresets[number])=>setSt({emoji:p.emoji,text:p.text,clear:p.clear===null?'':String(p.clear),date:''});
 const tabs:[ProfileTab,string,React.ReactNode][]=[['profile','Profile',<UserRound key="p" size={16}/>],['status','Status',<Smile key="s" size={16}/>],['contact','Contact',<Phone key="c" size={16}/>],['emergency','Emergency contact',<HeartPulse key="e" size={16}/>]];
 return <div className="zn-modal-scrim zn-pe-scrim" onClick={onClose}><form className="zn-pe" role="dialog" aria-label="Edit your profile" onClick={e=>e.stopPropagation()} onSubmit={save}>
  <header className="zn-pe-head"><div><h2>Edit your profile</h2><p>How you appear to the team across ZARN.</p></div><button type="button" aria-label="Close" onClick={onClose}><X size={20}/></button></header>
  <div className="zn-pe-body">
   <nav className="zn-pe-nav">{tabs.map(([k,l,i])=><button key={k} type="button" className={tab===k?'is-on':''} onClick={()=>setTab(k)}>{i}{l}</button>)}</nav>
   <div className="zn-pe-pane" data-lenis-prevent>
    {tab==='profile'&&<div className="zn-pe-split">
     <div className="zn-pe-fields">
      <label className="zn-label">Full name<input className="zn-input" maxLength={80} value={v.display_name} onChange={set('display_name')}/></label>
      <label className="zn-label">Username<span className="zn-prefix zn-at"><AtSignIcon/><input className="zn-input" maxLength={30} value={v.username} onChange={set('username')}/></span><small className="zn-hint">How people @mention you.</small></label>
      <label className="zn-label">Title<input className="zn-input" maxLength={80} placeholder="e.g. Product designer" value={v.title} onChange={set('title')}/><small className="zn-hint">Let people know what you do at Zaane.</small></label>
      <label className="zn-label">About me<textarea className="zn-input zn-bio-in" rows={3} maxLength={600} placeholder="A few lines about you: what you work on, what you’re good at." value={bio} onChange={e=>setBio(e.target.value)}/><small className="zn-hint">{bio.length} / 600</small></label>
     </div>
     <div className="zn-pe-photo"><span className="zn-label">Profile photo</span>
      <div className="zn-pe-photo-box">{photo?<img src={photo} alt=""/>:<Avatar m={{...me,avatar_url:null}} size={180}/>}</div>
      <label className="zn-btn">{uploading?'Uploading…':photo?'Change photo':'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden disabled={uploading} onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label>
      {photo&&<button type="button" className="zn-link-btn" disabled={uploading} onClick={()=>void removePhoto()}>Remove photo</button>}
      <small className="zn-hint">Square photos look best. We crop it for you.</small>
     </div>
    </div>}
    {tab==='status'&&<div className="zn-pe-fields">
     <p className="zn-pe-intro">Let people know what you’re up to.</p>
     <div className="zn-status-custom">
      <input className="zn-input zn-emoji-in" aria-label="Status emoji" maxLength={4} placeholder="🙂" value={st.emoji} onChange={e=>setSt({...st,emoji:e.target.value})}/>
      <input className="zn-input" aria-label="Status text" maxLength={100} placeholder="What’s your status?" value={st.text} onChange={e=>setSt({...st,text:e.target.value})}/>
      {(st.emoji||st.text)&&<button type="button" className="zn-btn" onClick={()=>setSt({emoji:'',text:'',clear:'',date:''})}>Clear</button>}
     </div>
     <div className="zn-status-presets">{statusPresets.map(p=><button key={p.text} type="button" className={st.text===p.text?'is-on':''} onClick={()=>pick(p)}><span>{p.emoji}</span>{p.text}</button>)}</div>
     {(st.emoji||st.text)&&<div className="zn-status-clear"><span>Clear after</span><Dropdown variant="inline" label="Clear after" value={st.clear} onChange={x=>setSt({...st,clear:x})} options={clearOptions.map(([k,l])=>({value:k,label:l}))}/>
      {st.clear==='pick'&&<input className="zn-input" type="date" min={new Date().toISOString().slice(0,10)} value={st.date} onChange={e=>setSt({...st,date:e.target.value})} aria-label="Clear on"/>}</div>}
    </div>}
    {tab==='contact'&&<div className="zn-pe-fields">
     <p className="zn-pe-intro">Shown on your profile so the team can reach you.</p>
     <label className="zn-label">Email address<input className="zn-input" type="email" maxLength={254} value={v.work_email} onChange={set('work_email')}/><small className="zn-hint">You sign in with {me.email}.</small></label>
     <label className="zn-label">Phone<input className="zn-input" type="tel" maxLength={40} placeholder="+234 …" value={v.phone} onChange={set('phone')}/></label>
     {more>=1&&<label className="zn-label">Phone 2<input className="zn-input" type="tel" maxLength={40} placeholder="+234 …" value={x.phone2} onChange={e=>setX({...x,phone2:e.target.value})}/></label>}
     {more>=2&&<label className="zn-label">Phone 3<input className="zn-input" type="tel" maxLength={40} placeholder="+234 …" value={x.phone3} onChange={e=>setX({...x,phone3:e.target.value})}/></label>}
     {more<2&&<button type="button" className="zn-link-btn zn-pe-add" onClick={()=>setMore(m=>m+1)}>+ Add another number</button>}
     <label className="zn-label">WhatsApp<input className="zn-input" type="tel" maxLength={40} placeholder="+234 …" value={x.whatsapp} onChange={e=>setX({...x,whatsapp:e.target.value})}/><small className="zn-hint">Adds a WhatsApp button to your profile so people can text you in one tap.</small></label>
    </div>}
    {tab==='emergency'&&<div className="zn-pe-fields">
     <p className="zn-pe-intro">Someone we can call in an emergency. Visible to the team, never to guests.</p>
     <label className="zn-label">Name<input className="zn-input" maxLength={80} placeholder="Full name" value={em.name} onChange={e=>setEm({...em,name:e.target.value})}/></label>
     <div className="zn-grid-2">
      <label className="zn-label">Relationship<input className="zn-input" maxLength={40} placeholder="e.g. Sister" value={em.relation} onChange={e=>setEm({...em,relation:e.target.value})}/></label>
      <label className="zn-label">Phone<input className="zn-input" type="tel" maxLength={40} placeholder="+234 …" value={em.phone} onChange={e=>setEm({...em,phone:e.target.value})}/></label>
     </div>
    </div>}
   </div>
  </div>
  <footer className="zn-pe-foot">{err?<p className="zn-error" role="alert">{err}</p>:<span/>}<div><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button className="zn-btn is-primary" disabled={busy||uploading}>{busy?'Saving…':'Save changes'}</button></div></footer>
 </form></div>;
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
