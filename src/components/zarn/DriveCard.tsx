'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ChevronRight,FileSpreadsheet,FileText,FolderOpen,Lock} from 'lucide-react';
import {useZarn} from './ZarnProvider';
type Doc={id:string;title:string;kind:string;drive:'my'|'team'|'client';lead_id:string|null;folder_id:string|null;owner_id:string};
type Info={doc:Doc|null;path:{id:string;name:string}[];pub?:string;folder?:Doc};
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
// A ZARN document or sheet link: /zarn/docs/<id>, /zarn/sheets/<id>, or a public /doc/<token>.
export function driveLink(url:string):{id?:string;token?:string;folder?:string}|null{
 try{const u=new URL(url);const a=u.pathname.match(new RegExp(`^/zarn/(?:docs|sheets)/(${UUID})`,'i'));if(a)return {id:a[1]};if(u.pathname==='/zarn/drive'){const f=u.searchParams.get('f');if(f&&new RegExp(`^${UUID}$`,'i').test(f))return {folder:f};}const b=u.pathname.match(/^\/doc\/([A-Za-z0-9_-]{8,})$/);if(b)return {token:b[1]};}catch{}
 return null;
}
const cache=new Map<string,Promise<Info>>();
// The card shown under a chat message with a ZARN document link: what it is, where it lives in Drive, and buttons to open it.
export default function DriveCard({url,target}:{url:string;target:{id?:string;token?:string;folder?:string}}){
 const {db,me,channels,title}=useZarn();
 const [info,setInfo]=useState<Info|null>(null);
 useEffect(()=>{
  let live=true;
  let p=cache.get(url);
  if(!p){p=(async():Promise<Info>=>{
   const up=async(start:string|null)=>{const path:{id:string;name:string}[]=[];let f=start;
    for(let i=0;f&&i<12;i++){const {data:fd}=await db.from('zarn_drive_folders').select('id,name,parent_id').eq('id',f).maybeSingle();if(!fd)break;const x=fd as {id:string;name:string;parent_id:string|null};path.unshift({id:x.id,name:x.name});f=x.parent_id;}
    return path;};
   if(target.folder){
    const {data:fo}=await db.from('zarn_drive_folders').select('id,name,drive,lead_id,parent_id,owner_id').eq('id',target.folder).is('trashed_at',null).maybeSingle();
    if(!fo)return {doc:null,path:[]};const x=fo as {id:string;name:string;drive:Doc['drive'];lead_id:string|null;parent_id:string|null;owner_id:string};
    return {doc:null,path:await up(x.parent_id),folder:{id:x.id,title:x.name,kind:'folder',drive:x.drive,lead_id:x.lead_id,folder_id:x.parent_id,owner_id:x.owner_id}};
   }
   let id=target.id;
   if(!id&&target.token){const r=await fetch('/api/zarn/docs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resolve',token:target.token})}).then(x=>x.ok?x.json():null).catch(()=>null);id=r?.doc_id??undefined;}
   if(!id)return {doc:null,path:[],pub:target.token?url:undefined};
   const {data}=await db.from('zarn_docs').select('id,title,kind,drive,lead_id,folder_id,owner_id').eq('id',id).is('trashed_at',null).maybeSingle();
   const doc=(data as Doc|null)??null;const path:{id:string;name:string}[]=[];
   let f=doc?.folder_id??null;
   for(let i=0;f&&i<12;i++){const {data:fd}=await db.from('zarn_drive_folders').select('id,name,parent_id').eq('id',f).maybeSingle();if(!fd)break;const x=fd as {id:string;name:string;parent_id:string|null};path.unshift({id:x.id,name:x.name});f=x.parent_id;}
   return {doc,path,pub:target.token?url:undefined};
  })();cache.set(url,p);}
  void p.then(x=>{if(live)setInfo(x);});
  return()=>{live=false;};
 },[db,url,target.id,target.token,target.folder]);
 if(!info)return null;
 const d=info.doc??info.folder;
 if(!d)return <div className="zn-dc is-locked">
  <span className="zn-dc-ic"><Lock size={18}/></span>
  <div className="zn-dc-main"><b>{info.pub?'Shared ZARN document':target.folder?'ZARN folder':'ZARN document'}</b><small>{info.pub?'Anyone with this link can view it.':'You don’t have access. Ask the person who shared it.'}</small></div>
  {info.pub&&<div className="zn-dc-acts"><a className="zn-btn is-primary" href={info.pub} target="_blank" rel="noopener noreferrer">Open</a></div>}
 </div>;
 const sheet=d.kind==='sheet',isFolder=d.kind==='folder';
 const client=d.drive==='client'?channels.find(c=>c.kind==='client'&&c.lead_id===d.lead_id):undefined;
 const shared=d.drive==='my'&&d.owner_id!==me.user_id;
 const root=d.drive==='team'?'Team drive':d.drive==='client'?(client?title(client):'Client drive'):shared?'Shared with me':'My Drive';
 const base=d.drive==='team'?'/zarn/drive?v=team':d.drive==='client'?`/zarn/drive?v=client&l=${d.lead_id}`:shared?'/zarn/drive?v=shared':'/zarn/drive?v=my';
 const crumbs=shared&&!isFolder?[]:info.path;
 const last=crumbs[crumbs.length-1];
 const where=isFolder?`${base.replace('v=shared','v=my')}&f=${d.id}`:last?`${base}&f=${last.id}`:base;
 const openHref=isFolder?where:`/zarn/${sheet?'sheets':'docs'}/${d.id}`;
 return <div className={`zn-dc${sheet?' is-sheet':''}${isFolder?' is-folder':''}`}>
  <span className="zn-dc-ic">{isFolder?<FolderOpen size={20}/>:sheet?<FileSpreadsheet size={20}/>:<FileText size={20}/>}</span>
  <div className="zn-dc-main">
   <Link href={openHref} className="zn-dc-title">{d.title||'Untitled'}</Link>
   <small className="zn-dc-path"><FolderOpen size={12}/><span>{root}</span>{crumbs.map(c=><span key={c.id}><ChevronRight size={11}/>{c.name}</span>)}</small>
  </div>
  <div className="zn-dc-acts">
   {!isFolder&&<Link className="zn-btn" href={where}><FolderOpen size={14}/>Open in Drive</Link>}
   <Link className="zn-btn is-primary" href={openHref}>{isFolder?'Open folder':'Open'}</Link>
  </div>
 </div>;
}
