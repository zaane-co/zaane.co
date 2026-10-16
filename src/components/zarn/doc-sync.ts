'use client';
import * as Y from 'yjs';
import {generateJSON} from '@tiptap/html';
import {getSchema} from '@tiptap/core';
import {prosemirrorJSONToYDoc} from '@tiptap/y-tiptap';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import LinkExt from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
// Live co-editing for documents. Every edit is a small update saved in order; everyone with the document open receives the
// others' updates as they are saved, and the editor merges them without losing anyone's typing.
type Db=ReturnType<typeof import('@/lib/supabase/browser').browserClient>;
const b64=(u:Uint8Array)=>{let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode(...u.subarray(i,i+0x8000));return btoa(s);};
const unb64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
// The editor's extensions without the collaboration parts, used to turn a document written before live editing into its starting state.
const baseExtensions=()=>[StarterKit.configure({link:false,underline:false,undoRedo:false}),Underline,Image,LinkExt];
export function seedFromHtml(html:string){
 const exts=baseExtensions(),json=generateJSON(html||'<p></p>',exts);
 return Y.encodeStateAsUpdate(prosemirrorJSONToYDoc(getSchema(exts),json,'default'));
}
type Row={id:number;data:string;client:string};
export class DocSync{
 ydoc=new Y.Doc();
 private client=crypto.randomUUID();private lastId=0;private count=0;private queue:Uint8Array[]=[];private timer:ReturnType<typeof setTimeout>|null=null;private ch:ReturnType<Db['channel']>|null=null;private dead=false;
 constructor(private db:Db,private docId:string,private canWrite:boolean){}
 private apply(rows:Row[]){for(const r of rows){if(r.id>this.lastId)this.lastId=r.id;this.count++;if(r.client===this.client)continue;Y.applyUpdate(this.ydoc,unb64(r.data),'remote');}}
 private async catchUp(){
  for(;;){
   const {data}=await this.db.from('zarn_doc_updates').select('id,data,client').eq('doc_id',this.docId).gt('id',this.lastId).order('id').limit(500);
   const rows=(data??[]) as Row[];if(!rows.length)return;
   // Our own earlier updates are skipped on live delivery, but on first load they are not in memory yet, so apply everything then.
   for(const r of rows){if(r.id>this.lastId)this.lastId=r.id;this.count++;Y.applyUpdate(this.ydoc,unb64(r.data),'remote');}
   if(rows.length<500)return;
  }
 }
 // Resolves 'collab' when ready to edit live, or 'static' when the document has no live state and this person can't create it.
 async start(html:string):Promise<'collab'|'static'>{
  this.ch=this.db.channel(`zarn-doc-${this.docId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'zarn_doc_updates',filter:`doc_id=eq.${this.docId}`},(p:{new:Row})=>{if(!this.dead)this.apply([p.new]);}).subscribe((s:string)=>{if(s==='SUBSCRIBED'&&this.lastId>0&&!this.dead)void this.catchUp();});
  await this.catchUp();
  if(this.lastId===0){
   if(!this.canWrite)return 'static';
   // First time this document is opened live: its current text becomes the starting state (the first to try wins).
   await this.db.rpc('zarn_doc_seed',{d:this.docId,payload:b64(seedFromHtml(html)),who:this.client}).then(()=>{});
   await this.catchUp();
   if(this.lastId===0)return 'static';
  }
  if(this.canWrite){
   this.ydoc.on('update',(u:Uint8Array,origin:unknown)=>{if(origin==='remote')return;this.queue.push(u);if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>void this.flush(),250);});
   if(this.count>150)void this.db.rpc('zarn_doc_compact',{d:this.docId,upto:this.lastId,payload:b64(Y.encodeStateAsUpdate(this.ydoc)),who:this.client}).then(()=>{});
  }
  return 'collab';
 }
 async flush(){
  if(!this.queue.length)return;
  const batch=this.queue;this.queue=[];
  const {data,error}=await this.db.from('zarn_doc_updates').insert({doc_id:this.docId,data:b64(Y.mergeUpdates(batch)),client:this.client}).select('id').single();
  if(error){this.queue=[...batch,...this.queue];if(!this.dead)this.timer=setTimeout(()=>void this.flush(),2000);return;}
  if(data&&(data as {id:number}).id>this.lastId)this.lastId=(data as {id:number}).id;
 }
 async destroy(){this.dead=true;if(this.timer)clearTimeout(this.timer);await this.flush();if(this.ch)void this.db.removeChannel(this.ch);this.ydoc.destroy();}
}
