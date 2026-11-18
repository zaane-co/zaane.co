'use client';
import {useEffect,useMemo,useState} from 'react';
import {Check,Globe2,Link2,Lock,Users} from 'lucide-react';
import Dropdown from '@/components/ui/Dropdown';
import {useZarn} from './ZarnProvider';
import {useConfirm} from './ConfirmProvider';
import {Modal} from './Dialogs';
import {Avatar} from './format';
import AssigneePicker from './AssigneePicker';
type Person={user_id:string;role:'view'|'edit'};
type Link={id:string;url:string;protected:boolean;expires_at:string|null;views:number};
type Access='restricted'|'team'|'anyone';
const api=async(body:object)=>{const r=await fetch('/api/zarn/docs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;};
const day=(iso:string)=>new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
// Share a document the way Google Docs does: add people, pick general access (restricted, the whole team, or anyone with the link),
// and copy the document's one link. "Anyone with the link" is read only for people outside ZARN, with an optional expiry and password.
export default function ShareDoc({docId,onClose}:{docId:string;onClose:()=>void}){
 const {db,me,members,channels,title,people}=useZarn(),confirm=useConfirm();
 const [loaded,setLoaded]=useState(false),[docTitle,setDocTitle]=useState(''),[kind,setKind]=useState<'doc'|'sheet'>('doc');
 const [access,setAccess]=useState<Access>('restricted'),[teamRole,setTeamRole]=useState<'view'|'edit'>('view'),[lead,setLead]=useState(''),[shared,setShared]=useState<Person[]>([]);
 const [link,setLink]=useState<Link|null>(null),[expiry,setExpiry]=useState('keep'),[password,setPassword]=useState(''),[clearPw,setClearPw]=useState(false);
 const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[copied,setCopied]=useState(false);
 const clients=channels.filter(c=>c.kind==='client'&&c.lead_id&&!c.archived_at);
 const candidates=useMemo(()=>members.filter(m=>!m.deactivated_at&&m.joined_at&&m.account_type==='member'&&m.user_id!==me.user_id).map(m=>m.user_id),[members,me.user_id]);
 useEffect(()=>{
  let live=true;
  void (async()=>{
   const [{data:d},{data:m},links]=await Promise.all([
    db.from('zarn_docs').select('title,kind,visibility,team_role,lead_id').eq('id',docId).single(),
    db.from('zarn_doc_members').select('user_id,role').eq('doc_id',docId),
    api({action:'links',id:docId}).catch(()=>({links:[]})),
   ]);
   if(!live||!d)return;
   const x=d as {title:string;kind:string;visibility:'private'|'team';team_role:'view'|'edit';lead_id:string|null};
   const l=((links.links??[]) as Link[]).find(k=>!k.expires_at||new Date(k.expires_at)>new Date())??null;
   setDocTitle(x.title||'Untitled');setKind(x.kind==='sheet'?'sheet':'doc');
   setAccess(l?'anyone':x.visibility==='team'?'team':'restricted');setTeamRole(x.team_role);setLead(x.lead_id??'');setShared((m??[]) as Person[]);setLink(l);setLoaded(true);
  })();
  return()=>{live=false;};
 },[db,docId]);
 const touch=()=>{setDirty(true);setMsg('');};
 // Saves everything in one go. Returns the link that is live afterwards (or null).
 async function save():Promise<Link|null|false>{
  setBusy(true);setMsg('');
  try{
   const d=await api({action:'share',id:docId,visibility:access==='restricted'?'private':'team',team_role:teamRole,lead_id:lead||null,members:shared});
   const want=access==='anyone';let l=link;
   if(want||link){
    const r=await api({action:'link_set',id:docId,on:want,...(expiry!=='keep'?{days:Number(expiry)}:{}),...(password?{password}:{}),...(clearPw?{clear_password:true}:{})});
    l=r.link as Link|null;setLink(l);
   }
   setExpiry('keep');setPassword('');setClearPw(false);setDirty(false);
   if(d.added)setMsg(`${d.added===1?'They’ve':'Everyone you added has'} been notified. It’s in their Drive under Shared with me.`);
   setBusy(false);return l;
  }catch(e){setMsg(e instanceof Error?e.message:'Could not save.');setBusy(false);return false;}
 }
 async function copy(){
  let l=link;
  if(dirty){const r=await save();if(r===false)return;l=r;}
  const url=access==='anyone'&&l?l.url:`${location.origin}/zarn/${kind==='sheet'?'sheets':'docs'}/${docId}`;
  try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setMsg(url);}
 }
 async function done(){if(dirty&&await save()===false)return;onClose();}
 async function close(){if(dirty&&!await confirm({title:'Discard sharing changes?',message:'Nothing you changed here is saved yet.',confirm:'Discard'}))return;onClose();}
 const toggle=(uid:string)=>{touch();setShared(s=>s.some(p=>p.user_id===uid)?s.filter(p=>p.user_id!==uid):[...s,{user_id:uid,role:'view'}]);};
 const what=kind==='sheet'?'sheet':'document';
 const accessHint=access==='restricted'?'Only people added above can open it.':access==='team'?'Everyone on the team can find and open it.':'Anyone on the internet with the link can view it. The team can open it in ZARN.';
 const expiryLabel=link?.expires_at?`Expires ${day(link.expires_at)}`:'Never expires';
 return <Modal title={loaded?`Share “${docTitle}”`:'Share'} onClose={()=>void close()} wide>
  <div className="zn-modal-body zd-share">
   <section>
    <AssigneePicker candidates={candidates} value={shared.map(p=>p.user_id)} onToggle={toggle}/>
    <h3>People with access</h3>
    <ul className="zd-people">
     <li><Avatar m={people[me.user_id]} size={30}/><span>{people[me.user_id]?.display_name??'You'} (you)</span><small className="zd-owner">Owner</small></li>
     {shared.map(p=><li key={p.user_id}><Avatar m={people[p.user_id]} size={30}/><span>{people[p.user_id]?.display_name??'Member'}</span><Dropdown variant="inline" label="Access" value={p.role} onChange={v=>{if(v==='remove'){toggle(p.user_id);return;}touch();setShared(s=>s.map(x=>x.user_id===p.user_id?{...x,role:v as 'view'|'edit'}:x));}} options={[{value:'view',label:'Viewer'},{value:'edit',label:'Editor'},{value:'remove',label:'Remove access'}]}/></li>)}
    </ul>
   </section>
   <section>
    <h3>General access</h3>
    <div className="zd-access">
     <span className={`zd-access-ic is-${access}`}>{access==='restricted'?<Lock size={17}/>:access==='team'?<Users size={17}/>:<Globe2 size={17}/>}</span>
     <div className="zd-access-main">
      <Dropdown variant="inline" label="General access" value={access} onChange={v=>{touch();setAccess(v as Access);}} options={[{value:'restricted',label:'Restricted'},{value:'team',label:'Everyone on the team'},{value:'anyone',label:'Anyone with the link'}]}/>
      <small>{accessHint}</small>
     </div>
     {access!=='restricted'&&<Dropdown variant="inline" label="Team access" value={teamRole} onChange={v=>{touch();setTeamRole(v as 'view'|'edit');}} options={[{value:'view',label:'Team: Viewer'},{value:'edit',label:'Team: Editor'}]}/>}
    </div>
    {access==='anyone'&&<div className="zd-linkopts">
     <div className="zn-label">Link expires<Dropdown label="Expiry" value={expiry} onChange={v=>{touch();setExpiry(v);}} options={[{value:'keep',label:link?expiryLabel:'Never expires'},{value:'1',label:'In 1 day'},{value:'7',label:'In 7 days'},{value:'30',label:'In 30 days'},...(link?.expires_at?[{value:'0',label:'Never'}]:[])]}/></div>
     <label className="zn-label">{link?.protected&&!clearPw?'Password (set)':'Password (optional)'}
      <input className="zn-input" type="text" autoComplete="off" value={password} maxLength={100} onChange={e=>{touch();setPassword(e.target.value);}} placeholder={link?.protected&&!clearPw?'Type to change it':'At least 4 characters'}/>
     </label>
     {link?.protected&&!clearPw&&<button type="button" className="zn-link-btn" onClick={()=>{touch();setClearPw(true);}}>Remove password</button>}
     {link&&<small className="zd-linkmeta">{link.views} view{link.views===1?'':'s'} so far</small>}
    </div>}
    {clients.length>0&&<div className="zn-label">Also give a client’s team access<Dropdown label="Client" value={lead} onChange={v=>{touch();setLead(v);}} placeholder="No client" options={[{value:'',label:'No client'},...clients.map(c=>({value:c.lead_id!,label:title(c)}))]}/></div>}
   </section>
   {msg&&<p className="zn-note" role="status">{msg}</p>}
   <footer className="zd-share-foot">
    <button type="button" className="zn-btn" disabled={busy||!loaded||(!!password&&password.length<4)} onClick={()=>void copy()}>{copied?<Check size={15}/>:<Link2 size={15}/>}{copied?'Link copied':'Copy link'}</button>
    <button type="button" className="zn-btn is-primary" disabled={busy||!loaded||(!!password&&password.length<4)} onClick={()=>void done()}>{dirty?(shared.length?'Save and notify':'Save'):'Done'}</button>
   </footer>
   {access==='restricted'&&<p className="zd-share-tip">The copied link only opens for people with access. Pick Anyone with the link to share outside ZARN.</p>}
   {access!=='restricted'&&!dirty&&loaded&&<p className="zd-share-tip">Sharing this {what} with the team or by link doesn’t notify anyone. Add people above to notify them.</p>}
  </div>
 </Modal>;
}
