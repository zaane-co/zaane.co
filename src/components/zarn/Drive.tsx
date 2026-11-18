'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {Briefcase,Check,ChevronDown,FileSpreadsheet,FolderUp,Keyboard,CheckSquare,ChevronRight,X,Clock,Download,File as FileIcon,FileText,Folder,FolderInput,FolderPlus,HardDrive,LayoutGrid,List,Loader2,MessageSquare,MoreVertical,Pencil,Plus,RotateCcw,Search,Share2,Star,Trash2,Upload,Users} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {useConfirm} from './ConfirmProvider';
import {Modal,PeoplePicker} from './Dialogs';
import {Avatar,dayOf} from './format';
import DocViewer,{docKind} from './DocViewer';
import ShareDoc from './ShareDoc';
import Files from './Files';
import {optimizeImage} from '@/components/admin/blog/shared';

type DriveKind='my'|'team'|'client';
type Kind='folder'|'doc'|'file';
type Item={sheet?:boolean;color?:string|null;opened?:string;kind:Kind;id:string;name:string;owner_id:string;drive:DriveKind;lead_id:string|null;folder_id:string|null;trashed_at:string|null;updated_at:string;size?:number;type?:string;shared?:boolean};
// Where you are: a drive's root or a folder, or one of the cross-drive lists.
type Place={drive:DriveKind;lead:string|null;folder:string|null};
type ListView='shared'|'recent'|'starred'|'trash'|'chats';

const size=(n=0)=>n>1024*1024?`${(n/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(n/1024))} KB`;
const ext=(n:string)=>(n.includes('.')?n.split('.').pop()!:'file').slice(0,4).toUpperCase();
const isImage=(t='')=>t.startsWith('image/')&&t!=='image/svg+xml';
const loadPref=<T extends string>(k:string,d:T):T=>{try{return (localStorage.getItem(k) as T)||d;}catch{return d;}};
const savePref=(k:string,v:string)=>{try{localStorage.setItem(k,v);}catch{}};

// Google-Drive-style home for docs, uploaded files and folders: My Drive, the team drive and one drive per client.
export default function Drive(){
 const {db,me,people,channels,title}=useZarn(),confirm=useConfirm(),router=useRouter(),params=useSearchParams();
 const [items,setItems]=useState<Item[]|null>(null),[stars,setStars]=useState<Set<string>>(new Set()),[err,setErr]=useState('');
 const [q,setQ]=useState(''),[layout,setLayout]=useState<'grid'|'list'>('grid'),[sort,setSort]=useState<'name'|'updated'>('updated');
 const [menu,setMenu]=useState<{item:Item;x:number;y:number}|null>(null),[newMenu,setNewMenu]=useState(false),[bgMenu,setBgMenu]=useState<{x:number;y:number}|null>(null),[sel,setSel]=useState<Set<string>>(new Set());
 const [renaming,setRenaming]=useState<Item|null>(null),[naming,setNaming]=useState(false),[moving,setMoving]=useState<Item[]|null>(null),[sharingDoc,setSharingDoc]=useState<string|null>(null),[sharingItem,setSharingItem]=useState<Item|null>(null),[accessItem,setAccessItem]=useState<Item|null>(null),[viewing,setViewing]=useState<Item|null>(null);
 const [uploads,setUploads]=useState<{name:string;done:boolean;err?:string}[]>([]),[dragOver,setDragOver]=useState<string|null>(null);
 const bulkRef=useRef<(k:'trash'|'restore'|'star')=>Promise<void>>(async()=>{}),openRef=useRef<(i:Item)=>void>(()=>{}),newDocRef=useRef<(s:boolean)=>Promise<void>>(async()=>{});
 const pick=useRef<HTMLInputElement>(null),pickDir=useRef<HTMLInputElement>(null),searchRef=useRef<HTMLInputElement>(null);
 const [keysOpen,setKeysOpen]=useState(false),[switching,setSwitching]=useState(false);
 const guest=me.account_type==='guest';
 useEffect(()=>{setLayout(loadPref('zarn-drive-layout',matchMedia('(max-width:760px)').matches?'list':'grid'));setSort(loadPref('zarn-drive-sort','updated'));},[]);

 // Where we are, from the URL: ?v=team | ?v=client&l=<lead> | ?v=shared|recent|starred|trash|chats, plus ?f=<folder>.
 const v=params.get('v')??'my',folderParam=params.get('f'),leadParam=params.get('l');
 const list:ListView|null=(['shared','recent','starred','trash','chats'] as const).find(x=>x===v)??null;
 const clients=useMemo(()=>channels.filter(c=>c.kind==='client'&&c.lead_id&&!c.archived_at).map(c=>({lead:c.lead_id!,name:title(c)})),[channels,title]);
 const clientName=useCallback((l:string|null)=>clients.find(c=>c.lead===l)?.name??'Client',[clients]);

 const load=useCallback(async()=>{
  const [f,d,fl,s,fs,dm,fm,op]=await Promise.all([
   db.from('zarn_drive_folders').select('id,name,owner_id,drive,lead_id,parent_id,trashed_at,updated_at,color').limit(2000),
   db.from('zarn_docs').select('id,title,owner_id,drive,lead_id,folder_id,trashed_at,updated_at,visibility,kind').limit(2000),
   db.from('zarn_files').select('id,name,owner_id,drive,lead_id,folder_id,trashed_at,updated_at,size,type').limit(2000),
   db.from('zarn_drive_stars').select('kind,item_id').eq('user_id',me.user_id),
   db.from('zarn_file_shares').select('file_id').eq('user_id',me.user_id),
   db.from('zarn_doc_members').select('doc_id').eq('user_id',me.user_id),
   db.from('zarn_drive_folder_members').select('folder_id'),
   db.from('zarn_drive_opens').select('kind,item_id,opened_at').eq('user_id',me.user_id),
  ]);
  if(f.error||d.error||fl.error){setErr('Drive could not load. If this keeps happening, the Drive update may not be installed yet.');setItems([]);return;}
  const opened=new Map(((op.data??[]) as {kind:string;item_id:string;opened_at:string}[]).map(x=>[`${x.kind}:${x.item_id}`,x.opened_at])),sharedFolders=new Set(((fm.data??[]) as {folder_id:string}[]).map(x=>x.folder_id)),sharedFiles=new Set(((fs.data??[]) as {file_id:string}[]).map(x=>x.file_id)),sharedDocs=new Set(((dm.data??[]) as {doc_id:string}[]).map(x=>x.doc_id));
  type R=Record<string,unknown>;
  const all:Item[]=[
   ...((f.data??[]) as R[]).map(x=>({kind:'folder' as const,id:x.id as string,name:x.name as string,owner_id:x.owner_id as string,drive:x.drive as DriveKind,lead_id:x.lead_id as string|null,folder_id:x.parent_id as string|null,trashed_at:x.trashed_at as string|null,updated_at:x.updated_at as string,shared:sharedFolders.has(x.id as string),color:x.color as string|null})),
   ...((d.data??[]) as R[]).map(x=>({kind:'doc' as const,id:x.id as string,name:(x.title as string)||'Untitled',owner_id:x.owner_id as string,drive:x.drive as DriveKind,lead_id:x.lead_id as string|null,folder_id:x.folder_id as string|null,trashed_at:x.trashed_at as string|null,updated_at:x.updated_at as string,shared:sharedDocs.has(x.id as string)||x.visibility==='team',sheet:x.kind==='sheet',opened:opened.get(`doc:${x.id}`)})),
   ...((fl.data??[]) as R[]).map(x=>({kind:'file' as const,id:x.id as string,name:x.name as string,owner_id:x.owner_id as string,drive:x.drive as DriveKind,lead_id:x.lead_id as string|null,folder_id:x.folder_id as string|null,trashed_at:x.trashed_at as string|null,updated_at:x.updated_at as string,size:x.size as number,type:x.type as string,shared:sharedFiles.has(x.id as string),opened:opened.get(`file:${x.id}`)})),
  ];
  setItems(all);setStars(new Set(((s.data??[]) as {kind:string;item_id:string}[]).map(x=>`${x.kind}:${x.item_id}`)));
 },[db,me.user_id]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves, not synchronously
 useEffect(()=>{void load();},[load]);

 // Search also looks inside docs and sheets (their text), not just names.
 const [hits,setHits]=useState<Set<string>>(new Set());
 useEffect(()=>{const term=q.trim();if(term.length<2){setHits(new Set());return;}
  const t=setTimeout(async()=>{const {data}=await db.from('zarn_docs').select('id').ilike('content',`%${term.replace(/[%_\\]/g,m=>'\\'+m)}%`).limit(200);setHits(new Set(((data??[]) as {id:string}[]).map(x=>x.id)));},250);
  return()=>clearTimeout(t);},[q,db]);
 const used=useMemo(()=>(items??[]).filter(i=>i.kind==='file'&&i.owner_id===me.user_id).reduce((n,i)=>n+(i.size??0),0),[items,me.user_id]);
 const byId=useMemo(()=>new Map((items??[]).filter(i=>i.kind==='folder').map(i=>[i.id,i])),[items]);
 // A folder (or anything inside it) is gone while it or any folder above it is in the trash.
 const buried=useCallback((i:Item)=>{let f=i.folder_id,hops=0;while(f&&hops<50){const p=byId.get(f);if(!p)return false;if(p.trashed_at)return true;f=p.folder_id;hops++;}return false;},[byId]);
 const alive=useCallback((i:Item)=>!i.trashed_at&&!buried(i),[buried]);

 const folder=folderParam?byId.get(folderParam)??null:null;
 const place:Place|null=list?null:folder?{drive:folder.drive,lead:folder.lead_id,folder:folder.id}:{drive:v==='team'?'team':v==='client'&&leadParam?'client':'my',lead:v==='client'?leadParam:null,folder:null};
 const canAdd=!guest&&!!place;
 const trail=useMemo(()=>{const t:Item[]=[];let f=folder,hops=0;while(f&&hops<50){t.unshift(f);f=f.folder_id?byId.get(f.folder_id)??null:null;hops++;}return t;},[folder,byId]);
 const rootLabel=(p:{drive:DriveKind;lead:string|null})=>p.drive==='team'?'Team drive':p.drive==='client'?clientName(p.lead):'My Drive';
 const rootHref=(p:{drive:DriveKind;lead:string|null})=>p.drive==='team'?'/zarn/drive?v=team':p.drive==='client'?`/zarn/drive?v=client&l=${p.lead}`:'/zarn/drive';

 const shown=useMemo(()=>{
  if(!items)return [];
  let r:Item[];
  if(q.trim())r=items.filter(i=>alive(i)&&(i.name.toLowerCase().includes(q.trim().toLowerCase())||(i.kind==='doc'&&hits.has(i.id))));
  else if(list==='trash')r=items.filter(i=>i.trashed_at&&!buried(i));
  else if(list==='recent')r=items.filter(i=>i.kind!=='folder'&&alive(i)&&(i.opened||i.owner_id===me.user_id)).sort((a,b)=>(b.opened??b.updated_at).localeCompare(a.opened??a.updated_at)).slice(0,60);
  else if(list==='starred')r=items.filter(i=>stars.has(`${i.kind}:${i.id}`)&&alive(i));
  else if(list==='shared')r=items.filter(i=>i.owner_id!==me.user_id&&i.drive==='my'&&(!i.folder_id||!byId.has(i.folder_id))&&alive(i));
  else if(place)r=items.filter(i=>alive(i)&&i.folder_id===place.folder&&i.drive===place.drive&&(place.drive!=='my'||place.folder||i.owner_id===me.user_id)&&(place.drive!=='client'||i.lead_id===place.lead));
  else r=[];
  if(list==='recent'&&!q.trim())return r;
  return [...r].sort((a,b)=>(a.kind==='folder'?0:1)-(b.kind==='folder'?0:1)||(sort==='name'?a.name.localeCompare(b.name):b.updated_at.localeCompare(a.updated_at)));
 },[items,q,list,place,stars,alive,buried,me.user_id,sort,byId,hits]);

 // Writes ------------------------------------------------------------------------------------------
 const table=(k:Kind)=>k==='folder'?'zarn_drive_folders':k==='doc'?'zarn_docs':'zarn_files';
 const parentCol=(k:Kind)=>k==='folder'?'parent_id':'folder_id';
 const fail=(e:{message?:string}|null|undefined,fallback:string)=>{if(!e)return false;setErr(/cannot|not available|inside itself|Pick a client/.test(e.message??'')?e.message!:fallback);return true;};
 const patchLocal=(it:Item,p:Partial<Item>)=>setItems(xs=>xs?.map(x=>x.kind===it.kind&&x.id===it.id?{...x,...p}:x)??null);
 const target=():Record<string,unknown>=>place?.folder?{}:{drive:place?.drive??'my',...(place?.drive==='client'?{lead_id:place.lead}:{})};

 async function newFolder(name:string){
  if(!place)return;setErr('');
  const id=crypto.randomUUID();
  const {error}=await db.from('zarn_drive_folders').insert({id,name:name.trim().slice(0,120),owner_id:me.user_id,parent_id:place.folder,drive:place.drive,lead_id:place.drive==='client'?place.lead:null});
  if(fail(error,'Could not create the folder.'))return;
  setNaming(false);void load();
 }
 async function newDoc(sheet=false){
  setNewMenu(false);if(!place)return;setErr('');
  const id=crypto.randomUUID();
  const {error}=await db.from('zarn_docs').insert({id,owner_id:me.user_id,title:sheet?'Untitled sheet':'Untitled',folder_id:place.folder,...target(),...(sheet?{kind:'sheet',content:JSON.stringify({tabs:[{id:'s1',name:'Sheet1',cells:{}}]})}:{})});
  if(fail(error,sheet?'Could not create the sheet.':'Could not create the doc.'))return;
  router.push(sheet?`/zarn/sheets/${id}`:`/zarn/docs/${id}`);
 }
 // Uploads go straight to storage (up to 100 MB each). Picking a folder recreates its folder tree here.
 async function sendFile(raw:File,to:{drive:string;folder_id:string|null;lead_id:string|null}){
  const file=raw.type.startsWith('image/')&&raw.type!=='image/gif'&&raw.type!=='image/svg+xml'&&raw.size<8*1024*1024?await optimizeImage(raw):raw;
  const post=async(body:object)=>{const r=await fetch('/api/zarn/files',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...to,...body})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Upload failed');return d;};
  const s=await post({action:'sign',name:raw.name,type:file.type||'application/octet-stream',size:file.size});
  const put=await fetch(s.url,{method:'PUT',headers:{'Content-Type':s.type},body:file});if(!put.ok)throw new Error('Upload failed');
  await post({action:'save',key:s.key,name:raw.name});
 }
 async function upload(files:File[]){
  if(!place||!files.length)return;setErr('');
  const list=files.slice(0,200);setUploads(list.map(f=>({name:(f as File&{webkitRelativePath?:string}).webkitRelativePath||f.name,done:false})));
  const base={drive:place.drive,folder_id:place.folder,lead_id:place.drive==='client'?place.lead:null};
  const made=new Map<string,string>();
  // Make (or reuse) the folder for a path like "Photos/2026" under the current place.
  const folderFor=async(path:string):Promise<string|null>=>{
   if(!path)return place.folder;if(made.has(path))return made.get(path)!;
   const cut=path.lastIndexOf('/'),parent=await folderFor(cut<0?'':path.slice(0,cut)),name=path.slice(cut+1).slice(0,120)||'Folder';
   const id=crypto.randomUUID();
   const {error}=await db.from('zarn_drive_folders').insert({id,name,owner_id:me.user_id,parent_id:parent,drive:place.drive,lead_id:place.drive==='client'?place.lead:null});
   if(error)throw new Error('Could not create a folder.');made.set(path,id);return id;
  };
  for(const [i,raw] of list.entries()){
   try{
    const rel=(raw as File&{webkitRelativePath?:string}).webkitRelativePath??'',dir=rel.includes('/')?rel.slice(0,rel.lastIndexOf('/')):'';
    const folder=await folderFor(dir);
    await sendFile(raw,dir?{...base,folder_id:folder}:base);
    setUploads(u=>u.map((x,j)=>j===i?{...x,done:true}:x));
   }catch(e){setUploads(u=>u.map((x,j)=>j===i?{...x,done:true,err:e instanceof Error?e.message:'Upload failed'}:x));}
  }
  void load();setTimeout(()=>setUploads(u=>u.some(x=>x.err)?u:[]),2500);
 }
 async function recolor(it:Item,color:string|null){setErr('');const {error}=await db.from('zarn_drive_folders').update({color}).eq('id',it.id);if(fail(error,'Could not change the colour.'))return;patchLocal(it,{color});}
 async function rename(it:Item,name:string){
  const n=name.trim();if(!n)return;setErr('');
  const {error}=await db.from(table(it.kind)).update(it.kind==='doc'?{title:n.slice(0,200)}:{name:n.slice(0,it.kind==='folder'?120:200)}).eq('id',it.id);
  if(fail(error,'Could not rename it.'))return;
  patchLocal(it,{name:n});setRenaming(null);
 }
 async function move(it:Item,to:Place){
  setErr('');
  if(it.kind!=='folder'&&it.folder_id===to.folder&&it.drive===to.drive&&(to.drive!=='client'||it.lead_id===to.lead))return true;
  const body:Record<string,unknown>={[parentCol(it.kind)]:to.folder};
  if(!to.folder){body.drive=to.drive;if(to.drive==='client'||it.kind!=='doc')body.lead_id=to.drive==='client'?to.lead:null;}
  if(it.kind==='doc'&&!to.folder&&to.drive!=='client')delete body.lead_id;
  const {error}=await db.from(table(it.kind)).update(body).eq('id',it.id);
  return !fail(error,'Could not move it there.');
 }
 async function moveAll(list:Item[],to:Place){for(const it of list)if(!await move(it,to))break;setMoving(null);setSel(new Set());void load();}
 async function toggleStar(it:Item){
  const k=`${it.kind}:${it.id}`,on=stars.has(k);
  setStars(s=>{const n=new Set(s);if(on)n.delete(k);else n.add(k);return n;});
  const {error}=on?await db.from('zarn_drive_stars').delete().eq('user_id',me.user_id).eq('kind',it.kind).eq('item_id',it.id)
   :await db.from('zarn_drive_stars').insert({user_id:me.user_id,kind:it.kind,item_id:it.id});
  if(error){setErr('Could not update the star.');void load();}
 }
 async function trash(it:Item,back=false){
  setErr('');
  const {error}=await db.from(table(it.kind)).update({trashed_at:back?null:new Date().toISOString()}).eq('id',it.id);
  if(fail(error,back?'Could not restore it.':'Could not move it to the trash.'))return;
  patchLocal(it,{trashed_at:back?null:new Date().toISOString()});
 }
 // Every file stored anywhere under a folder (any depth), so their stored copies can be removed too.
 const filesUnder=(folderId:string)=>{const ids=new Set([folderId]);let grew=true;while(grew){grew=false;for(const x of items??[])if(x.kind==='folder'&&x.folder_id&&ids.has(x.folder_id)&&!ids.has(x.id)){ids.add(x.id);grew=true;}}
  return (items??[]).filter(x=>x.kind==='file'&&x.folder_id&&ids.has(x.folder_id));};
 // Delete forever. Folders take everything inside with them; stored file copies are removed too.
 async function wipe(it:Item){
  const files=it.kind==='folder'?filesUnder(it.id):it.kind==='file'?[it]:[];
  for(const f of files){const r=await fetch(`/api/zarn/files?f=${f.id}`,{method:'DELETE'});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Could not delete a file inside.');}
  if(it.kind!=='file'){const {error,count}=await db.from(table(it.kind)).delete({count:'exact'}).eq('id',it.id);if(error||!count)throw new Error('Only the owner or a ZARN admin can delete this for good.');}
 }
 async function destroy(list:Item[]){
  if(!list.length)return;
  const one=list.length===1?list[0]:null;
  if(!await confirm({title:one?`Delete “${one.name}” forever?`:`Delete ${list.length} items forever?`,message:list.some(i=>i.kind==='folder')?'Everything inside folders is deleted too. This cannot be undone.':'This cannot be undone.',confirm:'Delete forever',danger:true}))return;
  setErr('');
  try{for(const it of list)await wipe(it);}catch(e){setErr(e instanceof Error?e.message:'Could not delete it.');}
  setSel(new Set());void load();
 }
 async function emptyTrash(){
  const mine=(items??[]).filter(i=>i.trashed_at&&!buried(i)&&i.owner_id===me.user_id);
  if(!mine.length||!await confirm({title:'Empty the trash?',message:`${mine.length} item${mine.length===1?'':'s'} you own will be deleted forever.`,confirm:'Empty trash',danger:true}))return;
  setErr('');
  try{for(const it of mine)await wipe(it);}catch(e){setErr(e instanceof Error?e.message:'Some items could not be deleted.');}
  void load();
 }
 // Selection: Ctrl/Cmd/Shift-click or the tick box picks items; once something is picked, a plain click adds to it.
 const keyOf=(it:Item)=>`${it.kind}:${it.id}`;
 const toggle=(it:Item)=>setSel(s=>{const n=new Set(s);const k=keyOf(it);if(n.has(k))n.delete(k);else n.add(k);return n;});
 const picked=(items??[]).filter(i=>sel.has(keyOf(i)));
 const click=(e:React.MouseEvent,it:Item)=>{if(e.metaKey||e.ctrlKey||e.shiftKey||sel.size){e.preventDefault();toggle(it);}else open(it);};
 useEffect(()=>{setSel(new Set());},[v,folderParam,leadParam]);
 // Keyboard: / search · Shift+F new folder · Shift+D new doc · Shift+S new sheet · U upload · Delete trash · Enter open · F2 rename · Ctrl/Cmd+A select all · Esc clear.
 const keyState=useRef({picked:[] as Item[],shown:[] as Item[],list:null as ListView|null,canAdd:false});
 keyState.current={picked,shown,list,canAdd};
 useEffect(()=>{const k=(e:KeyboardEvent)=>{
  const t=e.target as HTMLElement|null;if(t&&(t.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')))return;
  const {picked:p,shown:sh,list:l,canAdd:add}=keyState.current,mod=e.metaKey||e.ctrlKey;
  if(e.key==='Escape')setSel(new Set());
  else if(e.key==='/'){e.preventDefault();searchRef.current?.focus();}
  else if(e.key==='?')setKeysOpen(true);
  else if(mod&&e.key.toLowerCase()==='a'){e.preventDefault();setSel(new Set(sh.map(i=>`${i.kind}:${i.id}`)));}
  else if((e.key==='Delete'||e.key==='Backspace')&&p.length&&l!=='trash'){e.preventDefault();void bulkRef.current('trash');}
  else if(e.key==='Enter'&&p.length===1){e.preventDefault();openRef.current(p[0]);}
  else if(e.key==='F2'&&p.length===1){e.preventDefault();setRenaming(p[0]);}
  else if(add&&e.shiftKey&&!mod&&e.key==='F'){e.preventDefault();setNaming(true);}
  else if(add&&e.shiftKey&&!mod&&e.key==='D'){e.preventDefault();void newDocRef.current(false);}
  else if(add&&e.shiftKey&&!mod&&e.key==='S'){e.preventDefault();void newDocRef.current(true);}
  else if(add&&!mod&&!e.shiftKey&&e.key==='u'){e.preventDefault();pick.current?.click();}
 };window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[]);
 const checkBox=(it:Item)=><button type="button" className={`zdr-check${sel.has(keyOf(it))?' is-on':''}`} aria-label={`Select ${it.name}`} aria-pressed={sel.has(keyOf(it))} onClick={e=>{e.stopPropagation();toggle(it);}}>{sel.has(keyOf(it))&&<Check size={12} strokeWidth={3}/>}</button>;
 async function bulk(kind:'trash'|'restore'|'star'){
  setErr('');
  for(const it of picked){
   if(kind==='star'){if(!stars.has(keyOf(it)))await toggleStar(it);}
   else{const {error}=await db.from(table(it.kind)).update({trashed_at:kind==='restore'?null:new Date().toISOString()}).eq('id',it.id);if(error){setErr('Some items could not be changed.');}}
  }
  setSel(new Set());void load();
 }

 const open=(it:Item)=>{
  if(it.trashed_at)return;
  if(it.kind==='folder')router.push(`/zarn/drive?f=${it.id}`);
  else if(it.kind==='doc')router.push(it.sheet?`/zarn/sheets/${it.id}`:`/zarn/docs/${it.id}`);
  else{void db.from('zarn_drive_opens').upsert({user_id:me.user_id,kind:'file',item_id:it.id,opened_at:new Date().toISOString()});
  if(isImage(it.type)||docKind({name:it.name,type:it.type??''}))setViewing(it);
  else window.location.href=`/api/zarn/files?f=${it.id}&download=1`;}
 };
 const where=(it:Item)=>it.drive==='team'?'Team drive':it.drive==='client'?clientName(it.lead_id):it.owner_id===me.user_id?'My Drive':`${people[it.owner_id]?.display_name??'Someone'}’s drive`;
 const ownerName=(id:string)=>id===me.user_id?'me':people[id]?.display_name??'Someone';
 const icon=(it:Item,s=20)=>it.kind==='folder'?<Folder size={s} className="zdr-ic is-folder" fill="currentColor" style={it.color?{color:it.color}:undefined}/>:it.sheet?<FileSpreadsheet size={s} className="zdr-ic is-sheet"/>:it.kind==='doc'?<FileText size={s} className="zdr-ic is-doc"/>:<FileIcon size={s} className="zdr-ic is-file"/>;

 // Drag items onto folders (or a breadcrumb) to move them; drop files from the computer to upload here.
 const dragProps=(it:Item)=>({draggable:!it.trashed_at,onDragStart:(e:React.DragEvent)=>{e.dataTransfer.setData('application/x-zarn-drive',`${it.kind}:${it.id}`);e.dataTransfer.effectAllowed='move';}});
 const dropOn=(to:Place|null,key:string)=>({
  onDragOver:(e:React.DragEvent)=>{if(to&&(e.dataTransfer.types.includes('application/x-zarn-drive')||e.dataTransfer.types.includes('Files'))){e.preventDefault();e.stopPropagation();setDragOver(key);}},
  onDragLeave:()=>setDragOver(d=>d===key?null:d),
  onDrop:(e:React.DragEvent)=>{setDragOver(null);if(!to)return;const raw=e.dataTransfer.getData('application/x-zarn-drive');e.preventDefault();e.stopPropagation();
   if(raw){const [k,id]=raw.split(':');const it=items?.find(x=>x.kind===k&&x.id===id);if(it){const group=sel.has(keyOf(it))?picked:[it];void moveAll(group.filter(x=>!(x.kind==='folder'&&x.id===to.folder)),to);}}
   else if(e.dataTransfer.files.length&&place&&to.folder===place.folder&&to.drive===place.drive)void upload(Array.from(e.dataTransfer.files));},
 });
 const asPlace=(f:Item):Place=>({drive:f.drive,lead:f.lead_id,folder:f.id});

 const nav:[string,string,React.ReactNode,boolean][]=[
  ['/zarn/drive','My Drive',<HardDrive key="m" size={17}/>,!list&&(place?.drive==='my')],
  ...(!guest?[['/zarn/drive?v=team','Team drive',<Users key="t" size={17}/>,!list&&place?.drive==='team'] as [string,string,React.ReactNode,boolean]]:[]),
  ['/zarn/drive?v=shared','Shared with me',<Share2 key="s" size={17}/>,list==='shared'],
  ['/zarn/drive?v=recent','Recent',<Clock key="r" size={17}/>,list==='recent'],
  ['/zarn/drive?v=starred','Starred',<Star key="st" size={17}/>,list==='starred'],
  ['/zarn/drive?v=chats','From chats',<MessageSquare key="c" size={17}/>,list==='chats'],
  ['/zarn/drive?v=trash','Trash',<Trash2 key="tr" size={17}/>,list==='trash'],
 ];
 const heading=list==='shared'?'Shared with me':list==='recent'?'Recent':list==='starred'?'Starred':list==='trash'?'Trash':list==='chats'?'From chats':place?rootLabel(place):'';

 bulkRef.current=bulk;openRef.current=open;newDocRef.current=newDoc;
 return <div className="zdr" onClick={()=>{setMenu(null);setNewMenu(false);setBgMenu(null);}}>
  <aside className="zdr-side">
   {canAdd||list!=='chats'?<div className="zdr-new-wrap"><button type="button" className="zdr-new" disabled={guest} onClick={e=>{e.stopPropagation();if(!place)router.push('/zarn/drive');setNewMenu(o=>!o);}}><Plus size={18}/>New</button>
    {newMenu&&place&&<div className="zn-menu zdr-pop" onClick={e=>e.stopPropagation()}>
     <button type="button" onClick={()=>{setNewMenu(false);setNaming(true);}}><FolderPlus size={15}/>New folder</button>
     <button type="button" onClick={()=>void newDoc()}><FileText size={15}/>New doc</button>
     <button type="button" onClick={()=>void newDoc(true)}><FileSpreadsheet size={15}/>New sheet</button>
     <button type="button" onClick={()=>{setNewMenu(false);pick.current?.click();}}><Upload size={15}/>Upload files</button>
     <button type="button" onClick={()=>{setNewMenu(false);pickDir.current?.click();}}><FolderUp size={15}/>Upload folder</button>
    </div>}</div>:null}
   <nav className="zdr-nav">{nav.map(([href,label,ic,on])=><button key={href} type="button" className={on?'is-on':''} onClick={()=>router.push(href)}>{ic}<span>{label}</span></button>)}</nav>
   {clients.length>0&&<><p className="zdr-nav-head"><Briefcase size={13}/>Client drives</p>
    <nav className="zdr-nav is-clients">{clients.map(c=>{const on=!list&&place?.drive==='client'&&place.lead===c.lead;return <button key={c.lead} type="button" className={on?'is-on':''} onClick={()=>router.push(`/zarn/drive?v=client&l=${c.lead}`)} {...dropOn({drive:'client',lead:c.lead,folder:null},`c:${c.lead}`)} data-over={dragOver===`c:${c.lead}`||undefined}><Folder size={16}/><span>{c.name}</span></button>;})}</nav></>}
   <div className="zdr-side-foot"><p className="zdr-used"><HardDrive size={13}/>{size(used)} used by your files</p><button type="button" className="zdr-keys-btn" onClick={()=>setKeysOpen(true)}><Keyboard size={14}/>Keyboard shortcuts</button></div>
  </aside>
  <input ref={pick} type="file" multiple hidden onChange={e=>{void upload(Array.from(e.target.files??[]));e.target.value='';}}/>
  <input ref={pickDir} type="file" multiple hidden {...{webkitdirectory:''}} onChange={e=>{void upload(Array.from(e.target.files??[]));e.target.value='';}}/>

  {list==='chats'?<div className="zdr-main is-embed"><Files/></div>:
  <section className="zdr-main" {...(place?dropOn(place,'here'):{})} data-over={dragOver==='here'||undefined} onContextMenu={e=>{if(!canAdd)return;e.preventDefault();setMenu(null);setBgMenu({x:e.clientX,y:e.clientY});}}>
   <header className="zdr-head">
    <div className="zdr-crumbs">
     <button type="button" className="zdr-switch" aria-label="Switch drive" onClick={e=>{e.stopPropagation();setSwitching(true);}}>{list||!place?(q?'Search':heading):rootLabel(place)}<ChevronDown size={18}/></button>
     {place&&!q?<>
      <button type="button" onClick={()=>router.push(rootHref(place))} {...dropOn({...place,folder:null},'root')} data-over={dragOver==='root'||undefined}>{rootLabel(place)}</button>
      {!place.folder&&<span className="zdr-who">{place.drive==='team'?'Everyone on the team':place.drive==='client'?'Everyone in this client’s space':'Only you'}</span>}
      {trail.map(f=><span key={f.id} className="zdr-crumb"><ChevronRight size={16}/><button type="button" onClick={()=>router.push(`/zarn/drive?f=${f.id}`)} {...dropOn(asPlace(f),`b:${f.id}`)} data-over={dragOver===`b:${f.id}`||undefined}>{f.name}</button></span>)}
     </>:<h1>{q?`Results for “${q}”`:heading}</h1>}
    </div>
    <label className="zdr-search"><Search size={15}/><input ref={searchRef} placeholder="Search in Drive" value={q} onChange={e=>setQ(e.target.value)} aria-label="Search in Drive"/></label>
    <div className="zdr-tools">
     {list==='trash'&&<button type="button" className="zn-btn" onClick={()=>void emptyTrash()}>Empty trash</button>}
     <select className="zdr-sort" value={sort} aria-label="Sort by" onChange={e=>{const s=e.target.value as 'name'|'updated';setSort(s);savePref('zarn-drive-sort',s);}}><option value="updated">Last modified</option><option value="name">Name</option></select>
     <div className="zdr-seg" role="group" aria-label="Layout">
      <button type="button" aria-label="List" aria-pressed={layout==='list'} className={layout==='list'?'is-on':''} onClick={()=>{setLayout('list');savePref('zarn-drive-layout','list');}}><List size={16}/></button>
      <button type="button" aria-label="Grid" aria-pressed={layout==='grid'} className={layout==='grid'?'is-on':''} onClick={()=>{setLayout('grid');savePref('zarn-drive-layout','grid');}}><LayoutGrid size={16}/></button>
     </div>
    </div>
   </header>
   {sel.size>0&&<div className="zdr-selbar" role="toolbar" aria-label="Selected items">
    <button type="button" className="zdr-selx" aria-label="Clear selection" onClick={()=>setSel(new Set())}><X size={16}/></button><b>{sel.size} selected</b>
    {list==='trash'?<><button type="button" onClick={()=>void bulk('restore')}><RotateCcw size={15}/>Restore</button><button type="button" className="zdr-danger" onClick={()=>void destroy(picked)}><Trash2 size={15}/>Delete forever</button></>
    :<><button type="button" onClick={()=>setMoving(picked)}><FolderInput size={15}/>Move</button><button type="button" onClick={()=>void bulk('star')}><Star size={15}/>Star</button><button type="button" className="zdr-danger" onClick={()=>void bulk('trash')}><Trash2 size={15}/>Trash</button></>}
    <button type="button" onClick={()=>setSel(new Set(shown.map(keyOf)))}><CheckSquare size={15}/>Select all</button>
   </div>}
   {list==='trash'&&<p className="zdr-note">Items in the trash can be restored. Only the owner or a ZARN admin can delete things for good.</p>}
   {err&&<p className="zn-error zdr-err" role="alert">{err}</p>}
   <div className="zdr-body" data-lenis-prevent>
    {items===null?<p className="zn-loading">Loading…</p>:!shown.length?(()=>{
     const e=q?{ic:<Search size={26}/>,t:'Nothing matches',p:`No names or doc text match “${q}”.`}
      :list==='trash'?{ic:<Trash2 size={26}/>,t:'Trash is empty',p:'Things you delete land here for 30 days before they’re gone for good.'}
      :list==='starred'?{ic:<Star size={26}/>,t:'No starred items',p:'Star the files and folders you use most to find them fast.'}
      :list==='shared'?{ic:<Share2 size={26}/>,t:'Nothing shared with you yet',p:'When teammates share files or folders with you, they appear here.'}
      :list==='recent'?{ic:<Clock size={26}/>,t:'Nothing recent',p:'Files and docs you open will show up here.'}
      :place?.folder?{ic:<Folder size={26}/>,t:'This folder is empty',p:'Add a folder, a doc or a sheet, or drop files here.'}
      :{ic:place?.drive==='team'?<Users size={26}/>:place?.drive==='client'?<Briefcase size={26}/>:<HardDrive size={26}/>,t:'Nothing here yet',p:'Create your first folder, doc or sheet, or drop files here.'};
     return <div className="zdr-empty"><span className="zdr-empty-ic">{e.ic}</span><h2>{e.t}</h2><p>{e.p}</p>
      {canAdd&&!q&&!list&&<div className="zdr-empty-acts"><button type="button" onClick={()=>setNaming(true)}><FolderPlus size={15}/>New folder</button><button type="button" onClick={()=>void newDoc()}><FileText size={15}/>New doc</button><button type="button" onClick={()=>void newDoc(true)}><FileSpreadsheet size={15}/>New sheet</button><button type="button" onClick={()=>pick.current?.click()}><Upload size={15}/>Upload</button></div>}
      {q&&<button type="button" className="zdr-empty-link" onClick={()=>setQ('')}>Clear search</button>}</div>;})()
    :layout==='grid'?<>
     {shown.some(i=>i.kind==='folder')&&<><p className="zdr-group">Folders</p><div className="zdr-folders">{shown.filter(i=>i.kind==='folder').map(f=><div key={f.id} role="button" tabIndex={0} className={`zdr-folder${sel.has(keyOf(f))?' is-sel':''}`} {...dragProps(f)} {...(f.trashed_at?{}:dropOn(asPlace(f),`f:${f.id}`))} data-over={dragOver===`f:${f.id}`||undefined} onClick={e=>click(e,f)} onKeyDown={e=>{if(e.key==='Enter')open(f);}} onContextMenu={e=>{e.preventDefault();e.stopPropagation();setBgMenu(null);setMenu({item:f,x:e.clientX,y:e.clientY});}}>
      <span className="zdr-fic">{icon(f)}{checkBox(f)}</span><span className="zdr-fname">{f.name}</span>{f.shared&&<Users size={13} className="zdr-faint"/>}{stars.has(`folder:${f.id}`)&&<Star size={12} className="zdr-star" fill="currentColor"/>}
      <button type="button" className="zdr-dots" aria-label={`More for ${f.name}`} onClick={e=>{e.stopPropagation();const r=e.currentTarget.getBoundingClientRect();setMenu({item:f,x:r.right,y:r.bottom});}}><MoreVertical size={16}/></button>
     </div>)}</div></>}
     {shown.some(i=>i.kind!=='folder')&&<><p className="zdr-group">Files</p><div className="zdr-grid">{shown.filter(i=>i.kind!=='folder').map(it=><div key={`${it.kind}:${it.id}`} role="button" tabIndex={0} className={`zdr-card${sel.has(keyOf(it))?' is-sel':''}`} {...dragProps(it)} onClick={e=>click(e,it)} onKeyDown={e=>{if(e.key==='Enter')open(it);}} onContextMenu={e=>{e.preventDefault();e.stopPropagation();setBgMenu(null);setMenu({item:it,x:e.clientX,y:e.clientY});}}>
      <div className="zdr-card-top">{checkBox(it)}{icon(it,16)}<b title={it.name}>{it.name}</b><button type="button" className="zdr-dots" aria-label={`More for ${it.name}`} onClick={e=>{e.stopPropagation();const r=e.currentTarget.getBoundingClientRect();setMenu({item:it,x:r.right,y:r.bottom});}}><MoreVertical size={16}/></button></div>
      <div className={`zdr-thumb is-${it.sheet?'sheet':it.kind}`}>{it.kind==='file'&&isImage(it.type)?<img src={`/api/zarn/files?f=${it.id}`} alt="" loading="lazy"/>:it.sheet?<FileSpreadsheet size={42}/>:it.kind==='doc'?<FileText size={42}/>:<em>{ext(it.name)}</em>}</div>
      <small><Avatar m={people[it.owner_id]} size={18}/>{list==='recent'||q?where(it):`${it.owner_id===me.user_id?'You':ownerName(it.owner_id)}`} · {dayOf(it.updated_at)}{stars.has(`${it.kind}:${it.id}`)&&<Star size={11} className="zdr-star" fill="currentColor"/>}</small>
     </div>)}</div></>}
    </>
    :<table className="zdr-table"><thead><tr><th>Name</th><th>Owner</th><th className="zdr-hide-sm">{list==='recent'||list==='starred'||q?'Location':'Last modified'}</th><th className="zdr-hide-sm">Size</th><th aria-label="Actions"/></tr></thead><tbody>
     {shown.map(it=><tr key={`${it.kind}:${it.id}`} className={sel.has(keyOf(it))?'is-sel':''} {...dragProps(it)} {...(it.kind==='folder'&&!it.trashed_at?dropOn(asPlace(it),`f:${it.id}`):{})} data-over={dragOver===`f:${it.id}`||undefined} onClick={e=>click(e,it)} onContextMenu={e=>{e.preventDefault();e.stopPropagation();setBgMenu(null);setMenu({item:it,x:e.clientX,y:e.clientY});}}>
      <td><span className="zdr-name">{checkBox(it)}{icon(it,18)}<b>{it.name}</b>{stars.has(`${it.kind}:${it.id}`)&&<Star size={12} className="zdr-star" fill="currentColor"/>}{it.shared&&<Users size={12} className="zdr-faint"/>}</span></td>
      <td><span className="zdr-owner"><Avatar m={people[it.owner_id]} size={20}/>{ownerName(it.owner_id)}</span></td>
      <td className="zdr-hide-sm">{list==='recent'||list==='starred'||q?where(it):dayOf(it.updated_at)}</td>
      <td className="zdr-hide-sm">{it.kind==='file'?size(it.size):'—'}</td>
      <td><button type="button" className="zdr-dots" aria-label={`More for ${it.name}`} onClick={e=>{e.stopPropagation();const r=e.currentTarget.getBoundingClientRect();setMenu({item:it,x:r.right,y:r.bottom});}}><MoreVertical size={16}/></button></td>
     </tr>)}
    </tbody></table>}
   </div>
   {uploads.length>0&&<div className="zdr-uploads" role="status"><b>{uploads.every(u=>u.done)?'Uploads finished':`Uploading ${uploads.filter(u=>!u.done).length}…`}</b>{uploads.map((u,i)=><p key={i}>{u.done?u.err?<span className="zdr-bad">!</span>:<span className="zdr-ok">✓</span>:<Loader2 size={13} className="zn-spin"/>}<span>{u.name}</span>{u.err&&<small>{u.err}</small>}</p>)}{uploads.every(u=>u.done)&&<button type="button" className="zn-btn" onClick={()=>setUploads([])}>Close</button>}</div>}
  </section>}

  {switching&&<div className="zdr-switch-scrim" onClick={e=>{e.stopPropagation();setSwitching(false);}}><div className="zdr-switch-sheet" role="dialog" aria-label="Drives" onClick={e=>e.stopPropagation()}>
   <span className="zdr-switch-grab"/>
   {nav.map(([href,label,ic,on])=><button key={href} type="button" className={on?'is-on':''} onClick={()=>{setSwitching(false);router.push(href);}}>{ic}<span>{label}</span>{on&&<Check size={18}/>}</button>)}
   {clients.length>0&&<><p>Client drives</p>{clients.map(c=>{const on=!list&&place?.drive==='client'&&place.lead===c.lead;return <button key={c.lead} type="button" className={on?'is-on':''} onClick={()=>{setSwitching(false);router.push(`/zarn/drive?v=client&l=${c.lead}`);}}><Briefcase size={18}/><span>{c.name}</span>{on&&<Check size={18}/>}</button>;})}</>}
  </div></div>}
  {menu&&<ItemMenu item={menu.item} x={menu.x} y={menu.y} starred={stars.has(`${menu.item.kind}:${menu.item.id}`)} mine={menu.item.owner_id===me.user_id} picked={sel.has(keyOf(menu.item))} onPick={()=>toggle(menu.item)}
   onOpen={()=>open(menu.item)} onRename={()=>setRenaming(menu.item)} onMove={()=>setMoving([menu.item])} onStar={()=>void toggleStar(menu.item)}
   onColor={c=>void recolor(menu.item,c)} onShare={()=>{const it=menu.item;if(it.drive!=='my'&&!(it.kind==='doc'&&it.owner_id===me.user_id))setAccessItem(it);else if(it.kind==='doc')setSharingDoc(it.id);else if(it.owner_id===me.user_id)setSharingItem(it);else setAccessItem(it);}} onTrash={()=>void trash(menu.item)} onRestore={()=>void trash(menu.item,true)} onDestroy={()=>void destroy([menu.item])} close={()=>setMenu(null)}/>}
  {bgMenu&&<div className="zn-menu zdr-ctx" style={{left:Math.min(bgMenu.x,window.innerWidth-240),top:Math.min(bgMenu.y,window.innerHeight-200)}} onClick={e=>e.stopPropagation()} role="menu">
   <button type="button" onClick={()=>{setBgMenu(null);setNaming(true);}}><FolderPlus size={15}/>New folder</button>
   <button type="button" onClick={()=>{setBgMenu(null);void newDoc();}}><FileText size={15}/>New doc</button>
   <button type="button" onClick={()=>{setBgMenu(null);void newDoc(true);}}><FileSpreadsheet size={15}/>New sheet</button>
   <button type="button" onClick={()=>{setBgMenu(null);pick.current?.click();}}><Upload size={15}/>Upload files</button>
   <button type="button" onClick={()=>{setBgMenu(null);pickDir.current?.click();}}><FolderUp size={15}/>Upload folder</button>
  </div>}
  {keysOpen&&<Modal title="Keyboard shortcuts" onClose={()=>setKeysOpen(false)}><div className="zn-modal-body"><dl className="zdr-keys">{([['/','Search'],['Shift + F','New folder'],['Shift + D','New doc'],['Shift + S','New sheet'],['U','Upload files'],['Ctrl/Cmd + A','Select everything here'],['Ctrl/Cmd + click','Pick several items'],['Enter','Open the picked item'],['F2','Rename the picked item'],['Delete','Move picked items to the trash'],['Esc','Clear the selection'],['?','Show this list']] as const).map(([k,d])=><div key={k}><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>)}</dl></div></Modal>}
  {naming&&<NameDialog title="New folder" initial="Untitled folder" confirm="Create" onClose={()=>setNaming(false)} onSave={n=>newFolder(n)}/>}
  {renaming&&<NameDialog title="Rename" initial={renaming.name} confirm="Rename" onClose={()=>setRenaming(null)} onSave={n=>rename(renaming,n)}/>}
  {moving&&<MoveDialog picked={moving} items={items??[]} clients={clients} guest={guest} onClose={()=>setMoving(null)} onMove={to=>moveAll(moving,to)}/>}
  {sharingDoc&&<ShareDoc docId={sharingDoc} onClose={()=>{setSharingDoc(null);void load();}}/>}
  {accessItem&&<AccessPanel item={accessItem} where={where(accessItem)} onClose={()=>setAccessItem(null)} onLimit={async()=>{const it=accessItem;setAccessItem(null);await move(it,{drive:'my',lead:null,folder:null});await load();setSharingItem({...it,drive:'my',lead_id:null,folder_id:null});}}/>}
  {sharingItem&&<ShareItem item={sharingItem} onClose={()=>{setSharingItem(null);void load();}}/>}
  {viewing&&viewing.kind==='file'&&(isImage(viewing.type)?<Modal title={viewing.name} wide onClose={()=>setViewing(null)}><div className="zdr-preview"><img src={`/api/zarn/files?f=${viewing.id}`} alt={viewing.name}/><a className="zn-btn" href={`/api/zarn/files?f=${viewing.id}&download=1`}><Download size={14}/>Download</a></div></Modal>
   :<DocViewer att={{name:viewing.name,type:viewing.type??''}} src={`/api/zarn/files?f=${viewing.id}`} dl={`/api/zarn/files?f=${viewing.id}&download=1`} onClose={()=>setViewing(null)}/>)}
 </div>;
}

function ItemMenu({item,x,y,starred,mine,picked,onPick,onOpen,onRename,onMove,onStar,onShare,onTrash,onRestore,onDestroy,onColor,close}:{item:Item;x:number;y:number;starred:boolean;mine:boolean;picked:boolean;onPick:()=>void;onColor:(c:string|null)=>void;onOpen:()=>void;onRename:()=>void;onMove:()=>void;onStar:()=>void;onShare:()=>void;onTrash:()=>void;onRestore:()=>void;onDestroy:()=>void;close:()=>void}){
 const ref=useRef<HTMLDivElement>(null),[pos,setPos]=useState({left:x,top:y});
 useEffect(()=>{const el=ref.current;if(!el)return;const w=el.offsetWidth,h=el.offsetHeight;setPos({left:Math.max(8,Math.min(x-w,window.innerWidth-w-8)),top:Math.max(8,Math.min(y,window.innerHeight-h-8))});},[x,y]);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[close]);
 const act=(f:()=>void)=>()=>{close();f();};
 // My Drive items are shared person by person; docs and sheets anywhere can also get a share link.
 const canShare=!item.trashed_at;
 return <div ref={ref} className="zn-menu zdr-ctx" style={pos} onClick={e=>e.stopPropagation()} role="menu">
  {item.trashed_at?<>
   <button type="button" onClick={act(onRestore)}><RotateCcw size={15}/>Restore</button>
   <button type="button" className="zdr-danger" onClick={act(onDestroy)}><Trash2 size={15}/>Delete forever</button>
  </>:<>
   <button type="button" onClick={act(onPick)}><CheckSquare size={15}/>{picked?'Unselect':'Select'}</button>
   <button type="button" onClick={act(onOpen)}>{item.kind==='folder'?<Folder size={15}/>:<FileText size={15}/>}Open</button>
   {item.kind==='file'&&<a href={`/api/zarn/files?f=${item.id}&download=1`} onClick={close}><Download size={15}/>Download</a>}
   <button type="button" onClick={act(onRename)}><Pencil size={15}/>Rename</button>
   {canShare&&<button type="button" onClick={act(onShare)}><Share2 size={15}/>Share</button>}
   <button type="button" onClick={act(onMove)}><FolderInput size={15}/>Move to…</button>
   {item.kind==='folder'&&<div className="zdr-colors" role="group" aria-label="Folder colour">{[null,'#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899'].map(c=><button key={c??'none'} type="button" aria-label={c?`Colour ${c}`:'Default colour'} className={(item.color??null)===c?'is-on':''} style={{background:c??'var(--z-muted)'}} onClick={act(()=>onColor(c))}/>)}</div>}
   <button type="button" onClick={act(onStar)}><Star size={15}/>{starred?'Remove from Starred':'Add to Starred'}</button>
   <button type="button" className="zdr-danger" onClick={act(onTrash)}><Trash2 size={15}/>Move to trash</button>
  </>}
 </div>;
}

function NameDialog({title,initial,confirm,onClose,onSave}:{title:string;initial:string;confirm:string;onClose:()=>void;onSave:(n:string)=>Promise<void>|void}){
 const [v,setV]=useState(initial),[busy,setBusy]=useState(false);
 const ref=useRef<HTMLInputElement>(null);
 useEffect(()=>{const el=ref.current;if(!el)return;el.focus();const dot=initial.lastIndexOf('.');el.setSelectionRange(0,dot>0?dot:initial.length);},[initial]);
 async function go(e:React.FormEvent){e.preventDefault();if(!v.trim()||busy)return;setBusy(true);await onSave(v);setBusy(false);}
 return <Modal title={title} onClose={onClose}><form className="zn-modal-body" onSubmit={e=>void go(e)}>
  <input ref={ref} className="zn-input" value={v} maxLength={200} onChange={e=>setV(e.target.value)} aria-label="Name"/>
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="submit" className="zn-btn is-primary" disabled={busy||!v.trim()}>{confirm}</button></div>
 </form></Modal>;
}

// Pick a destination: any drive's root, or any folder you can reach (never the item itself or a folder inside it).
function MoveDialog({picked,items,clients,guest,onClose,onMove}:{picked:Item[];items:Item[];clients:{lead:string;name:string}[];guest:boolean;onClose:()=>void;onMove:(to:Place)=>Promise<void>|void}){
 const {me}=useZarn();
 const [at,setAt]=useState<Place|null>(null),[sel,setSel]=useState<Place|null>(null),[busy,setBusy]=useState(false);
 const folders=items.filter(i=>i.kind==='folder'&&!i.trashed_at);
 const banned=useMemo(()=>{const s=new Set<string>(picked.filter(i=>i.kind==='folder').map(i=>i.id));if(!s.size)return s;let grew=true;while(grew){grew=false;for(const f of folders)if(f.folder_id&&s.has(f.folder_id)&&!s.has(f.id)){s.add(f.id);grew=true;}}return s;},[picked,folders]);
 const roots:{p:Place;label:string}[]=[{p:{drive:'my',lead:null,folder:null},label:'My Drive'},...(!guest?[{p:{drive:'team' as const,lead:null,folder:null},label:'Team drive'}]:[]),...clients.map(c=>({p:{drive:'client' as const,lead:c.lead,folder:null},label:c.name}))];
 const kids=at?folders.filter(f=>f.folder_id===at.folder&&f.drive===at.drive&&(at.drive!=='client'||f.lead_id===at.lead)&&(at.drive!=='my'||at.folder||f.owner_id===me.user_id)&&!banned.has(f.id)):[];
 const crumbs=useMemo(()=>{const t:Item[]=[];let f=at?.folder?folders.find(x=>x.id===at.folder):undefined,h=0;while(f&&h<50){t.unshift(f);f=f.folder_id?folders.find(x=>x.id===f!.folder_id):undefined;h++;}return t;},[at,folders]);
 const dest=sel??at;
 const label=(p:Place)=>p.folder?folders.find(f=>f.id===p.folder)?.name??'folder':roots.find(r=>r.p.drive===p.drive&&r.p.lead===p.lead)?.label??'Drive';
 return <Modal title={picked.length===1?`Move “${picked[0].name}”`:`Move ${picked.length} items`} onClose={onClose}><div className="zn-modal-body">
  <div className="zdr-move-crumbs">{at?<><button type="button" onClick={()=>{setAt(null);setSel(null);}}>All drives</button><ChevronRight size={14}/><button type="button" onClick={()=>{setAt({...at,folder:null});setSel(null);}}>{roots.find(r=>r.p.drive===at.drive&&r.p.lead===at.lead)?.label}</button>{crumbs.map(c=><span key={c.id}><ChevronRight size={14}/><button type="button" onClick={()=>{setAt({...at,folder:c.id});setSel(null);}}>{c.name}</button></span>)}</>:<b>All drives</b>}</div>
  <div className="zdr-move-list">
   {!at?roots.map(r=><button key={`${r.p.drive}:${r.p.lead}`} type="button" onClick={()=>{setAt(r.p);setSel(null);}}>{r.p.drive==='my'?<HardDrive size={16}/>:r.p.drive==='team'?<Users size={16}/>:<Briefcase size={16}/>}<span>{r.label}</span><ChevronRight size={15}/></button>)
   :kids.length?kids.map(f=><button key={f.id} type="button" className={sel?.folder===f.id?'is-on':''} onClick={()=>setSel({drive:f.drive,lead:f.lead_id,folder:f.id})} onDoubleClick={()=>{setAt({drive:f.drive,lead:f.lead_id,folder:f.id});setSel(null);}}><Folder size={16}/><span>{f.name}</span><ChevronRight size={15} onClick={e=>{e.stopPropagation();setAt({drive:f.drive,lead:f.lead_id,folder:f.id});setSel(null);}}/></button>)
   :<p className="zdr-faint">No folders here.</p>}
  </div>
  {picked.some(i=>i.drive==='my')&&dest&&dest.drive!=='my'&&<p className="zn-upload-note">Everyone with access to {dest.drive==='team'?'the team drive':'this client drive'} will be able to open and edit it.</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Cancel</button><button type="button" className="zn-btn is-primary" disabled={!dest||busy} onClick={async()=>{if(!dest)return;setBusy(true);await onMove(dest);setBusy(false);}}>{dest?`Move to ${label(dest)}`:'Pick a place'}</button></div>
 </div></Modal>;
}

// Who can open a file or folder in My Drive, with a way to add people and stop sharing. Folders also have view/edit.
function ShareItem({item,onClose}:{item:Item;onClose:()=>void}){
 const {db,people}=useZarn();
 const folder=item.kind==='folder';
 const [rows,setRows]=useState<{user_id:string;role:'view'|'edit'}[]|null>(null),[adding,setAdding]=useState(false),[err,setErr]=useState('');
 const load=useCallback(async()=>{
  const {data}=folder?await db.from('zarn_drive_folder_members').select('user_id,role').eq('folder_id',item.id):await db.from('zarn_file_shares').select('user_id').eq('file_id',item.id);
  setRows(((data??[]) as {user_id:string;role?:'view'|'edit'}[]).map(r=>({user_id:r.user_id,role:r.role??'view'})));
 },[db,folder,item.id]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves, not synchronously
 useEffect(()=>{void load();},[load]);
 async function remove(u:string){setErr('');const {error}=folder?await db.from('zarn_drive_folder_members').delete().eq('folder_id',item.id).eq('user_id',u):await db.from('zarn_file_shares').delete().eq('file_id',item.id).eq('user_id',u);if(error)setErr('Could not remove them.');void load();}
 async function setRole(u:string,role:string){setErr('');const {error}=await db.from('zarn_drive_folder_members').update({role}).eq('folder_id',item.id).eq('user_id',u);if(error)setErr('Could not change access.');void load();}
 if(adding)return <PeoplePicker title={`Share “${item.name}”`} confirm="Share" exclude={(rows??[]).map(r=>r.user_id)} onClose={()=>setAdding(false)} onPick={async ids=>{
  const {error}=folder?await db.from('zarn_drive_folder_members').insert(ids.map(u=>({folder_id:item.id,user_id:u,role:'edit'}))):await db.from('zarn_file_shares').insert(ids.map(u=>({file_id:item.id,user_id:u})));
  if(error)throw new Error('Could not share it.');setAdding(false);void load();}}/>;
 return <Modal title={`Share “${item.name}”`} onClose={onClose}><div className="zn-modal-body">
  <p className="zn-upload-note">{folder?'People you add can open everything inside this folder. Editors can also add, rename and move things in it.':'People you add can open and download this file.'}</p>
  <div className="zdr-people">{rows===null?<p className="zn-loading">Loading…</p>:rows.length?rows.map(r=><div key={r.user_id} className="zdr-person"><Avatar m={people[r.user_id]} size={28}/><b>{people[r.user_id]?.display_name??'Someone'}</b>
   {folder&&<select className="zdr-sort" value={r.role} aria-label="Access" onChange={e=>void setRole(r.user_id,e.target.value)}><option value="view">Can view</option><option value="edit">Can edit</option></select>}
   <button type="button" className="zn-btn" onClick={()=>void remove(r.user_id)}>Remove</button></div>):<p className="zdr-faint">Only you have access.</p>}</div>
  {err&&<p className="zn-error" role="alert">{err}</p>}
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Done</button><button type="button" className="zn-btn is-primary" onClick={()=>setAdding(true)}><Users size={14}/>Add people</button></div>
 </div></Modal>;
}

// Who can open something in the team drive or a client drive. Owners can pull it into My Drive to share with chosen people only.
function AccessPanel({item,where,onClose,onLimit}:{item:Item;where:string;onClose:()=>void;onLimit:()=>void}){
 const {members,me,channels}=useZarn();
 const lead=item.drive==='client'?channels.find(c=>c.kind==='client'&&c.lead_id===item.lead_id):undefined;
 const team=members.filter(m=>!m.deactivated_at&&m.joined_at&&m.account_type==='member');
 const mine=item.owner_id===me.user_id;
 return <Modal title={`Share “${item.name}”`} onClose={onClose}><div className="zn-modal-body">
  <div className="zdr-access-card"><Users size={18}/><div><b>{item.drive==='team'?'Everyone on the team':`Everyone in ${where}`}</b><small>{item.drive==='team'?`${team.length} people can open and edit this, because it’s in the team drive.`:`People in this client’s space can open and edit this${lead?'':''}.`}</small></div></div>
  {item.drive==='team'&&<div className="zdr-people zdr-people-row">{team.slice(0,12).map(m=><span key={m.user_id} title={m.display_name}><Avatar m={m} size={30}/></span>)}{team.length>12&&<em>+{team.length-12}</em>}</div>}
  <p className="zn-upload-note">{mine?`To share with specific people only, move it to your My Drive and choose who gets it. Everyone else on the ${item.drive==='team'?'team':'client space'} will lose access.`:'Only the person who added this can limit who sees it.'}</p>
  <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={onClose}>Done</button>{mine&&<button type="button" className="zn-btn is-primary" onClick={onLimit}>Limit to specific people</button>}</div>
 </div></Modal>;
}
