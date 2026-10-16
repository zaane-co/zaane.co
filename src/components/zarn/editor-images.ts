'use client';
import type {Editor} from '@tiptap/react';
import {optimizeImage} from '@/components/admin/blog/shared';
// Pictures in a brief or document: upload (shrinking big screenshots first) and put them into the editor where you pasted or dropped them.
export async function uploadEditorImage(file:File,scope:'lead'|'doc',id:string){
 const f=file.type==='image/gif'?file:await optimizeImage(file).catch(()=>file);
 const form=new FormData();form.set('file',f);form.set('scope',scope);form.set('id',id);
 const r=await fetch('/api/zarn/editor-image',{method:'POST',body:form});const d=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(d.error||'Could not upload the picture.');
 return d.url as string;
}
export function imageTools(scope:'lead'|'doc',id:string,editorRef:{current:Editor|null},onState:(s:{busy:boolean;error:string})=>void){
 const insert=async(files:File[])=>{
  onState({busy:true,error:''});
  try{for(const f of files.slice(0,6)){const src=await uploadEditorImage(f,scope,id);editorRef.current?.chain().focus().setImage({src}).run();}onState({busy:false,error:''});}
  catch(e){onState({busy:false,error:e instanceof Error?e.message:'Could not upload the picture.'});}
 };
 const pick=(list:FileList|File[]|null|undefined)=>Array.from(list??[]).filter(f=>f.type.startsWith('image/'));
 return {
  insert,
  handlers:{
   handlePaste:(_v:unknown,e:ClipboardEvent)=>{const files=pick(e.clipboardData?.files);if(!files.length)return false;e.preventDefault();void insert(files);return true;},
   handleDrop:(_v:unknown,e:DragEvent)=>{const files=pick(e.dataTransfer?.files);if(!files.length)return false;e.preventDefault();void insert(files);return true;},
  },
 };
}
