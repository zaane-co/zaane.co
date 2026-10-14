import 'server-only';
import {z} from 'zod';
import {serviceClient} from '@/lib/supabase/server';
import {deleteFile,headPrivate,putPrivate,r2Configured,signGet,signPut} from '@/lib/r2';
// Shared files on a lead/client, used by both the Studio admin and ZARN client spaces.
// Each route supplies its own access check; storage and validation live here.
export const MAX_FILE=100*1024*1024;
const blocked=/\.(html?|svg|js|mjs|xhtml|xml|exe|bat|cmd|sh|msi|dmg|app|php|com|scr|jar)$/i;
const id=z.uuid();
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('sign'),lead_id:id,name:z.string().trim().min(1).max(200),type:z.string().max(120),size:z.number().int().min(0).max(MAX_FILE)}),
 z.object({action:z.literal('save'),lead_id:id,key:z.string().max(400),name:z.string().trim().min(1).max(200)}),
 z.object({action:z.literal('delete'),lead_id:id,id}),
]);
export type FileAccess={userId:string;canDelete:(uploadedBy:string|null)=>boolean};
const fail=(error:string,status=400)=>Response.json({error},{status});
const clean=(n:string)=>n.replace(/[^\w.\- ()]+/g,'').replace(/\s+/g,'-').slice(-120)||'file';
const keyFor=(lead:string,name:string)=>`private/leads/${lead}/${crypto.randomUUID()}-${clean(name)}`;

export async function filesPost(request:Request,check:(leadId:string)=>Promise<FileAccess|null>){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 if(!r2Configured())return fail('File storage isn’t configured.',503);
 const db=serviceClient();
 // Small-file fallback through the server (used when direct upload to R2 isn't allowed by the bucket's CORS yet).
 if((request.headers.get('content-type')??'').startsWith('multipart/form-data')){
  const form=await request.formData();const lead=String(form.get('lead_id')??''),file=form.get('file');
  if(!id.safeParse(lead).success||!(file instanceof File))return fail('Invalid request');
  const access=await check(lead);if(!access)return fail('You can’t add files here.',403);
  if(blocked.test(file.name))return fail('That file type isn’t allowed.');
  if(file.size>4*1024*1024)return fail('Large files need direct upload. Ask an admin to finish the storage setup.');
  const key=keyFor(lead,file.name);
  await putPrivate(key.replace(/^private\//,''),new Uint8Array(await file.arrayBuffer()),file.type||'application/octet-stream',file.name);
  const {data,error}=await db.from('lead_files').insert({lead_id:lead,key,name:file.name.slice(0,200),size:file.size,type:file.type||'application/octet-stream',uploaded_by:access.userId}).select('*').single();
  return error?fail('Could not save the file.'):Response.json({ok:true,file:data});
 }
 const parsed=actions.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return fail(parsed.error.issues[0]?.message||'Invalid request');
 const b=parsed.data;
 const access=await check(b.lead_id);if(!access)return fail('You can’t manage files here.',403);
 switch(b.action){
  case 'sign':{
   if(blocked.test(b.name))return fail('That file type isn’t allowed.');
   const key=keyFor(b.lead_id,b.name),type=b.type||'application/octet-stream';
   return Response.json({ok:true,key,type,url:await signPut(key,type)});
  }
  case 'save':{
   // The object must really be in R2, under this lead's folder.
   if(!b.key.startsWith(`private/leads/${b.lead_id}/`))return fail('Invalid file.');
   const head=await headPrivate(b.key);if(!head)return fail('Upload didn’t finish. Try again.');
   if(head.size>MAX_FILE){await deleteFile(b.key).catch(()=>{});return fail('Files must be under 100 MB.');}
   const {data,error}=await db.from('lead_files').insert({lead_id:b.lead_id,key:b.key,name:b.name,size:head.size,type:head.type||'application/octet-stream',uploaded_by:access.userId}).select('*').single();
   return error?fail('Could not save the file.'):Response.json({ok:true,file:data});
  }
  case 'delete':{
   const {data:f}=await db.from('lead_files').select('key,uploaded_by').eq('id',b.id).eq('lead_id',b.lead_id).maybeSingle();
   if(!f)return fail('File not found.',404);
   if(!access.canDelete(f.uploaded_by))return fail('Only the person who added it or an admin can delete this file.',403);
   await db.from('lead_files').delete().eq('id',b.id);
   await deleteFile(f.key).catch(()=>{});
   return Response.json({ok:true});
  }
 }
}

// Download: a 5-minute signed link straight from R2.
export async function filesGet(request:Request,check:(leadId:string)=>Promise<FileAccess|null>){
 const fid=new URL(request.url).searchParams.get('id')??'';if(!id.safeParse(fid).success)return new Response('Invalid request',{status:400});
 const {data:f}=await serviceClient().from('lead_files').select('lead_id,key,name').eq('id',fid).maybeSingle();
 if(!f||!await check(f.lead_id))return new Response('Not found',{status:404});
 return Response.redirect(await signGet(f.key,f.name),302);
}
