'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEditor,EditorContent,type Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import LinkExt from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {ImagePlus,Bold,Check,ChevronLeft,Code2,Heading1,Heading2,Italic,Link2,List,ListOrdered,Loader2,Quote,Redo2,Share2,Strikethrough,Trash2,Underline as UnderlineIcon,Undo2} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {useConfirm} from './ConfirmProvider';
import ShareDoc from './ShareDoc';
import Image from '@tiptap/extension-image';
import {imageTools} from './editor-images';
type Doc={id:string;title:string;content:string;owner_id:string;updated_at:string};
type Role='owner'|'edit'|'view';
// Opens a document: owners and editors can type, everyone else reads. Changes save by themselves.
export default function DocPage({id}:{id:string}){
 const {db,me}=useZarn();
 const [doc,setDoc]=useState<Doc|null|undefined>(undefined),[role,setRole]=useState<Role|null>(null);
 useEffect(()=>{
  let live=true;
  void (async()=>{
   const [{data},{data:r}]=await Promise.all([db.from('zarn_docs').select('id,title,content,owner_id,updated_at').eq('id',id).maybeSingle(),db.rpc('zarn_doc_role',{d:id})]);
   if(!live)return;setDoc((data as Doc|null)??null);setRole((r as Role|null)??null);
  })();
  return()=>{live=false;};
 },[db,id]);
 if(doc===undefined)return <div className="zn-page"><p className="zn-loading">Loading…</p></div>;
 if(!doc||!role)return <div className="zn-page"><div className="zn-empty-state"><h2>Document not found</h2><p>It may have been deleted, or it isn’t shared with you.</p><Link className="zn-btn" href="/zarn/docs">Back to Docs</Link></div></div>;
 return <Editing doc={doc} role={role} meId={me.user_id}/>;
}
function Editing({doc,role,meId}:{doc:Doc;role:Role;meId:string}){
 const {db}=useZarn(),router=useRouter(),confirm=useConfirm();
 const canEdit=role==='owner'||role==='edit';
 const [title,setTitle]=useState(doc.title),[state,setState]=useState<'saved'|'saving'|'error'>('saved'),[sharing,setSharing]=useState(false),[linkOpen,setLinkOpen]=useState(false),[url,setUrl]=useState('');
 const editorRef=useRef<Editor|null>(null),fileRef=useRef<HTMLInputElement>(null);
 const [img,setImg]=useState({busy:false,error:''});
 // eslint-disable-next-line react-hooks/refs -- the editor is only read when a picture is pasted or chosen, never while rendering
 const tools=imageTools('doc',doc.id,()=>editorRef.current,setImg);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),latest=useRef({title:doc.title,content:doc.content});
 const save=useCallback(async()=>{
  setState('saving');
  const {error}=await db.from('zarn_docs').update({title:latest.current.title.trim()||'Untitled',content:latest.current.content,updated_by:meId}).eq('id',doc.id);
  setState(error?'error':'saved');
 },[db,doc.id,meId]);
 const queue=useCallback(()=>{setState('saving');if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void save(),1200);},[save]);
 const editor=useEditor({
  immediatelyRender:false,shouldRerenderOnTransaction:true,editable:canEdit,content:doc.content,
  extensions:[StarterKit.configure({link:false,underline:false}),Underline,Image,LinkExt.configure({openOnClick:false}),Placeholder.configure({placeholder:canEdit?'Start writing…':''})],
  editorProps:{attributes:{class:'zd-prose','aria-label':'Document'},...tools.handlers},
  onCreate:({editor:e})=>{editorRef.current=e;},
  onUpdate:({editor:e})=>{latest.current.content=e.getHTML();queue();},
 });
 // Save anything pending when leaving the page.
 useEffect(()=>()=>{if(timer.current){clearTimeout(timer.current);void save();}},[save]);
 async function remove(){
  if(!await confirm({title:'Delete this document?',message:`“${title||'Untitled'}” will be deleted for everyone, and its share links stop working.`,confirm:'Delete document',danger:true}))return;
  await db.from('zarn_docs').delete().eq('id',doc.id);router.push('/zarn/docs');
 }
 return <div className="zn-page zd-page">
  <header className="zd-head">
   <Link href="/zarn/docs" className="zn-icon" aria-label="Back to Docs"><ChevronLeft size={20}/></Link>
   <input className="zd-title" value={title} readOnly={!canEdit} maxLength={200} placeholder="Untitled" aria-label="Title" onChange={e=>{setTitle(e.target.value);latest.current.title=e.target.value;queue();}}/>
   <span className={`zd-state${state==='error'?' is-error':''}`}>{!canEdit?'View only':state==='saving'?<><Loader2 size={13} className="zn-spin"/>Saving…</>:state==='error'?'Not saved. Retry by typing.':<><Check size={13}/>Saved</>}</span>
   {role==='owner'&&<><button type="button" className="zn-btn" onClick={()=>setSharing(true)}><Share2 size={14}/>Share</button><button type="button" className="zd-del" aria-label="Delete document" data-tip="Delete" onClick={()=>void remove()}><Trash2 size={16}/></button></>}
  </header>
  {canEdit&&editor&&<Toolbar editor={editor} linkOpen={linkOpen} setLinkOpen={setLinkOpen} url={url} setUrl={setUrl} onImage={()=>fileRef.current?.click()}/>}
  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e=>{void tools.insert(Array.from(e.target.files??[]));e.target.value='';}}/>
  {(img.busy||img.error)&&<p className={`zd-imgstate${img.error?' is-error':''}`} role="status">{img.busy?'Uploading picture…':img.error}</p>}
  <div className="zd-scroll" data-lenis-prevent><div className="zd-sheet"><EditorContent editor={editor}/></div></div>
  {sharing&&<ShareDoc docId={doc.id} onClose={()=>setSharing(false)}/>}
 </div>;
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
