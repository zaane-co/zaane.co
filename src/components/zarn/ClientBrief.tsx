'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useEditor,EditorContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import LinkExt from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {Check,Eye,Loader2,PenLine} from 'lucide-react';
import {Modal} from './Dialogs';
import {Toolbar} from './DocPage';
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fromText=(t:string)=>t.split(/\n{2,}/).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('');
type L={id:string;brief_html:string;project_description:string;message:string};
// The client's project brief: formatted text with links that anyone on the client's team can write and update.
export default function ClientBrief({lead,canEdit}:{lead:L;canEdit:boolean}){
 const router=useRouter();
 const plain=lead.project_description||lead.message||'';
 const [html,setHtml]=useState(lead.brief_html||(plain?fromText(plain):'')),[editing,setEditing]=useState(false),[previewing,setPreviewing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[linkOpen,setLinkOpen]=useState(false),[url,setUrl]=useState('');
 const editor=useEditor({
  immediatelyRender:false,shouldRerenderOnTransaction:true,content:html,editable:editing,
  extensions:[StarterKit.configure({link:false,underline:false}),Underline,LinkExt.configure({openOnClick:false}),Placeholder.configure({placeholder:'Describe the project: goals, scope, deliverables, deadlines, links to designs or documents…'})],
  editorProps:{attributes:{class:'zd-prose zcb-prose','aria-label':'Project brief'}},
 },[editing]);
 async function save(){
  if(!editor)return;setBusy(true);setError('');
  try{
   const r=await fetch('/api/zarn/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'brief',lead_id:lead.id,html:editor.isEmpty?'':editor.getHTML()})});
   const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Could not save the brief.');
   setHtml(d.html??'');setEditing(false);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Could not save the brief.');}
  setBusy(false);
 }
 if(editing)return <div className="zcb">
  {editor&&<Toolbar editor={editor} linkOpen={linkOpen} setLinkOpen={setLinkOpen} url={url} setUrl={setUrl}/>}
  <div className="zcb-edit"><EditorContent editor={editor}/></div>
  {error&&<p className="zn-error" role="alert">{error}</p>}
  <div className="zp-brief-actions"><button type="button" className="zn-btn" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button><button type="button" className="zn-btn is-primary" disabled={busy} onClick={()=>void save()}>{busy?<><Loader2 size={14} className="zn-spin"/>Saving…</>:<><Check size={14}/>Save brief</>}</button></div>
 </div>;
 return <div className="zcb">
  {html?<div className="zcb-clamp zd-prose" dangerouslySetInnerHTML={{__html:html}}/>:<p className="zn-empty-line">No brief yet. Add the goals, scope and links to get everyone on the same page.</p>}
  <div className="zcb-actions">
   {html&&<button type="button" className="zn-btn is-primary" onClick={()=>setPreviewing(true)}><Eye size={14}/>Preview</button>}
   {canEdit&&<button type="button" className="zn-btn" onClick={()=>setEditing(true)}><PenLine size={14}/>{html?'Edit':'Write brief'}</button>}
  </div>
  {previewing&&<Modal title="Project brief" wide onClose={()=>setPreviewing(false)}><div className="zcb-read zd-prose" dangerouslySetInnerHTML={{__html:html}}/><div className="zn-modal-foot">{canEdit&&<button type="button" className="zn-btn" onClick={()=>{setPreviewing(false);setEditing(true);}}><PenLine size={14}/>Edit</button>}<button type="button" className="zn-btn is-primary" onClick={()=>setPreviewing(false)}>Close</button></div></Modal>}
 </div>;
}
