'use client';
import {useEditor,EditorContent,ReactNodeViewRenderer} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {Image} from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import {TextStyle} from '@tiptap/extension-text-style';
import {Color} from '@tiptap/extension-color';
import type {EditorView} from '@tiptap/pm/view';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import NextLink from 'next/link';
import {Bold,CalendarDays,Images,Check,ChevronLeft,CloudUpload,Code2,FileText,ImageIcon,Italic,Link2,List,ListOrdered,Loader2,PenLine,Quote,Redo2,Search,Strikethrough,Underline as UnderlineIcon,Undo2,X} from 'lucide-react';
import {EditorImageView} from './EditorImage';
import MediaPicker from '../MediaPicker';
import {useAdminTheme} from '@/lib/admin-theme';
import {t,getStatus,blogApi,uploadImage,type Category,type Post} from './shared';

const COLORS=[
 {label:'Default',value:'inherit'},{label:'Brand',value:'#f10c45'},{label:'Black',value:'#0a0a0d'},{label:'Orange',value:'#f97316'},{label:'Yellow',value:'#eab308'},
 {label:'Green',value:'#22c55e'},{label:'Blue',value:'#3b82f6'},{label:'Purple',value:'#8b5cf6'},{label:'Pink',value:'#ec4899'},{label:'Gray',value:'#6b7280'},
];
type Mode='draft'|'scheduled'|'published';
type PreviewTab='post'|'seo';
const localInput=(d:Date)=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
const generateSlug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

export default function BlogEditor({initialData,categories,initialCats=[],canPublish}:{initialData?:Post;categories:Category[];initialCats?:string[];canPublish:boolean}){
 const {dark}=useAdminTheme();
 const router=useRouter();
 const initialMode=initialData?getStatus(initialData):'draft';
 const [title,setTitle]=useState(initialData?.title??'');
 const [excerpt,setExcerpt]=useState(initialData?.excerpt??'');
 const [slug,setSlug]=useState(initialData?.slug??'');
 const [coverImage,setCoverImage]=useState(initialData?.cover_image??'');
 const [status,setStatus]=useState<Mode>(initialMode);
 const [scheduledAt,setScheduledAt]=useState(initialMode==='scheduled'&&initialData?.published_at?localInput(new Date(initialData.published_at)):'');
 const [saving,setSaving]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [error,setError]=useState('');
 const [previewTab,setPreviewTab]=useState<PreviewTab>('post');
 const [content,setContent]=useState(initialData?.content??'');
 const [metaTitle,setMetaTitle]=useState(initialData?.meta_title??'');
 const [metaDesc,setMetaDesc]=useState(initialData?.meta_description??'');
 const [focusKw,setFocusKw]=useState(initialData?.focus_keyword??'');
 const [selectedCats,setSelectedCats]=useState<string[]>(initialCats);
 const [linkInput,setLinkInput]=useState('');
 const [showLinkBar,setShowLinkBar]=useState(false);
 const [showColors,setShowColors]=useState(false);
 const [toast,setToast]=useState<{title:string;sub:string;color:string}|null>(null);
 const [imgUploading,setImgUploading]=useState(false);
 const [picker,setPicker]=useState<'cover'|'content'|null>(null);

 function insertUploads(view:EditorView,files:File[],pos?:number){
  files.forEach(async file=>{
   try{const src=await uploadImage(file);const node=view.state.schema.nodes.image.create({src});view.dispatch(pos!=null?view.state.tr.insert(pos,node):view.state.tr.replaceSelectionWith(node));}
   catch(e){setError(e instanceof Error?e.message:'Upload failed.');}
  });
 }
 const editor=useEditor({
  immediatelyRender:false,
  extensions:[
   StarterKit.configure({link:false,underline:false}),Underline,TextStyle,Color,
   Image.extend({addNodeView(){return ReactNodeViewRenderer(EditorImageView);}}),
   Link.configure({openOnClick:false}),
   Placeholder.configure({placeholder:'Start writing your post…'}),
   TextAlign.configure({types:['heading','paragraph']}),
  ],
  content:initialData?.content??'',
  editorProps:{
   attributes:{class:'focus:outline-none min-h-[400px] px-1'},
   handleDrop(view,event){
    const files=Array.from(event.dataTransfer?.files??[]).filter(f=>f.type.startsWith('image/'));if(!files.length)return false;
    event.preventDefault();insertUploads(view,files,view.posAtCoords({left:event.clientX,top:event.clientY})?.pos??view.state.selection.from);return true;
   },
   handlePaste(view,event){
    const files=Array.from(event.clipboardData?.items??[]).filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile()).filter((f):f is File=>!!f);if(!files.length)return false;
    event.preventDefault();insertUploads(view,files);return true;
   },
  },
  onUpdate:({editor})=>setContent(editor.getHTML()),
 });

 function handleTitleChange(v:string){setTitle(v);if(!initialData?.slug)setSlug(generateSlug(v));}
 async function uploadCover(file?:File){
  if(!file||!file.type.startsWith('image/'))return;
  setUploading(true);setError('');
  try{setCoverImage(await uploadImage(file));}catch(e){setError(e instanceof Error?e.message:'Upload failed.');}
  setUploading(false);
 }
 async function handleSave(forceDraft?:boolean){
  if(!title)return setError('Title is required.');
  const mode:Mode=forceDraft||!canPublish?'draft':status;
  if(mode==='scheduled'&&!scheduledAt)return setError('Please set a scheduled date.');
  setSaving(true);setError('');
  try{
   await blogApi({action:'save',id:initialData?.id,values:{title,slug:slug||generateSlug(title),excerpt,content:editor?.getHTML()??'',cover_image:coverImage,mode,published_at:mode==='scheduled'?new Date(scheduledAt).toISOString():null,meta_title:metaTitle,meta_description:metaDesc,focus_keyword:focusKw,category_ids:selectedCats}});
   const toastMap={
    published:{title:'Post Published!',sub:'Your post is now live on the site.',color:'green'},
    scheduled:{title:'Post Scheduled',sub:scheduledAt?`Goes live ${new Date(scheduledAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`:'Scheduled.',color:'yellow'},
    draft:{title:'Draft Saved',sub:'Saved privately. Not visible on site.',color:'blue'},
   };
   setToast(toastMap[mode]);
   setTimeout(()=>{router.push('/admin/blog');router.refresh();},2800);
  }catch(e){setError(e instanceof Error?e.message:'Failed to save.');}
  setSaving(false);
 }
 async function handleEditorImageUpload(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];if(!file||!editor)return;
  setImgUploading(true);
  try{editor.chain().focus().setImage({src:await uploadImage(file)}).run();}catch(err){setError(err instanceof Error?err.message:'Upload failed.');}
  setImgUploading(false);e.target.value='';
 }
 function applyLink(){
  if(!linkInput)editor?.chain().focus().unsetLink().run();
  else editor?.chain().focus().setLink({href:/^(https?:|mailto:|\/)/.test(linkInput)?linkInput:`https://${linkInput}`}).run();
  setLinkInput('');setShowLinkBar(false);
 }
 function toggleLinkBar(){setLinkInput(editor?.getAttributes('link').href??'');setShowLinkBar(v=>!v);}

 // SEO analysis
 const effTitle=metaTitle||title,effDesc=metaDesc||excerpt;
 const plainText=content.replace(/<[^>]+>/g,' ');
 const wordCount=plainText.split(/\s+/).filter(Boolean).length;
 const kw=focusKw.toLowerCase();
 const seoChecks=[
  {label:'Meta title (50–60 chars)',ok:effTitle.length>=50&&effTitle.length<=60,value:`${effTitle.length} chars`},
  {label:'Meta description (120–160 chars)',ok:effDesc.length>=120&&effDesc.length<=160,value:`${effDesc.length} chars`},
  {label:'Focus keyword in title',ok:!!kw&&title.toLowerCase().includes(kw),value:kw?(title.toLowerCase().includes(kw)?'Found':'Missing'):'No keyword'},
  {label:'Focus keyword in description',ok:!!kw&&effDesc.toLowerCase().includes(kw),value:kw?(effDesc.toLowerCase().includes(kw)?'Found':'Missing'):'No keyword'},
  {label:'Focus keyword in content',ok:!!kw&&plainText.toLowerCase().includes(kw),value:kw?(plainText.toLowerCase().includes(kw)?'Found':'Missing'):'No keyword'},
  {label:'Cover image set',ok:!!coverImage,value:coverImage?'Yes':'No'},
  {label:'Excerpt written',ok:!!excerpt,value:excerpt?'Yes':'Missing'},
  {label:'Word count (300+ recommended)',ok:wordCount>=300,value:`${wordCount} words`},
 ];
 const seoScore=Math.round(seoChecks.filter(c=>c.ok).length/seoChecks.length*100);
 const seoBg=seoScore>=75?'bg-[#16a34a]':seoScore>=50?'bg-[#f59e0b]':'bg-[#dc2626]';
 const seoText=seoScore>=75?'text-[#16a34a]':seoScore>=50?'text-[#d97706]':'text-[#dc2626]';
 const lenColor=(n:number,lo:number,hi:number)=>n>hi?'bg-[#dc2626]':n>=lo?'bg-[#16a34a]':'bg-[#f59e0b]';
 const lenText=(n:number,lo:number,hi:number)=>n>hi?'text-[#dc2626]':n>=lo?'text-[#16a34a]':t.sub;

 const pane='bg-[var(--a-bg)]',headerBg='bg-[var(--a-panel)] border-[var(--a-border)]',labelCls=t.sub;
 const toolbarBtn='text-[var(--a-muted)] hover:text-[var(--a-fg)] hover:bg-[var(--a-hover)] data-[active=true]:bg-[var(--a-fg)] data-[active=true]:text-[var(--a-bg)]';
 const sep=<div className="w-px h-4 mx-1 bg-[var(--a-border)]"/>;
 const tb=(title:string,onClick:()=>void,icon:React.ReactNode,active?:boolean,extra='')=><button type="button" data-tip={title} aria-label={title} onMouseDown={e=>e.preventDefault()} onClick={onClick} data-active={active??false} className={`h-7 w-7 rounded flex items-center justify-center transition-colors disabled:opacity-25 ${toolbarBtn} ${extra}`}>{icon}</button>;
 const ic='h-3.5 w-3.5';

 return <>
  {toast&&<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
   <div className={`flex items-center gap-4 rounded-2xl px-5 py-4 shadow-2xl border min-w-[320px] ${t.modal}`}>
    <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-none text-white ${toast.color==='green'?'bg-[#16a34a]':toast.color==='yellow'?'bg-[#f59e0b]':'bg-[#2563eb]'}`}>
     {toast.color==='green'?<Check className="h-5 w-5" strokeWidth={2.5}/>:toast.color==='yellow'?<CalendarDays className="h-5 w-5"/>:<FileText className="h-5 w-5"/>}
    </div>
    <div className="flex-1 min-w-0"><p className={`text-sm font-semibold ${t.heading}`}>{toast.title}</p><p className={`text-xs mt-0.5 ${t.sub}`}>{toast.sub}</p></div>
    <NextLink href="/admin/blog" className={`text-xs font-medium underline underline-offset-2 flex-none ${t.sub} hover:text-[var(--a-fg)]`}>View all</NextLink>
   </div>
  </div>}

  <MediaPicker open={!!picker} multiple={picker==='content'} onClose={()=>setPicker(null)} onPick={urls=>{if(picker==='cover')setCoverImage(urls[0]);else urls.forEach(src=>editor?.chain().focus().setImage({src}).run());}}/>
  <div className="za-editor-bleed flex overflow-hidden">
   {/* LEFT: editor */}
   <div className={`w-full lg:w-1/2 flex flex-col overflow-hidden lg:border-r border-[var(--a-border)] ${pane}`}>
    <div className={`flex-none flex items-center justify-between px-6 py-3.5 border-b ${headerBg}`}>
     <div className="flex items-center gap-3">
      <NextLink href="/admin/blog" className={`flex items-center gap-1 text-xs font-medium transition-colors ${t.faint} hover:text-[var(--a-fg)]`}><ChevronLeft className={ic} strokeWidth={2.5}/>All Posts</NextLink>
      <div className="w-px h-3.5 bg-[var(--a-border)]"/>
      <h1 className={`text-sm font-bold ${t.heading}`}>{initialData?.id?'Edit Post':'New Blog Post'}</h1>
     </div>
     <div className="flex items-center gap-2">
      <button onClick={()=>handleSave(true)} disabled={saving} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${t.ghostBtn}`}>Save Draft</button>
      {canPublish&&<button onClick={()=>handleSave()} disabled={saving} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${t.brandBtn}`}>{saving?'Saving…':status==='published'?'Publish':status==='scheduled'?'Schedule':'Save'}</button>}
     </div>
    </div>

    <div className="flex-1 overflow-y-auto" data-lenis-prevent>
     <div className="p-5 space-y-4">
      {error&&<div className="rounded-lg bg-[#dc2626] px-4 py-3 text-xs text-white">{error}</div>}

      <div className={`rounded-xl border p-5 space-y-3 ${t.card}`}>
       <input type="text" placeholder="Post title…" value={title} onChange={e=>handleTitleChange(e.target.value)} className={`w-full text-xl font-bold bg-transparent border-none focus:outline-none ${t.heading} placeholder:text-[var(--a-faint)]`}/>
       <div className={`border-t pt-3 ${t.divider}`}>
        <input type="text" placeholder="Excerpt: a short description of the post" value={excerpt} onChange={e=>setExcerpt(e.target.value)} className={`w-full text-sm bg-transparent border-none focus:outline-none ${t.sub} placeholder:text-[var(--a-faint)]`}/>
       </div>
      </div>

      <div className={`rounded-xl border ${t.card}`}>
       <div className={`sticky top-0 z-10 flex flex-wrap items-center gap-0.5 px-3 py-2 border-b rounded-t-xl ${t.divider} bg-[var(--a-panel)]`}>
        {tb('Undo',()=>editor?.chain().focus().undo().run(),<Undo2 className={ic}/>)}
        {tb('Redo',()=>editor?.chain().focus().redo().run(),<Redo2 className={ic}/>)}
        {sep}
        {tb('Bold',()=>editor?.chain().focus().toggleBold().run(),<Bold className={ic} strokeWidth={2.5}/>,editor?.isActive('bold'))}
        {tb('Italic',()=>editor?.chain().focus().toggleItalic().run(),<Italic className={ic}/>,editor?.isActive('italic'))}
        {tb('Underline',()=>editor?.chain().focus().toggleUnderline().run(),<UnderlineIcon className={ic}/>,editor?.isActive('underline'))}
        {tb('Strikethrough',()=>editor?.chain().focus().toggleStrike().run(),<Strikethrough className={ic}/>,editor?.isActive('strike'))}
        {sep}
        {([1,2,3] as const).map(level=><button key={level} type="button" data-tip={`Heading ${level}`} onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().toggleHeading({level}).run()} data-active={editor?.isActive('heading',{level})??false} className={`h-7 px-2 rounded text-xs font-bold transition-colors ${toolbarBtn}`}>H{level}</button>)}
        {sep}
        {tb('Bullet list',()=>editor?.chain().focus().toggleBulletList().run(),<List className={ic}/>,editor?.isActive('bulletList'))}
        {tb('Ordered list',()=>editor?.chain().focus().toggleOrderedList().run(),<ListOrdered className={ic}/>,editor?.isActive('orderedList'))}
        {tb('Blockquote',()=>editor?.chain().focus().toggleBlockquote().run(),<Quote className={ic}/>,editor?.isActive('blockquote'))}
        {sep}
        {tb('Insert link',toggleLinkBar,<Link2 className={ic}/>,editor?.isActive('link'))}
        <div className="relative">
         <button type="button" data-tip="Text colour" onMouseDown={e=>e.preventDefault()} onClick={()=>setShowColors(v=>!v)} className={`h-7 w-7 rounded flex flex-col items-center justify-center gap-0.5 transition-colors ${toolbarBtn}`}>
          <span className="text-xs font-bold leading-none">A</span>
          <span className="w-4 h-1 rounded-full" style={{backgroundColor:editor?.getAttributes('textStyle').color??(dark?'#ffffff':'#111827')}}/>
         </button>
         {showColors&&<div onMouseDown={e=>e.preventDefault()} className={`absolute top-full left-0 mt-1 z-50 rounded-xl border shadow-xl p-3 w-48 ${t.modal}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${labelCls}`}>Text colour</p>
          <div className="grid grid-cols-5 gap-2">
           {COLORS.map(c=><button key={c.value} type="button" data-tip={c.label} onMouseDown={e=>e.preventDefault()} onClick={()=>{if(c.value==='inherit')editor?.chain().focus().unsetColor().run();else editor?.chain().focus().setColor(c.value).run();setShowColors(false);}} className="h-7 w-7 rounded-lg border-2 transition-transform hover:scale-110" style={{backgroundColor:c.value==='inherit'?'transparent':c.value,borderColor:c.value==='inherit'?'var(--a-border)':c.value}}>
            {c.value==='inherit'&&<X className={`h-3.5 w-3.5 mx-auto ${labelCls}`}/>}
           </button>)}
          </div>
         </div>}
        </div>
        <label data-tip="Upload image" aria-label="Upload image" onMouseDown={e=>e.preventDefault()} className={`h-7 w-7 rounded flex items-center justify-center transition-colors cursor-pointer ${toolbarBtn} ${imgUploading?'opacity-50 cursor-wait':''}`}>{imgUploading?<Loader2 className={`${ic} animate-spin`}/>:<ImageIcon className={ic}/>}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleEditorImageUpload} className="hidden"/></label>
        {tb('Insert from media library',()=>setPicker('content'),<Images className={ic}/>)}
        {tb('Code block',()=>editor?.chain().focus().toggleCodeBlock().run(),<Code2 className={ic}/>,editor?.isActive('codeBlock'))}
       </div>

       {showLinkBar&&<div className={`flex items-center gap-2 px-3 py-2 border-b ${t.divider}`}>
        <Link2 className={`h-3.5 w-3.5 shrink-0 ${labelCls}`}/>
        <input autoFocus type="url" value={linkInput} onChange={e=>setLinkInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')applyLink();if(e.key==='Escape')setShowLinkBar(false);}} placeholder="https://example.com" className={`flex-1 text-xs bg-transparent border-none focus:outline-none ${t.heading} placeholder:text-[var(--a-faint)]`}/>
        <button type="button" onClick={applyLink} className="text-xs font-medium text-[var(--accent)] hover:opacity-70 transition-opacity">Apply</button>
        {editor?.isActive('link')&&<button type="button" onClick={()=>{editor.chain().focus().unsetLink().run();setShowLinkBar(false);}} className="text-xs text-[#dc2626] hover:opacity-70 transition-opacity">Remove</button>}
        <button type="button" onClick={()=>setShowLinkBar(false)} className={`${labelCls} hover:opacity-70`} aria-label="Close"><X className="h-3.5 w-3.5"/></button>
       </div>}

       <div className={`px-5 py-4 ${t.heading} blog-content`}><EditorContent editor={editor}/></div>
      </div>

      {/* Cover image */}
      <div className={`rounded-xl border overflow-hidden ${t.card}`}>
       <div className={`flex items-center justify-between px-5 py-3 border-b ${t.divider}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>Cover Image</p>
        <span className={`text-xs ${labelCls}`}>16:9 · PNG, JPG, WEBP</span>
       </div>
       {coverImage?<div className="relative">
        <img src={coverImage} alt="" className="w-full aspect-video object-cover"/>
        <button type="button" onClick={()=>setCoverImage('')} className="absolute top-3 right-3 bg-black text-white rounded-full h-7 w-7 flex items-center justify-center hover:bg-[#222] transition-colors" aria-label="Remove cover image"><X className="h-3.5 w-3.5"/></button>
       </div>:<label className={`flex flex-col items-center justify-center aspect-video cursor-pointer transition-colors ${t.soft} hover:bg-[var(--a-hover)]`}
        onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void uploadCover(e.dataTransfer.files?.[0]);}}>
        <ImageIcon className={`h-8 w-8 mb-3 ${labelCls}`} strokeWidth={1.2}/>
        <span className={`text-sm font-medium ${labelCls}`}>{uploading?'Uploading…':'Click or drag to upload'}</span>
        <span className={`text-xs mt-1 ${t.faint}`}>PNG, JPG, WEBP, AVIF · 1280 × 720 recommended</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" onChange={e=>void uploadCover(e.target.files?.[0])} className="hidden"/>
       </label>}
       <div className={`flex justify-end px-4 py-2.5 border-t ${t.divider}`}><button type="button" onClick={()=>setPicker('cover')} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${t.ghostBtn}`}><Images className="h-3.5 w-3.5"/>{coverImage?'Replace from library':'Choose from library'}</button></div>
      </div>

      {/* Slug + status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
       <div className={`rounded-xl border p-4 space-y-2 ${t.card}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>URL Slug</p>
        <input type="text" value={slug} onChange={e=>setSlug(e.target.value)} placeholder="post-url-slug" className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none transition-colors ${t.input}`}/>
       </div>
       <div className={`rounded-xl border p-4 space-y-3 ${t.card}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>Status</p>
        <div className="grid grid-cols-3 gap-1.5">
         {([{value:'draft',label:'Draft',icon:<PenLine className="h-5 w-5" strokeWidth={1.8}/>},{value:'scheduled',label:'Scheduled',icon:<CalendarDays className="h-5 w-5" strokeWidth={1.8}/>},{value:'published',label:'Publish',icon:<CloudUpload className="h-5 w-5" strokeWidth={1.8}/>}] as const).map(opt=>{
          const active=status===opt.value,locked=!canPublish&&opt.value!=='draft';
          const activeStyle=opt.value==='published'?'bg-[#16a34a] border-[#16a34a] text-white':opt.value==='scheduled'?'bg-[#f59e0b] border-[#f59e0b] text-[#1a1200]':'bg-[#52525b] border-[#52525b] text-white';
          return <button key={opt.value} type="button" disabled={locked} data-tip={locked?'An admin must publish or schedule posts':undefined} onClick={()=>setStatus(opt.value)} className={`flex flex-col items-center gap-2 rounded-xl border py-3.5 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${active?activeStyle:`border-[var(--a-border)] ${t.faint} hover:text-[var(--a-fg)] hover:border-[var(--a-muted)]`}`}>{opt.icon}{opt.label}</button>;
         })}
        </div>
        {status==='scheduled'&&<input type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)} min={localInput(new Date())} className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none transition-colors ${t.input}`}/>}
        <p className={`text-xs ${labelCls}`}>{status==='published'?'Will go live immediately on save':status==='scheduled'?scheduledAt?`Scheduled for ${new Date(scheduledAt).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}`:'Pick a date and time above':canPublish?'Saved privately, not visible on site':'Saved privately. An admin publishes it.'}</p>
       </div>
      </div>

      {/* Categories */}
      {categories.length>0&&(()=>{
       const parents=categories.filter(c=>!c.parent_id);
       const toggle=(id:string)=>setSelectedCats(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
       return <div className={`rounded-xl border p-5 space-y-3 ${t.card}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>Categories</p>
        <div className="space-y-2">
         {parents.map(parent=>{
          const subs=categories.filter(c=>c.parent_id===parent.id),sel=selectedCats.includes(parent.id);
          return <div key={parent.id}>
           <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>toggle(parent.id)} className={`flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors border ${sel?'bg-[var(--accent)] border-[var(--accent)] text-white':`${t.soft} border-[var(--a-border)] ${t.sub} hover:text-[var(--a-fg)] hover:bg-[var(--a-hover)]`}`}>
            <span className={`h-4 w-4 rounded flex-none flex items-center justify-center border ${sel?'bg-white border-white':'border-[var(--a-faint)]'}`}>{sel&&<Check className="h-2.5 w-2.5 text-[var(--accent)]" strokeWidth={3}/>}</span>{parent.name}
           </button>
           {subs.length>0&&<div className="ml-4 mt-1 space-y-1 border-l pl-3 border-[var(--a-border)]">
            {subs.map(s=>{const on=selectedCats.includes(s.id);return <button key={s.id} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>toggle(s.id)} className={`flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-xs transition-colors ${on?'text-[var(--a-fg)] font-semibold bg-[var(--a-hover)]':`${t.faint} hover:text-[var(--a-fg)] hover:bg-[var(--a-hover)]`}`}>
             <span className={`h-1.5 w-1.5 rounded-full flex-none ${on?'bg-[var(--accent)]':'bg-[var(--a-faint)]'}`}/>{s.name}
            </button>;})}
           </div>}
          </div>;
         })}
        </div>
        {selectedCats.length>0&&<div className="flex flex-wrap gap-1.5 pt-1">
         {selectedCats.map(id=>{const cat=categories.find(c=>c.id===id);if(!cat)return null;return <span key={id} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-[var(--accent)] text-white">{cat.name}<button type="button" onClick={()=>setSelectedCats(p=>p.filter(x=>x!==id))} className="opacity-80 hover:opacity-100" aria-label={`Remove ${cat.name}`}><X className="h-3 w-3"/></button></span>;})}
        </div>}
       </div>;
      })()}

      {/* SEO */}
      <div className={`rounded-xl border p-5 space-y-4 ${t.card}`}>
       <div className="flex items-center gap-2">
        <Search className={`h-4 w-4 ${labelCls}`}/>
        <p className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>SEO</p>
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full text-white ${seoBg}`}>{seoScore}%</span>
       </div>
       <div className="space-y-1.5">
        <label className={`text-xs font-medium ${labelCls}`}>Focus Keyword</label>
        <input type="text" value={focusKw} onChange={e=>setFocusKw(e.target.value)} placeholder="e.g. mvp development" className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none transition-colors ${t.input}`}/>
       </div>
       <div className="space-y-1.5">
        <div className="flex items-center justify-between"><label className={`text-xs font-medium ${labelCls}`}>Meta Title</label><span className={`text-xs ${lenText(effTitle.length,50,60)}`}>{effTitle.length}/60</span></div>
        <input type="text" value={metaTitle} onChange={e=>setMetaTitle(e.target.value)} placeholder={title||'Defaults to post title'} className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none transition-colors ${t.input}`}/>
        <div className="h-1 rounded-full overflow-hidden bg-[var(--a-panel-2)]"><div className={`h-full rounded-full transition-all ${lenColor(effTitle.length,50,60)}`} style={{width:`${Math.min(effTitle.length/60*100,100)}%`}}/></div>
       </div>
       <div className="space-y-1.5">
        <div className="flex items-center justify-between"><label className={`text-xs font-medium ${labelCls}`}>Meta Description</label><span className={`text-xs ${lenText(effDesc.length,120,160)}`}>{effDesc.length}/160</span></div>
        <textarea value={metaDesc} onChange={e=>setMetaDesc(e.target.value)} placeholder={excerpt||'Defaults to excerpt'} rows={3} className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none transition-colors resize-none ${t.input}`}/>
        <div className="h-1 rounded-full overflow-hidden bg-[var(--a-panel-2)]"><div className={`h-full rounded-full transition-all ${lenColor(effDesc.length,120,160)}`} style={{width:`${Math.min(effDesc.length/160*100,100)}%`}}/></div>
       </div>
      </div>
     </div>
    </div>
   </div>

   {/* RIGHT: preview */}
   <div className={`hidden lg:flex w-1/2 flex-col overflow-hidden ${pane}`}>
    <div className={`flex-none flex items-center justify-between px-6 py-3.5 border-b ${headerBg}`}>
     <div className="flex items-center gap-1 rounded-lg p-1 bg-[var(--a-panel-2)]">
      {(['post','seo'] as const).map(tab=><button key={tab} onClick={()=>setPreviewTab(tab)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${previewTab===tab?'bg-[var(--a-panel)] text-[var(--a-fg)] shadow-sm':`${t.sub} hover:text-[var(--a-fg)]`}`}>{tab==='post'?'Post Preview':'SEO Preview'}</button>)}
     </div>
     <div className="flex items-center gap-1.5"><div className={`h-2 w-2 rounded-full ${seoBg}`}/><span className={`text-xs ${labelCls}`}>SEO {seoScore>=75?'Good':seoScore>=50?'Needs work':'Poor'}</span></div>
    </div>

    <div className="flex-1 overflow-y-auto" data-lenis-prevent>
     {previewTab==='post'?<article className="mx-auto max-w-2xl px-8 py-12">
      {coverImage?<img src={coverImage} alt={title} className="w-full rounded-xl object-cover aspect-video mb-8" onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
      :<div className={`w-full aspect-video rounded-xl mb-8 flex items-center justify-center border ${t.soft} ${t.divider}`}><ImageIcon className={`h-10 w-10 ${t.faint}`} strokeWidth={1.5}/></div>}
      <p className={`text-sm ${labelCls}`}>{new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</p>
      <h1 className={`mt-2 text-3xl font-bold tracking-tight leading-tight ${t.heading}`}>{title||<span className={labelCls}>Post title will appear here…</span>}</h1>
      {excerpt&&<p className={`mt-4 text-base leading-relaxed border-l-4 pl-4 italic ${t.sub} border-[var(--a-border)]`}>{excerpt}</p>}
      <div className={`mt-8 blog-content ${t.heading}`} dangerouslySetInnerHTML={{__html:content&&content!=='<p></p>'?content:'<p style="opacity:.3">Your content will appear here as you write…</p>'}}/>
     </article>:<div className="p-5 space-y-6">
      <div className="space-y-2">
       <p className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>Google Search Preview</p>
       <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-1 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
         <div className="h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden"><img src="/zaane-mark.svg" alt="" className="h-3 w-3"/></div>
         <div><p className="text-xs text-gray-700 font-medium">Zaane</p><p className="text-xs text-gray-400">zaane.co › blog › {slug||'post-slug'}</p></div>
        </div>
        <p className="text-lg text-[#1a0dab] font-medium leading-snug hover:underline cursor-pointer line-clamp-1">{effTitle||<span className="text-gray-300">Post title…</span>}</p>
        <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{effDesc||<span className="text-gray-300">Meta description will appear here once you write an excerpt or set a meta description…</span>}</p>
       </div>
      </div>
      <div className="space-y-2">
       <p className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>Social Share Preview</p>
       <div className={`rounded-xl border overflow-hidden shadow-sm ${t.divider}`}>
        {coverImage?<img src={coverImage} alt="" className="w-full aspect-video object-cover"/>:<div className={`w-full aspect-video flex items-center justify-center border-b ${t.soft} ${t.divider}`}><span className={`text-xs ${labelCls}`}>No cover image set</span></div>}
        <div className="p-4 bg-[var(--a-panel)]">
         <p className={`text-xs uppercase tracking-wide font-medium ${labelCls}`}>zaane.co</p>
         <p className={`text-sm font-semibold mt-1 line-clamp-1 ${t.heading}`}>{effTitle||'Post title…'}</p>
         <p className={`text-xs mt-0.5 line-clamp-2 ${labelCls}`}>{effDesc||'Description…'}</p>
        </div>
       </div>
      </div>
      <div className="space-y-3">
       <div className="flex items-center justify-between"><p className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>SEO Analysis</p><span className={`text-sm font-bold ${seoText}`}>{seoScore}%</span></div>
       <div className="h-2 rounded-full overflow-hidden bg-[var(--a-panel-2)]"><div className={`h-full rounded-full transition-all duration-500 ${seoBg}`} style={{width:`${seoScore}%`}}/></div>
       <div className="space-y-2 pt-1">
        {seoChecks.map(check=><div key={check.label} className="flex items-center justify-between gap-3">
         <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className={`h-5 w-5 rounded-full flex-none flex items-center justify-center ${check.ok?'bg-[#16a34a] text-white':`bg-[var(--a-panel-2)] ${labelCls}`}`}>{check.ok?<Check className="h-3 w-3" strokeWidth={2.5}/>:<X className="h-3 w-3" strokeWidth={2.5}/>}</div>
          <p className={`text-xs truncate ${check.ok?t.heading:labelCls}`}>{check.label}</p>
         </div>
         <span className={`text-xs flex-none font-medium ${check.ok?'text-[#16a34a]':labelCls}`}>{check.value}</span>
        </div>)}
       </div>
      </div>
     </div>}
    </div>
   </div>
  </div>
 </>;
}
