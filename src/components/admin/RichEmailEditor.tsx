'use client';
import {useEffect,useState} from 'react';
import {useEditor,EditorContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {Image} from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import {TextStyle,FontFamily,Color} from '@tiptap/extension-text-style';
import type {EditorView} from '@tiptap/pm/view';
import {AlignCenter,AlignLeft,AlignRight,Bold,Images,ImageIcon,Italic,Link2,List,ListOrdered,Loader2,Minus,MousePointerClick,Quote,Redo2,Strikethrough,Underline as UnderlineIcon,Undo2,X} from 'lucide-react';
import MediaPicker from './MediaPicker';
import {uploadImage} from './blog/shared';
import {emailFonts} from '@/lib/newsletter';

const COLORS=[{label:'Default',value:''},{label:'Brand',value:'#c40a3a'},{label:'Black',value:'#111111'},{label:'Orange',value:'#f97316'},{label:'Green',value:'#16a34a'},{label:'Blue',value:'#2563eb'},{label:'Purple',value:'#7c3aed'},{label:'Gray',value:'#71717a'}];
// A link with data-button="true" is sent as a pill button.
const ButtonLink=Link.extend({addAttributes(){return {...this.parent?.(),'data-button':{default:null,parseHTML:el=>el.getAttribute('data-button'),renderHTML:a=>a['data-button']?{'data-button':'true'}:{}}};}});
const btn='text-[var(--a-muted)] hover:text-[var(--a-fg)] hover:bg-[var(--a-hover)] data-[active=true]:bg-[var(--a-fg)] data-[active=true]:text-[var(--a-bg)]';
const ic='h-3.5 w-3.5';

// Rich text for newsletter bodies: fonts, colours, headings, lists, links, buttons and images.
export default function RichEmailEditor({value,onChange,disabled=false}:{value:string;onChange:(html:string)=>void;disabled?:boolean}){
 const [linkBar,setLinkBar]=useState<null|'link'|'button'>(null),[url,setUrl]=useState(''),[colors,setColors]=useState(false),[picker,setPicker]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState('');
 function insertUploads(view:EditorView,files:File[],pos?:number){
  setUploading(true);
  Promise.all(files.map(async file=>{try{const src=await uploadImage(file);const node=view.state.schema.nodes.image.create({src});view.dispatch(pos!=null?view.state.tr.insert(pos,node):view.state.tr.replaceSelectionWith(node));}catch(e){setError(e instanceof Error?e.message:'Upload failed.');}})).finally(()=>setUploading(false));
 }
 const editor=useEditor({
  immediatelyRender:false,editable:!disabled,
  extensions:[StarterKit.configure({link:false,underline:false,codeBlock:false,code:false}),Underline,TextStyle,Color,FontFamily,Image,ButtonLink.configure({openOnClick:false}),Placeholder.configure({placeholder:'Write your email…'}),TextAlign.configure({types:['heading','paragraph']})],
  content:value,
  editorProps:{
   attributes:{class:'focus:outline-none min-h-[320px]'},
   handleDrop(view,event){const files=Array.from(event.dataTransfer?.files??[]).filter(f=>f.type.startsWith('image/'));if(!files.length)return false;event.preventDefault();insertUploads(view,files,view.posAtCoords({left:event.clientX,top:event.clientY})?.pos??view.state.selection.from);return true;},
   handlePaste(view,event){const files=Array.from(event.clipboardData?.items??[]).filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile()).filter((f):f is File=>!!f);if(!files.length)return false;event.preventDefault();insertUploads(view,files);return true;},
  },
  onUpdate:({editor})=>onChange(editor.isEmpty?'':editor.getHTML()),
 });
 useEffect(()=>{editor?.setEditable(!disabled);},[editor,disabled]);
 // Pick up content changed from outside, e.g. choosing a template.
 useEffect(()=>{if(editor&&(editor.isEmpty?'':editor.getHTML())!==value)editor.commands.setContent(value,{emitUpdate:false});},[editor,value]);
 const c=()=>editor?.chain().focus();
 const tb=(title:string,onClick:()=>void,icon:React.ReactNode,active?:boolean)=><button type="button" data-tip={title} aria-label={title} disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={onClick} data-active={active??false} className={`h-7 w-7 rounded flex items-center justify-center transition-colors disabled:opacity-25 ${btn}`}>{icon}</button>;
 const sep=<div className="w-px h-4 mx-1 bg-[var(--a-border)]"/>;
 function openLink(kind:'link'|'button'){setUrl((editor?.getAttributes('link').href as string)||'');setLinkBar(kind);}
 function applyLink(){
  const href=url.trim();if(!href||!editor){setLinkBar(null);return;}
  const full=/^(https?:|mailto:)/i.test(href)?href:`https://${href}`;
  if(linkBar==='button'&&editor.state.selection.empty&&!editor.isActive('link'))editor.chain().focus().insertContent({type:'text',text:'Click here',marks:[{type:'link',attrs:{href:full,'data-button':'true'}}]}).run();
  else editor.chain().focus().extendMarkRange('link').setLink({href:full,...(linkBar==='button'?{'data-button':'true'}:{})} as {href:string}).run();
  setLinkBar(null);
 }
 const font=(editor?.getAttributes('textStyle').fontFamily as string|undefined)??'';
 return <div className={`rounded-xl border border-[var(--a-border)] bg-[var(--a-panel-2)] ${disabled?'opacity-70':''}`}>
  <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-[var(--a-border)]">
   {tb('Undo',()=>c()?.undo().run(),<Undo2 className={ic}/>)}{tb('Redo',()=>c()?.redo().run(),<Redo2 className={ic}/>)}{sep}
   <select aria-label="Font" disabled={disabled} value={emailFonts.some(f=>f.value===font)?font:''} onChange={e=>{const v=e.target.value;if(v)c()?.setFontFamily(v).run();else c()?.unsetFontFamily().run();}} className="h-7 rounded bg-transparent text-xs text-[var(--a-muted)] px-1 border border-[var(--a-border)] focus:outline-none">{emailFonts.map(f=><option key={f.label} value={f.value}>{f.label}</option>)}</select>{sep}
   {tb('Bold',()=>c()?.toggleBold().run(),<Bold className={ic} strokeWidth={2.5}/>,editor?.isActive('bold'))}
   {tb('Italic',()=>c()?.toggleItalic().run(),<Italic className={ic}/>,editor?.isActive('italic'))}
   {tb('Underline',()=>c()?.toggleUnderline().run(),<UnderlineIcon className={ic}/>,editor?.isActive('underline'))}
   {tb('Strikethrough',()=>c()?.toggleStrike().run(),<Strikethrough className={ic}/>,editor?.isActive('strike'))}{sep}
   {([1,2] as const).map(level=><button key={level} type="button" data-tip={`Heading ${level}`} disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>c()?.toggleHeading({level}).run()} data-active={editor?.isActive('heading',{level})??false} className={`h-7 px-2 rounded text-xs font-bold transition-colors disabled:opacity-25 ${btn}`}>H{level}</button>)}{sep}
   {tb('Bullet list',()=>c()?.toggleBulletList().run(),<List className={ic}/>,editor?.isActive('bulletList'))}
   {tb('Numbered list',()=>c()?.toggleOrderedList().run(),<ListOrdered className={ic}/>,editor?.isActive('orderedList'))}
   {tb('Quote',()=>c()?.toggleBlockquote().run(),<Quote className={ic}/>,editor?.isActive('blockquote'))}{sep}
   {tb('Align left',()=>c()?.setTextAlign('left').run(),<AlignLeft className={ic}/>,editor?.isActive({textAlign:'left'}))}
   {tb('Align center',()=>c()?.setTextAlign('center').run(),<AlignCenter className={ic}/>,editor?.isActive({textAlign:'center'}))}
   {tb('Align right',()=>c()?.setTextAlign('right').run(),<AlignRight className={ic}/>,editor?.isActive({textAlign:'right'}))}{sep}
   {tb('Link',()=>openLink('link'),<Link2 className={ic}/>,editor?.isActive('link')&&!editor.getAttributes('link')['data-button'])}
   {tb('Button',()=>openLink('button'),<MousePointerClick className={ic}/>,!!editor?.getAttributes('link')['data-button'])}
   <div className="relative">
    <button type="button" data-tip="Text colour" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>setColors(v=>!v)} className={`h-7 w-7 rounded flex flex-col items-center justify-center gap-0.5 transition-colors disabled:opacity-25 ${btn}`}><span className="text-xs font-bold leading-none">A</span><span className="w-4 h-1 rounded-full" style={{backgroundColor:(editor?.getAttributes('textStyle').color as string|undefined)??'#9ca3af'}}/></button>
    {colors&&<div onMouseDown={e=>e.preventDefault()} className="absolute top-full left-0 mt-1 z-50 rounded-xl border shadow-xl p-3 w-44 bg-[var(--a-panel)] border-[var(--a-border)]"><div className="grid grid-cols-4 gap-2">{COLORS.map(col=><button key={col.label} type="button" data-tip={col.label} onClick={()=>{if(col.value)c()?.setColor(col.value).run();else c()?.unsetColor().run();setColors(false);}} className="h-7 w-7 rounded-lg border-2 border-[var(--a-border)] transition-transform hover:scale-110" style={{backgroundColor:col.value||'transparent'}}>{!col.value&&<X className="h-3.5 w-3.5 mx-auto text-[var(--a-muted)]"/>}</button>)}</div></div>}
   </div>{sep}
   <label data-tip="Upload image" aria-label="Upload image" onMouseDown={e=>e.preventDefault()} className={`h-7 w-7 rounded flex items-center justify-center transition-colors cursor-pointer ${btn} ${uploading||disabled?'opacity-50 pointer-events-none':''}`}>{uploading?<Loader2 className={`${ic} animate-spin`}/>:<ImageIcon className={ic}/>}<input type="file" accept="image/*" multiple className="hidden" onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';if(files.length&&editor)insertUploads(editor.view,files);}}/></label>
   {tb('Image from media library',()=>setPicker(true),<Images className={ic}/>)}
   {tb('Divider',()=>c()?.setHorizontalRule().run(),<Minus className={ic}/>)}
  </div>
  {linkBar&&<div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--a-border)]">
   {linkBar==='button'?<MousePointerClick className="h-3.5 w-3.5 shrink-0 text-[var(--a-muted)]"/>:<Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--a-muted)]"/>}
   <input autoFocus value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();applyLink();}if(e.key==='Escape')setLinkBar(null);}} placeholder={linkBar==='button'?'Button link, https://zaane.co':'https://example.com'} className="flex-1 text-xs bg-transparent border-none focus:outline-none text-[var(--a-fg)]"/>
   <button type="button" onClick={applyLink} className="text-xs font-medium text-[var(--accent)]">Apply</button>
   {editor?.isActive('link')&&<button type="button" onClick={()=>{c()?.extendMarkRange('link').unsetLink().run();setLinkBar(null);}} className="text-xs text-[#dc2626]">Remove</button>}
   <button type="button" onClick={()=>setLinkBar(null)} aria-label="Close" className="text-[var(--a-muted)]"><X className="h-3.5 w-3.5"/></button>
  </div>}
  {error&&<p className="px-4 pt-3 text-xs text-[#dc2626]" role="alert">{error}</p>}
  <div className="px-5 py-4 text-[var(--a-fg)] blog-content za-nl-content"><EditorContent editor={editor}/></div>
  <MediaPicker open={picker} multiple onClose={()=>setPicker(false)} onPick={urls=>{urls.forEach(src=>editor?.chain().focus().setImage({src}).run());setPicker(false);}}/>
 </div>;
}
