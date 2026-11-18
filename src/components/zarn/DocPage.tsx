'use client';
/* eslint-disable react-hooks/refs -- menu and toolbar actions read the editor and file-picker refs only when clicked, never while rendering */
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEditor,EditorContent,type Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import LinkExt from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {ImagePlus,Bold,Check,ChevronLeft,ChevronRight,Code2,Heading1,Heading2,Italic,Link2,List,ListOrdered,ListChecks,Loader2,Quote,Redo2,Share2,Strikethrough,Underline as UnderlineIcon,Undo2,AlignLeft,AlignCenter,AlignRight,AlignJustify,Baseline,Highlighter,IndentIncrease,IndentDecrease,RemoveFormatting,Printer,Minus,Plus,Table2,Lock,FileText,PanelLeft,CloudOff,Type,X} from 'lucide-react';
import {Extension} from '@tiptap/core';
import TextAlign from '@tiptap/extension-text-align';
import {TextStyleKit} from '@tiptap/extension-text-style';
import {TaskList,TaskItem} from '@tiptap/extension-list';
import {TableKit} from '@tiptap/extension-table';
import {useZarn} from './ZarnProvider';
import {useConfirm} from './ConfirmProvider';
import ShareDoc from './ShareDoc';
import {Avatar} from './format';
import Collaboration from '@tiptap/extension-collaboration';
import {DocSync} from './doc-sync';
import {usePictureClick} from './ImageLightbox';
import Image from '@tiptap/extension-image';
import {imageTools} from './editor-images';
type Doc={id:string;title:string;content:string;owner_id:string;updated_at:string;drive:'my'|'team'|'client';folder_id:string|null;lead_id:string|null};
type Role='owner'|'edit'|'view';
// Opens a document: owners and editors can type, everyone else reads. Changes save by themselves.
export default function DocPage({id}:{id:string}){
 const {db,me}=useZarn(),router=useRouter();
 const [doc,setDoc]=useState<Doc|null|undefined>(undefined),[role,setRole]=useState<Role|null>(null);
 useEffect(()=>{
  let live=true;
  void (async()=>{
   const [{data},{data:r}]=await Promise.all([db.from('zarn_docs').select('id,title,content,owner_id,updated_at,drive,folder_id,lead_id,kind').eq('id',id).maybeSingle(),db.rpc('zarn_doc_role',{d:id})]);
   if(!live)return;
   if((data as {kind?:string}|null)?.kind==='sheet'){router.replace(`/zarn/sheets/${id}`);return;}
   if(data)void db.from('zarn_drive_opens').upsert({user_id:me.user_id,kind:'doc',item_id:id,opened_at:new Date().toISOString()});setDoc((data as Doc|null)??null);setRole((r as Role|null)??null);
  })();
  return()=>{live=false;};
 },[db,id,me.user_id,router]);
 if(doc===undefined)return <div className="zn-page"><p className="zn-loading">Loading…</p></div>;
 if(!doc||!role)return <div className="zn-page"><div className="zn-empty-state"><h2>Document not found</h2><p>It may have been deleted, or it isn’t shared with you.</p><Link className="zn-btn" href="/zarn/drive">Back to Drive</Link></div></div>;
 return <Collab doc={doc} role={role} meId={me.user_id}/>;
}
// Opens the live copy of the document (everyone's edits merged) before showing the editor.
function Collab({doc,role,meId}:{doc:Doc;role:Role;meId:string}){
 const {db}=useZarn();
 const [ready,setReady]=useState<{sync:DocSync|null}|null>(null);
 useEffect(()=>{
  const s=new DocSync(db,doc.id,role!=='view');let live=true;
  s.start(doc.content).then(mode=>{if(live)setReady({sync:mode==='collab'?s:null});}).catch(()=>{if(live)setReady({sync:null});});
  return()=>{live=false;void s.destroy();};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[db,doc.id,role]);
 if(!ready)return <div className="zn-page"><p className="zn-loading">Opening…</p></div>;
 return <Editing doc={doc} role={role} meId={meId} sync={ready.sync}/>;
}
// Paragraph-level line spacing and indent, kept as plain styles so shared links and downloads keep them.
const DocAttrs=Extension.create({name:'docAttrs',addGlobalAttributes(){return [{types:['paragraph','heading'],attributes:{
 lineHeight:{default:null,parseHTML:el=>(el as HTMLElement).style.lineHeight||null,renderHTML:a=>a.lineHeight?{style:`line-height:${a.lineHeight}`}:{}},
 indent:{default:0,parseHTML:el=>Math.round((parseInt((el as HTMLElement).style.marginLeft)||0)/36),renderHTML:a=>a.indent?{style:`margin-left:${a.indent*36}px`}:{}},
}}];}});
const FONTS=['Inter','Arial','Georgia','Times New Roman','Courier New','Verdana','Trebuchet MS'];
const SIZES=[8,9,10,11,12,14,16,18,20,24,28,32,36,48,60,72];
const COLORS=['#000000','#434343','#666666','#999999','#cccccc','#ffffff','#e11d48','#f97316','#f59e0b','#16a34a','#0ea5e9','#2563eb','#7c3aed','#db2777','#7f1d1d','#7c2d12','#78350f','#14532d','#0c4a6e','#1e3a8a','#4c1d95','#fecaca','#fed7aa','#fde68a','#bbf7d0','#bae6fd','#bfdbfe','#ddd6fe','#fbcfe8'];
type MenuItem={label:string;run:()=>void;keys?:string;on?:boolean;off?:boolean}|'-';
function Editing({doc,role,meId,sync}:{doc:Doc;role:Role;meId:string;sync:DocSync|null}){
 const {db,people,me,channels,title:chTitle}=useZarn(),router=useRouter(),confirm=useConfirm(),pics=usePictureClick();
 // Where this doc lives in Drive: its drive, then each folder above it. Every step links back.
 const [crumbs,setCrumbs]=useState<{name:string;href:string}[]>([]);
 useEffect(()=>{
  let live=true;
  void (async()=>{
   const client=channels.find(c=>c.kind==='client'&&c.lead_id===doc.lead_id);
   const root=doc.drive==='team'?{name:'Team drive',href:'/zarn/drive?v=team'}:doc.drive==='client'?{name:client?chTitle(client):'Client drive',href:`/zarn/drive?v=client&l=${doc.lead_id}`}
    :doc.owner_id===me.user_id?{name:'My Drive',href:'/zarn/drive?v=my'}:{name:'Shared with me',href:'/zarn/drive?v=shared'};
   const trail:{name:string;href:string}[]=[];let f=doc.folder_id,hops=0;
   while(f&&hops<20){const {data}=await db.from('zarn_drive_folders').select('id,name,parent_id').eq('id',f).maybeSingle();if(!data)break;trail.unshift({name:data.name as string,href:`/zarn/drive?f=${data.id}`});f=data.parent_id as string|null;hops++;}
   if(live)setCrumbs([root,...trail]);
  })();
  return()=>{live=false;};
 },[db,doc.drive,doc.folder_id,doc.lead_id,doc.owner_id,me.user_id,channels,chTitle]);
 // Who else has this document open right now.
 const [here,setHere]=useState<string[]>([]);
 useEffect(()=>{
  const ch=db.channel(`zarn-docpresence-${doc.id}`,{config:{presence:{key:meId}}});
  ch.on('presence',{event:'sync'},()=>setHere(Object.keys(ch.presenceState()).filter(u=>u!==meId))).subscribe(async(s:string)=>{if(s==='SUBSCRIBED')await ch.track({at:Date.now()});});
  return()=>{void db.removeChannel(ch);};
 },[db,doc.id,meId]);
 const canEdit=role==='owner'||role==='edit';
 const [title,setTitle]=useState(doc.title),[state,setState]=useState<'saved'|'saving'|'error'>('saved'),[sharing,setSharing]=useState(false),[linkOpen,setLinkOpen]=useState(false),[url,setUrl]=useState('');
 const [menu,setMenu]=useState<string|null>(null),[pop,setPop]=useState<'color'|'hl'|null>(null),[zoom,setZoom]=useState(100),[outline,setOutline]=useState(()=>{try{return localStorage.getItem('zarn-doc-outline')==='1';}catch{return false;}}),[counting,setCounting]=useState(false),[sheet,setSheet]=useState<null|'text'|'para'|'insert'>(null);
 const editorRef=useRef<Editor|null>(null),fileRef=useRef<HTMLInputElement>(null);
 const [img,setImg]=useState({busy:false,error:''});
 const tools=imageTools('doc',doc.id,()=>editorRef.current,setImg);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),latest=useRef({title:doc.title,content:doc.content});
 const save=useCallback(async()=>{
  setState('saving');
  const {error}=await db.from('zarn_docs').update({title:latest.current.title.trim()||'Untitled',content:latest.current.content,updated_by:meId}).eq('id',doc.id);
  setState(error?'error':'saved');
 },[db,doc.id,meId]);
 const queue=useCallback(()=>{setState('saving');if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void save(),1200);},[save]);
 const editor=useEditor({
  immediatelyRender:false,shouldRerenderOnTransaction:true,editable:canEdit,...(sync?{}:{content:doc.content}),
  extensions:[StarterKit.configure({link:false,underline:false,...(sync?{undoRedo:false}:{})}),...(sync?[Collaboration.configure({document:sync.ydoc,field:'default'})]:[]),Underline,Image,LinkExt.configure({openOnClick:false}),Placeholder.configure({placeholder:canEdit?'Start typing…':''}),
   TextStyleKit,TextAlign.configure({types:['heading','paragraph']}),TaskList,TaskItem.configure({nested:true}),TableKit.configure({table:{resizable:true}}),DocAttrs],
  editorProps:{attributes:{class:'zd-prose zg-prose','aria-label':'Document'},...tools.handlers},
  onCreate:({editor:e})=>{editorRef.current=e;},
  onUpdate:({editor:e})=>{latest.current.content=e.getHTML();queue();},
 });
 // Save anything pending when leaving the page.
 useEffect(()=>()=>{if(timer.current){clearTimeout(timer.current);void save();}},[save]);
 async function remove(){
  if(!await confirm({title:'Move this document to the trash?',message:`“${title||'Untitled'}” goes to the Drive trash. You can restore it from there.`,confirm:'Move to trash',danger:true}))return;
  await db.from('zarn_docs').update({trashed_at:new Date().toISOString()}).eq('id',doc.id);router.push(crumbs.at(-1)?.href??'/zarn/drive');
 }
 // A new doc (blank or a copy) lands in the same drive and folder as this one.
 async function create(copy:boolean){
  const id=crypto.randomUUID();
  const {error}=await db.from('zarn_docs').insert({id,owner_id:me.user_id,title:copy?`Copy of ${title||'Untitled'}`:'Untitled',content:copy?(editor?.getHTML()??''):'',folder_id:doc.folder_id,...(doc.folder_id?{}:{drive:doc.drive==='my'?'my':doc.drive,...(doc.drive==='client'?{lead_id:doc.lead_id}:{})})});
  if(!error)router.push(`/zarn/docs/${id}`);
 }
 function download(kind:'html'|'txt'|'doc'){
  if(!editor)return;const name=(title||'Untitled').replace(/[\\/:*?"<>|]+/g,' ').trim()||'Untitled';
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${name}</title></head><body>${editor.getHTML()}</body></html>`;
  const blob=kind==='txt'?new Blob([editor.getText({blockSeparator:'\n\n'})],{type:'text/plain'}):new Blob([html],{type:kind==='doc'?'application/msword':'text/html'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${name}.${kind}`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
 }
 const ed=editor;
 const c=()=>ed!.chain().focus();
 const headings:{level:number;text:string;pos:number}[]=[];
 ed?.state.doc.descendants((n,pos)=>{if(n.type.name==='heading'&&n.textContent.trim())headings.push({level:n.attrs.level as number,text:n.textContent,pos});});
 const words=ed?(ed.getText().trim().match(/\S+/g)?.length??0):0;
 const jump=(pos:number)=>{if(!ed)return;ed.chain().focus().setTextSelection(pos+1).run();const at=ed.view.domAtPos(pos+1).node as HTMLElement;(at.nodeType===1?at:at.parentElement)?.scrollIntoView({block:'center',behavior:'smooth'});};
 const toggleOutline=()=>setOutline(o=>{try{localStorage.setItem('zarn-doc-outline',o?'0':'1');}catch{}return !o;});
 const insertTable=()=>c().insertTable({rows:3,cols:3,withHeaderRow:true}).run();
 const menus:[string,MenuItem[]][]=ed?[
  ['File',[...(canEdit?[{label:'New document',run:()=>void create(false)},{label:'Make a copy',run:()=>void create(true)},'-' as const]:[]),...(role==='owner'?[{label:'Share',run:()=>setSharing(true)}]:[]),
   {label:'Download as Word (.doc)',run:()=>download('doc')},{label:'Download as web page (.html)',run:()=>download('html')},{label:'Download as plain text (.txt)',run:()=>download('txt')},
   {label:'Print or save as PDF',keys:'⌘P',run:()=>window.print()},...(role==='owner'?['-' as const,{label:'Move to trash',run:()=>void remove()}]:[])]],
  ['Edit',[{label:'Undo',keys:'⌘Z',run:()=>c().undo().run(),off:!canEdit},{label:'Redo',keys:'⌘⇧Z',run:()=>c().redo().run(),off:!canEdit},'-',{label:'Select all',keys:'⌘A',run:()=>c().selectAll().run()}]],
  ['View',[{label:'Show outline',on:outline,run:toggleOutline},'-',...[75,100,125,150].map(z=>({label:`Zoom ${z}%`,on:zoom===z,run:()=>setZoom(z)}))]],
  ...(canEdit?[['Insert',[{label:'Image',run:()=>fileRef.current?.click()},{label:'Table (3 × 3)',run:insertTable},{label:'Link',keys:'⌘K',run:()=>{setUrl(ed.getAttributes('link').href??'');setLinkOpen(true);}},'-',
   {label:'Horizontal line',run:()=>c().setHorizontalRule().run()},{label:'Checklist',run:()=>c().toggleTaskList().run()},{label:'Today’s date',run:()=>c().insertContent(new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})).run()}]] as [string,MenuItem[]],
   ['Format',[{label:'Bold',keys:'⌘B',on:ed.isActive('bold'),run:()=>c().toggleBold().run()},{label:'Italic',keys:'⌘I',on:ed.isActive('italic'),run:()=>c().toggleItalic().run()},{label:'Underline',keys:'⌘U',on:ed.isActive('underline'),run:()=>c().toggleUnderline().run()},{label:'Strikethrough',on:ed.isActive('strike'),run:()=>c().toggleStrike().run()},'-',
   {label:'Normal text',run:()=>c().setParagraph().run()},{label:'Heading 1',run:()=>c().toggleHeading({level:1}).run()},{label:'Heading 2',run:()=>c().toggleHeading({level:2}).run()},{label:'Heading 3',run:()=>c().toggleHeading({level:3}).run()},'-',
   {label:'Quote',on:ed.isActive('blockquote'),run:()=>c().toggleBlockquote().run()},{label:'Code block',on:ed.isActive('codeBlock'),run:()=>c().toggleCodeBlock().run()},'-',{label:'Clear formatting',keys:'⌘\\',run:()=>c().unsetAllMarks().clearNodes().run()}]] as [string,MenuItem[]]]:[]),
  ['Tools',[{label:'Word count',run:()=>setCounting(true)}]],
 ]:[];
 const style=!ed?'p':ed.isActive('heading',{level:1})?'h1':ed.isActive('heading',{level:2})?'h2':ed.isActive('heading',{level:3})?'h3':'p';
 const ts=ed?.getAttributes('textStyle')??{};
 const font=(ts.fontFamily as string|undefined)?.replace(/["']/g,'').split(',')[0]??'Inter';
 const size=parseInt(ts.fontSize as string)||11;
 const setSize=(n:number)=>{const v=Math.max(6,Math.min(96,n));c().setFontSize(`${v}pt`).run();};
 const lh=(ed?.getAttributes(ed.isActive('heading')?'heading':'paragraph').lineHeight as string|null)??'';
 const setLh=(v:string)=>c().updateAttributes('paragraph',{lineHeight:v||null}).updateAttributes('heading',{lineHeight:v||null}).run();
 const indent=(d:number)=>{if(!ed)return;if(ed.isActive('listItem')||ed.isActive('taskItem')){const t=ed.isActive('taskItem')?'taskItem':'listItem';if(d>0)c().sinkListItem(t).run();else c().liftListItem(t).run();return;}
  const t=ed.isActive('heading')?'heading':'paragraph';const cur=(ed.getAttributes(t).indent as number)??0;c().updateAttributes(t,{indent:Math.max(0,Math.min(8,cur+d))}).run();};
 const btn=(label:string,icon:React.ReactNode,active:boolean,run:()=>void,keys?:string)=><button key={label} type="button" className={active?'is-on':''} aria-label={label} aria-pressed={active} data-tip={keys?`${label} (${keys})`:label} onMouseDown={e=>e.preventDefault()} onClick={run}>{icon}</button>;
 function applyLink(){if(!ed)return;const href=url.trim();if(!href)c().unsetLink().run();else{const safe=/^(https?:|mailto:)/i.test(href)?href:`https://${href}`;c().extendMarkRange('link').setLink({href:safe}).run();}setLinkOpen(false);setUrl('');}
 return <div className="zn-page zg" onClick={()=>{setMenu(null);setPop(null);}}>
  <header className="zg-head">
   <Link href={crumbs.at(-1)?.href??'/zarn/drive'} className="zg-logo" aria-label="Back to Drive" data-tip="Back to Drive"><FileText size={22}/></Link>
   <Link href={crumbs.at(-1)?.href??'/zarn/drive'} className="zg-back" aria-label="Back"><ChevronLeft size={22}/></Link>
   <div className="zg-meta">
    <div className="zg-row">
     <input className="zg-title" value={title} readOnly={!canEdit} maxLength={200} placeholder="Untitled document" aria-label="Title" size={Math.max(8,Math.min(48,(title||'Untitled document').length+1))} onChange={e=>{setTitle(e.target.value);latest.current.title=e.target.value;queue();}}/>
     <nav className="zg-where" aria-label="Location">{crumbs.map((x,i)=><span key={x.href}>{i>0&&<ChevronRight size={12}/>}<Link href={x.href}>{x.name}</Link></span>)}</nav>
     <span className={`zg-state${state==='error'?' is-error':''}`} data-tip={!canEdit?'You can view this document':state==='saving'?'Saving…':state==='error'?'Not saved yet. Keep typing to retry.':'All changes saved'}>{!canEdit?<><Lock size={13}/>View only</>:state==='saving'?<Loader2 size={14} className="zn-spin"/>:state==='error'?<CloudOff size={15}/>:<Check size={15}/>}</span>
    </div>
    <nav className="zg-menus" onClick={e=>e.stopPropagation()}>{menus.map(([name,items])=><div key={name} className="zg-menu">
     <button type="button" className={menu===name?'is-on':''} onClick={()=>setMenu(m=>m===name?null:name)} onMouseEnter={()=>{if(menu&&menu!==name)setMenu(name);}}>{name}</button>
     {menu===name&&<div className="zn-menu zg-drop" role="menu">{items.map((it,i)=>it==='-'?<hr key={i}/>:<button key={it.label} type="button" role="menuitem" disabled={it.off} onClick={()=>{setMenu(null);it.run();}}><span className="zg-tick">{it.on&&<Check size={14}/>}</span><span>{it.label}</span>{it.keys&&<kbd>{it.keys}</kbd>}</button>)}</div>}
    </div>)}</nav>
   </div>
   <div className="zg-right">
    {here.length>0&&<span className="zd-here" title={here.map(u=>people[u]?.display_name??'Someone').join(', ')+' also has this open'}>{here.slice(0,4).map(u=><Avatar key={u} m={people[u]} size={28}/>)}{here.length>4&&<em>+{here.length-4}</em>}</span>}
    {role==='owner'&&<button type="button" className="zg-share" onClick={()=>setSharing(true)}><Share2 size={15}/><span>Share</span></button>}
   </div>
  </header>
  {canEdit&&ed&&<div className="zg-bar" role="toolbar" aria-label="Formatting" onClick={e=>e.stopPropagation()}>
   {btn('Undo',<Undo2 size={17}/>,false,()=>c().undo().run(),'⌘Z')}{btn('Redo',<Redo2 size={17}/>,false,()=>c().redo().run(),'⌘⇧Z')}{btn('Print',<Printer size={17}/>,false,()=>window.print(),'⌘P')}
   <select className="zg-sel is-zoom" aria-label="Zoom" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[50,75,90,100,125,150,200].map(z=><option key={z} value={z}>{z}%</option>)}</select>
   <i/>
   <select className="zg-sel is-style" aria-label="Text style" value={style} onChange={e=>{const v=e.target.value;if(v==='p')c().setParagraph().run();else c().setHeading({level:Number(v[1]) as 1|2|3}).run();}}><option value="p">Normal text</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option></select>
   <i/>
   <select className="zg-sel is-font" aria-label="Font" value={FONTS.includes(font)?font:'Inter'} onChange={e=>c().setFontFamily(e.target.value).run()} style={{fontFamily:font}}>{FONTS.map(f=><option key={f} value={f} style={{fontFamily:f}}>{f}</option>)}</select>
   <i/>
   <span className="zg-size">{btn('Smaller text',<Minus size={15}/>,false,()=>setSize(SIZES.slice().reverse().find(x=>x<size)??size-1))}
    <select aria-label="Font size" value={SIZES.includes(size)?size:''} onChange={e=>setSize(Number(e.target.value))}>{!SIZES.includes(size)&&<option value="">{size}</option>}{SIZES.map(x=><option key={x} value={x}>{x}</option>)}</select>
    {btn('Bigger text',<Plus size={15}/>,false,()=>setSize(SIZES.find(x=>x>size)??size+1))}</span>
   <i/>
   {btn('Bold',<Bold size={17}/>,ed.isActive('bold'),()=>c().toggleBold().run(),'⌘B')}{btn('Italic',<Italic size={17}/>,ed.isActive('italic'),()=>c().toggleItalic().run(),'⌘I')}{btn('Underline',<UnderlineIcon size={17}/>,ed.isActive('underline'),()=>c().toggleUnderline().run(),'⌘U')}
   <span className="zg-pop-wrap">{btn('Text colour',<span className="zg-swatch"><Baseline size={17}/><b style={{background:(ts.color as string)||'currentColor'}}/></span>,pop==='color',()=>setPop(p=>p==='color'?null:'color'))}
    {pop==='color'&&<Palette onPick={v=>{if(v)c().setColor(v).run();else c().unsetColor().run();setPop(null);}}/>}</span>
   <span className="zg-pop-wrap">{btn('Highlight colour',<span className="zg-swatch"><Highlighter size={16}/><b style={{background:(ts.backgroundColor as string)||'transparent'}}/></span>,pop==='hl',()=>setPop(p=>p==='hl'?null:'hl'))}
    {pop==='hl'&&<Palette onPick={v=>{if(v)c().setBackgroundColor(v).run();else c().unsetBackgroundColor().run();setPop(null);}} none="No highlight"/>}</span>
   <i/>
   {btn('Insert link',<Link2 size={17}/>,ed.isActive('link'),()=>{setUrl(ed.getAttributes('link').href??'');setLinkOpen(o=>!o);},'⌘K')}{btn('Insert image',<ImagePlus size={17}/>,false,()=>fileRef.current?.click())}{btn('Insert table',<Table2 size={17}/>,ed.isActive('table'),insertTable)}
   <i/>
   {btn('Left align',<AlignLeft size={17}/>,ed.isActive({textAlign:'left'}),()=>c().setTextAlign('left').run())}{btn('Centre align',<AlignCenter size={17}/>,ed.isActive({textAlign:'center'}),()=>c().setTextAlign('center').run())}{btn('Right align',<AlignRight size={17}/>,ed.isActive({textAlign:'right'}),()=>c().setTextAlign('right').run())}{btn('Justify',<AlignJustify size={17}/>,ed.isActive({textAlign:'justify'}),()=>c().setTextAlign('justify').run())}
   <select className="zg-sel is-lh" aria-label="Line spacing" data-tip="Line spacing" value={lh} onChange={e=>setLh(e.target.value)}><option value="">Spacing</option><option value="1">Single</option><option value="1.15">1.15</option><option value="1.5">1.5</option><option value="2">Double</option></select>
   <i/>
   {btn('Checklist',<ListChecks size={17}/>,ed.isActive('taskList'),()=>c().toggleTaskList().run())}{btn('Bulleted list',<List size={17}/>,ed.isActive('bulletList'),()=>c().toggleBulletList().run())}{btn('Numbered list',<ListOrdered size={17}/>,ed.isActive('orderedList'),()=>c().toggleOrderedList().run())}
   {btn('Decrease indent',<IndentDecrease size={17}/>,false,()=>indent(-1))}{btn('Increase indent',<IndentIncrease size={17}/>,false,()=>indent(1))}
   {btn('Clear formatting',<RemoveFormatting size={17}/>,false,()=>c().unsetAllMarks().run(),'⌘\\')}
   {ed.isActive('table')&&<span className="zg-table-tools"><i/>
    <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>c().addRowAfter().run()}>+ Row</button><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>c().addColumnAfter().run()}>+ Column</button>
    <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>c().deleteRow().run()}>− Row</button><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>c().deleteColumn().run()}>− Column</button>
    <button type="button" className="is-danger" onMouseDown={e=>e.preventDefault()} onClick={()=>c().deleteTable().run()}>Delete table</button></span>}
   {linkOpen&&<form className="zd-link" onSubmit={e=>{e.preventDefault();applyLink();}}><input autoFocus value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste a link (leave empty to remove)" aria-label="Link address"/><button className="zn-btn is-primary">Apply</button></form>}
  </div>}
  {canEdit&&ed&&<div className="zg-mbar" role="toolbar" aria-label="Quick formatting" onClick={e=>e.stopPropagation()}>
   {btn('Undo',<Undo2 size={19}/>,false,()=>c().undo().run())}{btn('Redo',<Redo2 size={19}/>,false,()=>c().redo().run())}<i/>
   {btn('Bold',<Bold size={19}/>,ed.isActive('bold'),()=>c().toggleBold().run())}{btn('Italic',<Italic size={19}/>,ed.isActive('italic'),()=>c().toggleItalic().run())}{btn('Underline',<UnderlineIcon size={19}/>,ed.isActive('underline'),()=>c().toggleUnderline().run())}
   {btn('Bulleted list',<List size={19}/>,ed.isActive('bulletList'),()=>c().toggleBulletList().run())}{btn('Checklist',<ListChecks size={19}/>,ed.isActive('taskList'),()=>c().toggleTaskList().run())}<i/>
   {btn('More formatting',<Type size={19}/>,!!sheet,()=>setSheet(v=>v?null:'text'))}
  </div>}
  {canEdit&&ed&&sheet&&<div className="zg-sheet" role="dialog" aria-label="Formatting" onClick={e=>e.stopPropagation()} onMouseDown={e=>{if((e.target as HTMLElement).tagName!=='SELECT')e.preventDefault();}}>
   <header><nav>{([['text','Text'],['para','Paragraph'],['insert','Insert']] as const).map(([k,l])=><button key={k} type="button" className={sheet===k?'is-on':''} onClick={()=>setSheet(k)}>{l}</button>)}</nav><button type="button" className="zg-sheet-x" aria-label="Close" onClick={()=>setSheet(null)}><X size={18}/></button></header>
   {sheet==='text'&&<div className="zg-sheet-body">
    <div className="zg-chips">{([['p','Normal'],['h1','Heading 1'],['h2','Heading 2'],['h3','Heading 3']] as const).map(([k,l])=><button key={k} type="button" className={style===k?'is-on':''} onClick={()=>{if(k==='p')c().setParagraph().run();else c().setHeading({level:Number(k[1]) as 1|2|3}).run();}}>{l}</button>)}</div>
    <div className="zg-seg">{btn('Bold',<Bold size={19}/>,ed.isActive('bold'),()=>c().toggleBold().run())}{btn('Italic',<Italic size={19}/>,ed.isActive('italic'),()=>c().toggleItalic().run())}{btn('Underline',<UnderlineIcon size={19}/>,ed.isActive('underline'),()=>c().toggleUnderline().run())}{btn('Strikethrough',<Strikethrough size={19}/>,ed.isActive('strike'),()=>c().toggleStrike().run())}</div>
    <div className="zg-row2"><select className="zg-msel" aria-label="Font" value={FONTS.includes(font)?font:'Inter'} onChange={e=>c().setFontFamily(e.target.value).run()} style={{fontFamily:font}}>{FONTS.map(f=><option key={f} value={f}>{f}</option>)}</select>
     <div className="zg-seg is-size">{btn('Smaller text',<Minus size={17}/>,false,()=>setSize(SIZES.slice().reverse().find(x=>x<size)??size-1))}<b>{size}</b>{btn('Bigger text',<Plus size={17}/>,false,()=>setSize(SIZES.find(x=>x>size)??size+1))}</div></div>
    <p className="zg-lbl">Text colour</p><div className="zg-dots"><button type="button" className="zg-dot-none" aria-label="Default colour" onClick={()=>c().unsetColor().run()}>A</button>{COLORS.slice(0,18).map(x=><button key={x} type="button" aria-label={x} style={{background:x}} className={ts.color===x?'is-on':''} onClick={()=>c().setColor(x).run()}/>)}</div>
    <p className="zg-lbl">Highlight</p><div className="zg-dots"><button type="button" className="zg-dot-none" aria-label="No highlight" onClick={()=>c().unsetBackgroundColor().run()}>∅</button>{COLORS.slice(21).concat(['#fef08a','#e5e7eb']).map(x=><button key={x} type="button" aria-label={x} style={{background:x}} className={ts.backgroundColor===x?'is-on':''} onClick={()=>c().setBackgroundColor(x).run()}/>)}</div>
    <button type="button" className="zg-wide" onClick={()=>c().unsetAllMarks().run()}><RemoveFormatting size={17}/>Clear formatting</button>
   </div>}
   {sheet==='para'&&<div className="zg-sheet-body">
    <div className="zg-seg">{btn('Left align',<AlignLeft size={19}/>,ed.isActive({textAlign:'left'}),()=>c().setTextAlign('left').run())}{btn('Centre align',<AlignCenter size={19}/>,ed.isActive({textAlign:'center'}),()=>c().setTextAlign('center').run())}{btn('Right align',<AlignRight size={19}/>,ed.isActive({textAlign:'right'}),()=>c().setTextAlign('right').run())}{btn('Justify',<AlignJustify size={19}/>,ed.isActive({textAlign:'justify'}),()=>c().setTextAlign('justify').run())}</div>
    <div className="zg-seg">{btn('Bulleted list',<List size={19}/>,ed.isActive('bulletList'),()=>c().toggleBulletList().run())}{btn('Numbered list',<ListOrdered size={19}/>,ed.isActive('orderedList'),()=>c().toggleOrderedList().run())}{btn('Checklist',<ListChecks size={19}/>,ed.isActive('taskList'),()=>c().toggleTaskList().run())}</div>
    <div className="zg-seg">{btn('Decrease indent',<IndentDecrease size={19}/>,false,()=>indent(-1))}{btn('Increase indent',<IndentIncrease size={19}/>,false,()=>indent(1))}{btn('Quote',<Quote size={19}/>,ed.isActive('blockquote'),()=>c().toggleBlockquote().run())}{btn('Code block',<Code2 size={19}/>,ed.isActive('codeBlock'),()=>c().toggleCodeBlock().run())}</div>
    <p className="zg-lbl">Line spacing</p><div className="zg-chips">{([['1','Single'],['1.15','1.15'],['1.5','1.5'],['2','Double']] as const).map(([v,l])=><button key={v} type="button" className={lh===v?'is-on':''} onClick={()=>setLh(v)}>{l}</button>)}</div>
   </div>}
   {sheet==='insert'&&<div className="zg-sheet-body zg-ins">
    <button type="button" onClick={()=>{setSheet(null);fileRef.current?.click();}}><ImagePlus size={20}/>Image</button>
    <button type="button" onClick={()=>{insertTable();setSheet(null);}}><Table2 size={20}/>Table</button>
    <button type="button" onClick={()=>{setSheet(null);setUrl(ed.getAttributes('link').href??'');setLinkOpen(true);}}><Link2 size={20}/>Link</button>
    <button type="button" onClick={()=>{c().setHorizontalRule().run();setSheet(null);}}><Minus size={20}/>Line</button>
    <button type="button" onClick={()=>{c().insertContent(new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})).run();setSheet(null);}}><Check size={20}/>Today’s date</button>
    {ed.isActive('table')&&<><button type="button" onClick={()=>c().addRowAfter().run()}><Plus size={20}/>Row</button><button type="button" onClick={()=>c().addColumnAfter().run()}><Plus size={20}/>Column</button><button type="button" onClick={()=>c().deleteRow().run()}><Minus size={20}/>Row</button><button type="button" onClick={()=>c().deleteColumn().run()}><Minus size={20}/>Column</button><button type="button" className="is-danger" onClick={()=>{c().deleteTable().run();setSheet(null);}}><X size={20}/>Delete table</button></>}
   </div>}
  </div>}
  {linkOpen&&<form className="zd-link zg-mlink" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();applyLink();}}><input autoFocus value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste a link (leave empty to remove)" aria-label="Link address"/><button className="zn-btn is-primary">Apply</button></form>}
  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e=>{void tools.insert(Array.from(e.target.files??[]));e.target.value='';}}/>
  {(img.busy||img.error)&&<p className={`zd-imgstate${img.error?' is-error':''}`} role="status">{img.busy?'Uploading picture…':img.error}</p>}
  <div className="zg-body">
   {outline&&<aside className="zg-outline"><header><button type="button" aria-label="Hide outline" data-tip="Hide outline" onClick={toggleOutline}><PanelLeft size={16}/></button><b>Outline</b></header>
    {headings.length?headings.map((h,i)=><button key={i} type="button" className={`is-h${h.level}`} onClick={()=>jump(h.pos)}>{h.text}</button>):<p>Headings you add appear here.</p>}</aside>}
   <div className="zg-canvas" data-lenis-prevent>
    {!outline&&<button type="button" className="zg-outline-btn" aria-label="Show outline" data-tip="Show outline" onClick={toggleOutline}><PanelLeft size={16}/></button>}
    <div className="zg-page" style={{zoom:zoom/100}} onClick={canEdit?undefined:pics.onClick}><EditorContent editor={editor}/></div>{pics.node}
   </div>
  </div>
  <button type="button" className="zg-words" onClick={()=>setCounting(true)}>{words.toLocaleString()} word{words===1?'':'s'}</button>
  {counting&&ed&&<div className="zn-modal-scrim" onClick={()=>setCounting(false)}><div className="zn-modal zn-confirm zg-count" role="dialog" aria-label="Word count" onClick={e=>e.stopPropagation()}>
   <h2>Word count</h2><dl><dt>Pages</dt><dd>{Math.max(1,Math.ceil(words/500))}</dd><dt>Words</dt><dd>{words.toLocaleString()}</dd><dt>Characters</dt><dd>{ed.getText().length.toLocaleString()}</dd><dt>Characters without spaces</dt><dd>{ed.getText().replace(/\s/g,'').length.toLocaleString()}</dd></dl>
   <div className="zn-modal-foot"><button type="button" className="zn-btn is-primary" onClick={()=>setCounting(false)}>OK</button></div></div></div>}
  {sharing&&<ShareDoc docId={doc.id} onClose={()=>setSharing(false)}/>}
 </div>;
}
function Palette({onPick,none='Reset'}:{onPick:(c:string|null)=>void;none?:string}){
 return <div className="zg-palette" onClick={e=>e.stopPropagation()}><button type="button" className="zg-none" onMouseDown={e=>e.preventDefault()} onClick={()=>onPick(null)}>{none}</button>
  <div>{COLORS.map(x=><button key={x} type="button" aria-label={x} style={{background:x}} onMouseDown={e=>e.preventDefault()} onClick={()=>onPick(x)}/>)}</div></div>;
}
export function Toolbar({editor,linkOpen,setLinkOpen,url,setUrl,onImage}:{onImage?:()=>void;editor:Editor;linkOpen:boolean;setLinkOpen:(v:boolean)=>void;url:string;setUrl:(v:string)=>void}){
 const b=(label:string,icon:React.ReactNode,active:boolean,run:()=>void)=><button key={label} type="button" className={active?'is-on':''} aria-label={label} aria-pressed={active} data-tip={label} onMouseDown={e=>e.preventDefault()} onClick={run}>{icon}</button>;
 function applyLink(){
  const href=url.trim();
  if(!href){editor.chain().focus().unsetLink().run();}
  else{const safe=/^(https?:|mailto:)/i.test(href)?href:`https://${href}`;editor.chain().focus().extendMarkRange('link').setLink({href:safe}).run();}
  setLinkOpen(false);setUrl('');
 }
 return <div className="zd-toolbar" role="toolbar" aria-label="Formatting">
  {b('Heading 1',<Heading1 size={16}/>,editor.isActive('heading',{level:1}),()=>editor.chain().focus().toggleHeading({level:1}).run())}
  {b('Heading 2',<Heading2 size={16}/>,editor.isActive('heading',{level:2}),()=>editor.chain().focus().toggleHeading({level:2}).run())}
  <i/>
  {b('Bold',<Bold size={16}/>,editor.isActive('bold'),()=>editor.chain().focus().toggleBold().run())}
  {b('Italic',<Italic size={16}/>,editor.isActive('italic'),()=>editor.chain().focus().toggleItalic().run())}
  {b('Underline',<UnderlineIcon size={16}/>,editor.isActive('underline'),()=>editor.chain().focus().toggleUnderline().run())}
  {b('Strikethrough',<Strikethrough size={16}/>,editor.isActive('strike'),()=>editor.chain().focus().toggleStrike().run())}
  <i/>
  {b('Bulleted list',<List size={16}/>,editor.isActive('bulletList'),()=>editor.chain().focus().toggleBulletList().run())}
  {b('Numbered list',<ListOrdered size={16}/>,editor.isActive('orderedList'),()=>editor.chain().focus().toggleOrderedList().run())}
  {b('Quote',<Quote size={16}/>,editor.isActive('blockquote'),()=>editor.chain().focus().toggleBlockquote().run())}
  {b('Code',<Code2 size={16}/>,editor.isActive('codeBlock'),()=>editor.chain().focus().toggleCodeBlock().run())}
  {onImage&&b('Add picture',<ImagePlus size={16}/>,false,onImage)}
  {b('Link',<Link2 size={16}/>,editor.isActive('link'),()=>{setUrl(editor.getAttributes('link').href??'');setLinkOpen(!linkOpen);})}
  <i/>
  {b('Undo',<Undo2 size={16}/>,false,()=>editor.chain().focus().undo().run())}
  {b('Redo',<Redo2 size={16}/>,false,()=>editor.chain().focus().redo().run())}
  {linkOpen&&<form className="zd-link" onSubmit={e=>{e.preventDefault();applyLink();}}><input autoFocus value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste a link (leave empty to remove)" aria-label="Link address"/><button className="zn-btn is-primary">Apply</button></form>}
 </div>;
}
