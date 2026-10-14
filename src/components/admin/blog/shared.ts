// Theme tokens for the blog admin (ported from Finance with Anne). They read the za-admin CSS vars, so light/dark follows the shell toggle.
export const t={
 card:'bg-[var(--a-panel)] border-[var(--a-border)]',
 modal:'bg-[var(--a-panel)] border-[var(--a-border)]',
 heading:'text-[var(--a-fg)]',
 sub:'text-[var(--a-muted)]',
 faint:'text-[var(--a-faint)]',
 divider:'border-[var(--a-border)]',
 tHead:'text-[var(--a-faint)] border-[var(--a-border)] bg-[var(--a-panel-2)]',
 tRow:'border-[var(--a-border)] hover:bg-[var(--a-hover)]',
 input:'bg-[var(--a-input)] border-[var(--a-border)] text-[var(--a-fg)] placeholder:text-[var(--a-faint)] focus:border-[var(--a-muted)]',
 iconBtn:'text-[var(--a-faint)] hover:text-[var(--a-fg)] hover:bg-[var(--a-hover)]',
 ghostBtn:'border-[var(--a-border)] text-[var(--a-muted)] hover:bg-[var(--a-hover)] hover:text-[var(--a-fg)]',
 brandBtn:'bg-[var(--accent)] text-white hover:opacity-90',
 soft:'bg-[var(--a-panel-2)]',
};
export type PostStatus='published'|'draft'|'scheduled';
export type Category={id:string;name:string;slug:string;parent_id:string|null};
export type Post={id:string;title:string;slug:string;excerpt:string;content:string;cover_image:string|null;status:string;published_at:string|null;created_at:string;featured?:boolean;meta_title?:string;meta_description?:string;focus_keyword?:string;category_id?:string|null};
export function getStatus(p:Pick<Post,'status'|'published_at'>):PostStatus{
 if(p.status!=='published')return 'draft';
 return p.published_at&&new Date(p.published_at)>new Date()?'scheduled':'published';
}
// Solid fills only (no tints).
export const STATUS_STYLE:Record<PostStatus,{cls:string;label:string}>={
 published:{cls:'bg-[#16a34a] text-white',label:'Published'},
 scheduled:{cls:'bg-[#2563eb] text-white',label:'Scheduled'},
 draft:{cls:'bg-[#52525b] text-white',label:'Draft'},
};
export const fmt=(d:string,opts:Intl.DateTimeFormatOptions={day:'numeric',month:'short',year:'numeric'})=>new Date(d).toLocaleDateString('en-GB',opts);
export async function blogApi<T=Record<string,unknown>>(body:object):Promise<T>{
 const r=await fetch('/api/admin/blog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Something went wrong.');return data;
}
// Vercel caps request bodies at 4.5 MB, so every image is resized (max 2560px) and re-encoded as WebP in the
// browser first. Any size works on the way in; GIFs pass through untouched to keep animation.
const MAX_EDGE=2560,MAX_BYTES=4.3*1024*1024;
export async function optimizeImage(file:File):Promise<File>{
 if(file.type==='image/gif'){if(file.size>MAX_BYTES)throw new Error('GIFs must be under 4 MB.');return file;}
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(file);}catch{throw new Error(`Couldn’t read ${file.name}. Use a JPG, PNG, WebP, AVIF or HEIC image.`);}
 const base=file.name.replace(/\.[^.]+$/,'')||'image';
 let edge=MAX_EDGE,quality=0.85;
 try{
  for(let attempt=0;attempt<6;attempt++){
   const scale=Math.min(1,edge/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
   canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
   let blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/webp',quality));
   if(!blob||blob.type!=='image/webp')blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/jpeg',quality));
   if(!blob)break;
   // Small originals that are already web formats stay as they are if re-encoding wouldn't help.
   if(scale===1&&file.size<=blob.size&&file.size<=MAX_BYTES&&['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))return file;
   if(blob.size<=MAX_BYTES)return new File([blob],`${base}.${blob.type==='image/webp'?'webp':'jpg'}`,{type:blob.type});
   quality=Math.max(0.6,quality-0.1);edge=Math.round(edge*0.85);
  }
 }finally{bitmap.close();}
 throw new Error(`${file.name} is too large to upload even after resizing.`);
}
export async function uploadImage(file:File):Promise<string>{
 const form=new FormData();form.set('file',await optimizeImage(file));
 const r=await fetch('/api/admin/upload',{method:'POST',body:form});const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.url)throw new Error(data.error||'Upload failed.');return data.url;
}
