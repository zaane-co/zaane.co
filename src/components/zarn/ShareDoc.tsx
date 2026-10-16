'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Copy,Link2,Lock,Trash2} from 'lucide-react';
import Dropdown from '@/components/ui/Dropdown';
import {useZarn} from './ZarnProvider';
import {useConfirm} from './ConfirmProvider';
import {Modal} from './Dialogs';
import {Avatar} from './format';
import AssigneePicker from './AssigneePicker';
type Person={user_id:string;role:'view'|'edit'};
type Link={id:string;url:string;protected:boolean;expires_at:string|null;views:number};
const api=async(body:object)=>{const r=await fetch('/api/zarn/docs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;};
// Share a document: with the team, a client's team, specific people, or anyone holding a (password-protected) link.
export default function ShareDoc({docId,onClose}:{docId:string;onClose:()=>void}){
 const {db,me,members,channels,title,people}=useZarn(),confirm=useConfirm();
 const [visibility,setVisibility]=useState<'private'|'team'>('private'),[teamRole,setTeamRole]=useState<'view'|'edit'>('view'),[lead,setLead]=useState(''),[shared,setShared]=useState<Person[]>([]);
 const [links,setLinks]=useState<Link[]>([]),[password,setPassword]=useState(''),[days,setDays]=useState('0'),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[copied,setCopied]=useState('');
 const clients=channels.filter(c=>c.kind==='client'&&c.lead_id&&!c.archived_at);
 const candidates=useMemo(()=>members.filter(m=>!m.deactivated_at&&m.joined_at&&m.account_type==='member'&&m.user_id!==me.user_id).map(m=>m.user_id),[members,me.user_id]);
 const loadLinks=useCallback(async()=>{try{const d=await api({action:'links',id:docId});setLinks(d.links??[]);}catch{}},[docId]);
 useEffect(()=>{
  let live=true;
  void (async()=>{
   const [{data:d},{data:m}]=await Promise.all([db.from('zarn_docs').select('visibility,team_role,lead_id').eq('id',docId).single(),db.from('zarn_doc_members').select('user_id,role').eq('doc_id',docId)]);
   if(!live||!d)return;
   const x=d as {visibility:'private'|'team';team_role:'view'|'edit';lead_id:string|null};
   setVisibility(x.visibility);setTeamRole(x.team_role);setLead(x.lead_id??'');setShared((m??[]) as Person[]);
  })();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves, not synchronously
  void loadLinks();
  return()=>{live=false;};
 },[db,docId,loadLinks]);
 async function saveAccess(){
  setBusy(true);setMsg('');
  try{await api({action:'share',id:docId,visibility,team_role:teamRole,lead_id:lead||null,members:shared});setMsg('Sharing saved.');}
  catch(e){setMsg(e instanceof Error?e.message:'Could not save.');}
  setBusy(false);
 }
 async function createLink(){
  setBusy(true);setMsg('');
  try{await api({action:'link_create',id:docId,password:password||undefined,days:days==='0'?null:Number(days)});setPassword('');await loadLinks();setMsg('Link created. Copy it below.');}
  catch(e){setMsg(e instanceof Error?e.message:'Could not create the link.');}
  setBusy(false);
 }
 async function revoke(l:Link){
  if(!await confirm({title:'Turn off this link?',message:'Anyone using it will lose access straight away.',confirm:'Turn off link',danger:true}))return;
  await api({action:'link_revoke',link_id:l.id});await loadLinks();
 }
 const toggle=(uid:string)=>setShared(s=>s.some(p=>p.user_id===uid)?s.filter(p=>p.user_id!==uid):[...s,{user_id:uid,role:'view'}]);
 return <Modal title="Share document" onClose={onClose} wide>
  <div className="zn-modal-body zd-share">
   <section>
    <h3>Who can open it</h3>
    <div className="zn-form-row">
     <div className="zn-label">Team<Dropdown label="Team access" value={visibility} onChange={v=>setVisibility(v as 'private'|'team')} options={[{value:'private',label:'Only me and people below'},{value:'team',label:'Everyone on the team'}]}/></div>
     <div className="zn-label">Team and client can<Dropdown label="Access level" value={teamRole} onChange={v=>setTeamRole(v as 'view'|'edit')} options={[{value:'view',label:'View'},{value:'edit',label:'Edit'}]}/></div>
    </div>
    {clients.length>0&&<div className="zn-label">Also share with a client’s team<Dropdown label="Client" value={lead} onChange={setLead} placeholder="No client" options={[{value:'',label:'No client'},...clients.map(c=>({value:c.lead_id!,label:title(c)}))]}/></div>}
    <div className="zn-label">People<AssigneePicker candidates={candidates} value={shared.map(p=>p.user_id)} onToggle={toggle}/></div>
    {shared.length>0&&<ul className="zd-people">{shared.map(p=><li key={p.user_id}><Avatar m={people[p.user_id]} size={26}/><span>{people[p.user_id]?.display_name??'Member'}</span><Dropdown variant="inline" label="Access" value={p.role} onChange={v=>setShared(s=>s.map(x=>x.user_id===p.user_id?{...x,role:v as 'view'|'edit'}:x))} options={[{value:'view',label:'Can view'},{value:'edit',label:'Can edit'}]}/></li>)}</ul>}
    <button type="button" className="zn-btn is-primary" disabled={busy} onClick={()=>void saveAccess()}>Save sharing</button>
   </section>
   <section>
    <h3><Link2 size={14}/>Share with anyone by link</h3>
    <p className="zn-note">People with the link can read this document. They can’t edit it or see anything else in ZARN.</p>
    <div className="zn-form-row">
     <label className="zn-label">Password (optional)<input className="zn-input" type="text" autoComplete="off" value={password} maxLength={100} onChange={e=>setPassword(e.target.value)} placeholder="At least 4 characters"/></label>
     <div className="zn-label">Link expires<Dropdown label="Expiry" value={days} onChange={setDays} options={[{value:'0',label:'Never'},{value:'1',label:'In 1 day'},{value:'7',label:'In 7 days'},{value:'30',label:'In 30 days'}]}/></div>
    </div>
    <button type="button" className="zn-btn" disabled={busy||(!!password&&password.length<4)} onClick={()=>void createLink()}><Link2 size={14}/>Create link</button>
    {links.length>0&&<ul className="zd-links">{links.map(l=><li key={l.id}>
     <span className="zd-link-url" title={l.url}>{l.url}</span>
     <small>{l.protected&&<><Lock size={11}/>Password · </>}{l.expires_at?`Expires ${new Date(l.expires_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`:'No expiry'} · {l.views} view{l.views===1?'':'s'}</small>
     <button type="button" className="zn-btn" onClick={()=>{void navigator.clipboard.writeText(l.url);setCopied(l.id);setTimeout(()=>setCopied(''),1500);}}><Copy size={13}/>{copied===l.id?'Copied':'Copy'}</button>
     <button type="button" className="zn-remove" aria-label="Turn off link" onClick={()=>void revoke(l)}><Trash2 size={13}/></button>
    </li>)}</ul>}
   </section>
   {msg&&<p className="zn-note" role="status">{msg}</p>}
  </div>
 </Modal>;
}
