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
export async function uploadImage(file:File):Promise<string>{
 const form=new FormData();form.set('file',file);
 const r=await fetch('/api/admin/upload',{method:'POST',body:form});const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.url)throw new Error(data.error||'Upload failed.');return data.url;
}
