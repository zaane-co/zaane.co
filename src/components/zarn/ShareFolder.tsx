'use client';
import {useEffect,useMemo,useState} from 'react';
import {Check,Link2,Lock,Users} from 'lucide-react';
import Dropdown from '@/components/ui/Dropdown';
import {useZarn} from './ZarnProvider';
import {useConfirm} from './ConfirmProvider';
import {Modal} from './Dialogs';
import {Avatar} from './format';
import AssigneePicker from './AssigneePicker';
type Role='view'|'edit'|'manage';
type Folder={id:string;name:string;drive:'my'|'team'|'client';lead_id:string|null;owner_id:string;parent_id:string|null;access?:'team'|'restricted';team_role?:'view'|'edit'};
type Grant={folder_id:string;user_id:string;role:Role};
const ROLE:Record<Role,string>={view:'Viewer',edit:'Editor',manage:'Manager'};
const SHARE_BASE=(process.env.NEXT_PUBLIC_SHARE_URL||'https://zaane.co').replace(/\/$/,'');
// Share a folder the way Google Drive does: add people as Viewer, Editor or Manager, see who has access from folders above,
// and (in the team or a client drive) choose whether everyone there can open it or only the people added.
export default function ShareFolder({folderId,onClose}:{folderId:string;onClose:()=>void}){
 const {db,me,members,people,channels,title}=useZarn(),confirm=useConfirm();
 const [chain,setChain]=useState<Folder[]|null>(null),[inherited,setInherited]=useState<Grant[]>([]),[mine,setMine]=useState<Grant[]>([]),[orig,setOrig]=useState<Grant[]>([]);
 const [access,setAccess]=useState<'team'|'restricted'>('team'),[teamRole,setTeamRole]=useState<'view'|'edit'>('edit');
 const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[copied,setCopied]=useState(false);
 useEffect(()=>{
  let live=true;
  void (async()=>{
   const list:Folder[]=[];let id:string|null=folderId;
   for(let i=0;id&&i<50;i++){const {data}:{data:unknown}=await db.from('zarn_drive_folders').select('*').eq('id',id).maybeSingle();if(!data)break;const f=data as Folder;list.push(f);id=f.parent_id;}
   if(!live||!list.length){if(live)setChain([]);return;}
   const {data:g}=await db.from('zarn_drive_folder_members').select('folder_id,user_id,role').in('folder_id',list.map(f=>f.id));
   const grants=(g??[]) as Grant[];
   setChain(list);setMine(grants.filter(x=>x.folder_id===folderId));setOrig(grants.filter(x=>x.folder_id===folderId));setInherited(grants.filter(x=>x.folder_id!==folderId));
   setAccess(list[0].access??'team');setTeamRole(list[0].team_role??'edit');
  })();
  return()=>{live=false;};
 },[db,folderId]);
 const f=chain?.[0];
 const lockedAbove=chain?.slice(1).find(x=>x.access==='restricted');
 const canManage=!!chain&&(chain.some(x=>x.owner_id===me.user_id)||(f?.drive!=='my'&&me.zarnAdmin)||[...mine,...inherited].some(g=>g.user_id===me.user_id&&g.role==='manage'));
 const has=new Set([...mine.map(g=>g.user_id),f?.owner_id??'']);
 const candidates=useMemo(()=>members.filter(m=>!m.deactivated_at&&m.joined_at&&m.account_type==='member'&&m.user_id!==f?.owner_id).map(m=>m.user_id),[members,f?.owner_id]);
 const fromAbove=inherited.filter(g=>!has.has(g.user_id)).reduce<Grant[]>((a,g)=>{const i=a.findIndex(x=>x.user_id===g.user_id);if(i<0)a.push(g);return a;},[]);
 const client=f?.drive==='client'?channels.find(c=>c.kind==='client'&&c.lead_id===f.lead_id):undefined;
 const everyone=f?.drive==='client'?`Everyone in ${client?title(client):'this client space'}`:'Everyone on the team';
 const folderName=(id:string)=>chain?.find(x=>x.id===id)?.name??'a folder above';
 const touch=()=>{setDirty(true);setMsg('');};
 const toggle=(uid:string)=>{touch();setMine(s=>s.some(g=>g.user_id===uid)?s.filter(g=>g.user_id!==uid):[...s,{folder_id:folderId,user_id:uid,role:'view'}]);};
 async function save():Promise<boolean>{
  if(!f)return false;setBusy(true);setMsg('');
  try{
   const gone=orig.filter(o=>!mine.some(m=>m.user_id===o.user_id)).map(o=>o.user_id);
   const added=mine.filter(m=>!orig.some(o=>o.user_id===m.user_id));
   const changed=mine.filter(m=>orig.some(o=>o.user_id===m.user_id&&o.role!==m.role));
   if(gone.length){const {error}=await db.from('zarn_drive_folder_members').delete().eq('folder_id',folderId).in('user_id',gone);if(error)throw error;}
   if(added.length){const {error}=await db.from('zarn_drive_folder_members').insert(added.map(g=>({folder_id:folderId,user_id:g.user_id,role:g.role})));if(error)throw error;}
   for(const g of changed){const {error}=await db.from('zarn_drive_folder_members').update({role:g.role}).eq('folder_id',folderId).eq('user_id',g.user_id);if(error)throw error;}
   if(f.drive!=='my'&&(access!==(f.access??'team')||teamRole!==(f.team_role??'edit'))){
    const {error}=await db.from('zarn_drive_folders').update({access,team_role:teamRole}).eq('id',folderId);if(error)throw error;
    setChain(c=>c?[{...c[0],access,team_role:teamRole},...c.slice(1)]:c);
   }
   if(added.length)void fetch('/api/zarn/docs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'folder_notify',folder_id:folderId,users:added.map(g=>g.user_id)})}).catch(()=>{});
   setOrig(mine);setDirty(false);setBusy(false);
   if(added.length)setMsg(`${added.length===1?'They’ve':'Everyone you added has'} been notified.`);
   return true;
  }catch(e){
   const m=(e as {message?:string}).message??'';
   setMsg(/access|column|check constraint/i.test(m)?'Drive sharing needs a quick update before this works. Ask your ZARN admin.':'Could not save sharing.');setBusy(false);return false;
  }
 }
 const link=f?`${SHARE_BASE}/zarn/drive?${f.drive==='team'?'v=team':f.drive==='client'?`v=client&l=${f.lead_id}`:'v=my'}&f=${f.id}`:'';
 async function copy(){if(dirty&&!await save())return;try{await navigator.clipboard.writeText(link);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setMsg(link);}}
 async function done(){if(dirty&&!await save())return;onClose();}
 async function close(){if(dirty&&!await confirm({title:'Discard sharing changes?',message:'Nothing you changed here is saved yet.',confirm:'Discard'}))return;onClose();}
 const restricted=f?.drive==='my'||access==='restricted'||!!lockedAbove;
 return <Modal title={f?`Share “${f.name}”`:'Share folder'} onClose={()=>void close()} wide>
  <div className="zn-modal-body zd-share">
   {chain===null?<p className="zn-loading">Loading…</p>:!f?<p className="zn-error">This folder is not available.</p>:<>
   <section>
    {canManage?<AssigneePicker candidates={candidates} value={mine.map(g=>g.user_id)} onToggle={toggle}/>:<p className="zn-note">Only managers of this folder can change who has access.</p>}
    <h3>People with access</h3>
    <ul className="zd-people">
     <li><Avatar m={people[f.owner_id]} size={30}/><span>{people[f.owner_id]?.display_name??'Someone'}{f.owner_id===me.user_id?' (you)':''}</span><small className="zd-owner">Owner</small></li>
     {mine.filter(g=>g.user_id!==f.owner_id).map(g=><li key={g.user_id}><Avatar m={people[g.user_id]} size={30}/><span>{people[g.user_id]?.display_name??'Member'}{g.user_id===me.user_id?' (you)':''}</span>
      {canManage?<Dropdown variant="inline" label="Access" value={g.role} onChange={v=>{if(v==='remove'){toggle(g.user_id);return;}touch();setMine(s=>s.map(x=>x.user_id===g.user_id?{...x,role:v as Role}:x));}} options={[{value:'view',label:'Viewer',hint:'Can open and download'},{value:'edit',label:'Editor',hint:'Can add, rename and move things'},{value:'manage',label:'Manager',hint:'Can also share and delete'},{value:'remove',label:'Remove access'}]}/>:<small className="zd-owner">{ROLE[g.role]}</small>}
     </li>)}
     {fromAbove.map(g=><li key={`up-${g.user_id}`} className="is-inherited"><Avatar m={people[g.user_id]} size={30}/><span>{people[g.user_id]?.display_name??'Member'}<em>From “{folderName(g.folder_id)}”</em></span><small className="zd-owner">{ROLE[g.role]}</small></li>)}
    </ul>
   </section>
   <section>
    <h3>General access</h3>
    <div className="zd-access">
     <span className={`zd-access-ic is-${restricted?'restricted':'team'}`}>{restricted?<Lock size={17}/>:<Users size={17}/>}</span>
     <div className="zd-access-main">
      {f.drive==='my'?<b className="zd-access-static">Restricted</b>:lockedAbove?<b className="zd-access-static">Restricted</b>:
       <Dropdown variant="inline" label="General access" disabled={!canManage} value={access} onChange={v=>{touch();setAccess(v as 'team'|'restricted');}} options={[{value:'team',label:everyone},{value:'restricted',label:'Restricted'}]}/>}
      <small>{f.drive==='my'?'Only people added can open it. Things in My Drive are private until you share them.'
       :lockedAbove?`Only people with access can open it, because “${lockedAbove.name}” above is restricted.`
       :access==='restricted'?`Only people added can open it${f.drive==='team'?', plus ZARN admins':''}. Folders and files inside follow this folder.`
       :`${everyone} can find and open it. Folders and files inside follow this folder.`}</small>
     </div>
     {!restricted&&<Dropdown variant="inline" label="Team access" disabled={!canManage} value={teamRole} onChange={v=>{touch();setTeamRole(v as 'view'|'edit');}} options={[{value:'view',label:'Viewer'},{value:'edit',label:'Editor'}]}/>}
    </div>
   </section>
   {msg&&<p className="zn-note" role="status">{msg}</p>}
   <footer className="zd-share-foot">
    <button type="button" className="zn-btn" disabled={busy} onClick={()=>void copy()}>{copied?<Check size={15}/>:<Link2 size={15}/>}{copied?'Link copied':'Copy link'}</button>
    <button type="button" className="zn-btn is-primary" disabled={busy} onClick={()=>void done()}>{dirty?(mine.length>orig.length?'Save and notify':'Save'):'Done'}</button>
   </footer>
   <p className="zd-share-tip">The link only opens for people with access to this folder.</p>
   </>}
  </div>
 </Modal>;
}
