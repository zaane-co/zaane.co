'use client';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Mark,mergeAttributes,type Editor} from '@tiptap/core';
import {Check,Highlighter,MessageSquarePlus,MoreVertical,Trash2,X} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {Avatar} from './format';

// The commented text: a mark carrying the thread id. It lives in the document, so it moves with edits and syncs live.
export const CommentMark=Mark.create({
 name:'comment',inclusive:false,excludes:'',
 addAttributes(){return {id:{default:null,parseHTML:el=>el.getAttribute('data-comment'),renderHTML:a=>a.id?{'data-comment':a.id}:{}}};},
 parseHTML(){return [{tag:'span[data-comment]'}];},
 renderHTML({HTMLAttributes}){return ['span',mergeAttributes(HTMLAttributes,{class:'zg-cmark'}),0];},
});
// Takes a thread's mark off the text (when it is resolved, deleted or the new comment is cancelled).
export function unmark(ed:Editor,id:string){
 const type=ed.schema.marks.comment;if(!type)return;const tr=ed.state.tr;
 ed.state.doc.descendants((n,pos)=>{n.marks.forEach(m=>{if(m.type===type&&m.attrs.id===id)tr.removeMark(pos,pos+n.nodeSize,m);});});
 if(tr.docChanged)ed.view.dispatch(tr);
}

const HL=['#fef08a','#bbf7d0','#bae6fd','#fbcfe8','#fed7aa'];
// Floats above selected text: add a comment, or highlight in one tap.
export function SelectionBar({ed,canEdit,onComment}:{ed:Editor|null;canEdit:boolean;onComment:()=>void}){
 const [pos,setPos]=useState<{x:number;y:number}|null>(null);
 useEffect(()=>{if(!ed)return;
  const upd=()=>{const s=ed.state.selection;if(s.empty||!ed.isFocused){setPos(null);return;}
   const a=ed.view.coordsAtPos(s.from),b=ed.view.coordsAtPos(s.to);setPos({x:Math.min(Math.max((a.left+b.left)/2,140),window.innerWidth-140),y:Math.min(a.top,b.top)});};
  const hide=()=>setTimeout(()=>{if(!document.activeElement?.closest('.zg-selbar'))setPos(null);},120);
  ed.on('selectionUpdate',upd);ed.on('focus',upd);ed.on('blur',hide);window.addEventListener('scroll',upd,true);
  return()=>{ed.off('selectionUpdate',upd);ed.off('focus',upd);ed.off('blur',hide);window.removeEventListener('scroll',upd,true);};},[ed]);
 if(!pos||!ed||!canEdit)return null;
 return <div className="zg-selbar" style={{left:pos.x,top:pos.y}} onMouseDown={e=>e.preventDefault()}>
  <button type="button" className="zg-selbar-cmt" onClick={onComment}><MessageSquarePlus size={16}/>Comment</button>
  <i/>
  <Highlighter size={15} className="zg-selbar-ic" aria-hidden="true"/>
  {HL.map(c=><button key={c} type="button" className="zg-selbar-dot" aria-label={`Highlight ${c}`} style={{background:c}} onClick={()=>ed.chain().focus().setBackgroundColor(c).run()}/>)}
  <button type="button" className="zg-selbar-dot is-none" aria-label="Remove highlight" onClick={()=>ed.chain().focus().unsetBackgroundColor().run()}><X size={12}/></button>
 </div>;
}

type Cmt={id:string;thread_id:string;user_id:string;body:string;quote:string|null;resolved_at:string|null;created_at:string};
const when=(s:string)=>{const d=new Date(s),t=new Date();return d.toDateString()===t.toDateString()?d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):d.toLocaleDateString(undefined,{day:'numeric',month:'short'});};
// The comments side panel: one card per thread, in the order they appear in the document.
export function CommentsPanel({ed,docId,role,draft,active,onActive,onDraftDone,onClose}:{ed:Editor|null;docId:string;role:'owner'|'edit'|'view';draft:{id:string;quote:string}|null;active:string|null;onActive:(id:string|null)=>void;onDraftDone:(posted:boolean)=>void;onClose:()=>void}){
 const {db,me,people}=useZarn();
 const [list,setList]=useState<Cmt[]|null>(null),[err,setErr]=useState(''),[showDone,setShowDone]=useState(false),[,bump]=useState(0);
 const ch=useRef<ReturnType<typeof db.channel>|null>(null);
 const load=useCallback(async()=>{const {data,error}=await db.from('zarn_doc_comments').select('id,thread_id,user_id,body,quote,resolved_at,created_at').eq('doc_id',docId).order('created_at');
  if(error){setErr('Comments aren’t available yet.');setList([]);return;}setList(data as Cmt[]);},[db,docId]);
 useEffect(()=>{let on=true;void (async()=>{if(on)await load();})();
  const c=db.channel(`zarn-doc-cmt:${docId}`);c.on('broadcast',{event:'changed'},()=>void load()).subscribe();ch.current=c;
  return()=>{on=false;ch.current=null;void db.removeChannel(c);};},[db,docId,load]);
 // Re-sort when the document changes (threads follow the text's order).
 useEffect(()=>{if(!ed)return;const f=()=>bump(x=>x+1);ed.on('update',f);return()=>{ed.off('update',f);};},[ed]);
 const changed=()=>{void load();void ch.current?.send({type:'broadcast',event:'changed',payload:{}});};
 const order=useMemo(()=>{const m=new Map<string,number>();ed?.state.doc.descendants((n,pos)=>{n.marks.forEach(k=>{if(k.type.name==='comment'&&!m.has(k.attrs.id))m.set(k.attrs.id,pos);});});return m;},[ed,list]); // eslint-disable-line react-hooks/exhaustive-deps
 const threads=useMemo(()=>{const g=new Map<string,Cmt[]>();for(const c of list??[]){const a=g.get(c.thread_id)??[];a.push(c);g.set(c.thread_id,a);}
  return [...g.entries()].map(([id,cs])=>({id,cs,done:!!cs[0].resolved_at,pos:order.get(id)})).filter(t=>showDone||!t.done).sort((a,b)=>(a.pos??1e9)-(b.pos??1e9));},[list,order,showDone]);
 async function post(thread:string,body:string,quote?:string|null){
  const row={doc_id:docId,thread_id:thread,user_id:me.user_id,body,...(thread===draft?.id?{id:thread,quote:quote??null}:{})};
  const {error}=await db.from('zarn_doc_comments').insert(row);if(error){setErr('Could not post the comment.');return false;}
  changed();return true;}
 async function resolve(t:string){await db.from('zarn_doc_comments').update({resolved_at:new Date().toISOString(),resolved_by:me.user_id}).eq('thread_id',t).eq('doc_id',docId);if(ed)unmark(ed,t);onActive(null);changed();}
 async function remove(c:Cmt,whole:boolean){
  if(whole){await db.from('zarn_doc_comments').delete().eq('thread_id',c.thread_id).eq('doc_id',docId);if(ed)unmark(ed,c.thread_id);}
  else await db.from('zarn_doc_comments').delete().eq('id',c.id);
  changed();}
 const jump=(id:string)=>{onActive(id);const el=document.querySelector(`.zg-prose [data-comment="${id}"]`);el?.scrollIntoView({behavior:'smooth',block:'center'});};
 const canResolve=role==='owner'||role==='edit';
 const doneCount=new Set((list??[]).filter(c=>c.resolved_at).map(c=>c.thread_id)).size;
 return <aside className="zg-cmts" aria-label="Comments" onClick={e=>e.stopPropagation()}>
  <header><b>Comments</b>{doneCount>0&&<label className="zg-cmts-opt"><input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)}/>Resolved ({doneCount})</label>}
   <button type="button" aria-label="Close comments" onClick={onClose}><X size={16}/></button></header>
  <div className="zg-cmts-list">
   {draft&&<div className="zg-thread is-on"><blockquote>{draft.quote}</blockquote>
    <Composer autoFocus placeholder="Add a comment" onCancel={()=>onDraftDone(false)} onSend={async b=>{if(await post(draft.id,b,draft.quote)){onDraftDone(true);onActive(draft.id);}}}/></div>}
   {list===null?<p className="zg-cmts-note">Loading…</p>:err?<p className="zg-cmts-note">{err}</p>:!threads.length&&!draft?<p className="zg-cmts-note">No comments yet. Select some text and press Comment.</p>:null}
   {threads.filter(t=>t.id!==draft?.id).map(t=><div key={t.id} className={`zg-thread${active===t.id?' is-on':''}${t.done?' is-done':''}`} onClick={()=>jump(t.id)}>
    {t.cs[0].quote&&<blockquote className={t.pos===undefined&&!t.done?'is-gone':''}>{t.cs[0].quote}</blockquote>}
    {t.pos===undefined&&!t.done&&<small className="zg-cmts-gone">The commented text was removed.</small>}
    {t.cs.map((c,i)=><div key={c.id} className="zg-cmt">
     <div className="zg-cmt-head"><Avatar m={people[c.user_id]} size={26}/><span><b>{people[c.user_id]?.display_name??'Former member'}</b><small>{when(c.created_at)}</small></span>
      {i===0&&!t.done&&canResolve&&<button type="button" className="zg-cmt-ic" aria-label="Resolve" data-tip="Resolve" onClick={e=>{e.stopPropagation();void resolve(t.id);}}><Check size={16}/></button>}
      {(c.user_id===me.user_id||role==='owner')&&<ItemMenu onDelete={()=>void remove(c,i===0)} label={i===0?'Delete thread':'Delete'}/>}</div>
     <p>{c.body}</p></div>)}
    {t.done?<small className="zg-cmts-gone">Resolved</small>:active===t.id&&<Composer placeholder="Reply" onSend={b=>post(t.id,b).then(()=>{})}/>}
   </div>)}
  </div>
 </aside>;
}
function ItemMenu({onDelete,label}:{onDelete:()=>void;label:string}){
 const [open,setOpen]=useState(false);
 return <span className="zg-cmt-more" onClick={e=>e.stopPropagation()}><button type="button" className="zg-cmt-ic" aria-label="More" onClick={()=>setOpen(o=>!o)}><MoreVertical size={16}/></button>
  {open&&<span className="zn-menu zg-cmt-menu"><button type="button" onClick={()=>{setOpen(false);onDelete();}}><Trash2 size={14}/>{label}</button></span>}</span>;
}
function Composer({placeholder,autoFocus,onSend,onCancel}:{placeholder:string;autoFocus?:boolean;onSend:(b:string)=>Promise<void>|void;onCancel?:()=>void}){
 const [v,setV]=useState(''),[busy,setBusy]=useState(false),ta=useRef<HTMLTextAreaElement>(null);
 useLayoutEffect(()=>{const t=ta.current;if(t){t.style.height='auto';t.style.height=`${t.scrollHeight}px`;}},[v]);
 async function send(){const b=v.trim();if(!b||busy)return;setBusy(true);await onSend(b);setBusy(false);setV('');}
 return <div className="zg-composer" onClick={e=>e.stopPropagation()}>
  <textarea ref={ta} rows={1} autoFocus={autoFocus} value={v} maxLength={5000} placeholder={placeholder} onChange={e=>setV(e.target.value)}
   onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();void send();}if(e.key==='Escape')onCancel?.();}}/>
  {(v||onCancel)&&<div className="zg-composer-acts">{onCancel&&<button type="button" className="zn-btn" onClick={onCancel}>Cancel</button>}<button type="button" className="zn-btn is-primary" disabled={!v.trim()||busy} onClick={()=>void send()}>{onCancel?'Comment':'Reply'}</button></div>}
 </div>;
}
