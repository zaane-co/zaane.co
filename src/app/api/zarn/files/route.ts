import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {deleteFile,getPrivate,headPrivate,putPrivate,r2Configured,signPut} from '@/lib/r2';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Vercel caps request bodies at 4.5 MB; images are shrunk in the browser first.
const MAX=4*1024*1024;
const blocked=/\.(html?|svg|js|mjs|xhtml|xml|exe|bat|cmd|sh|msi|dmg|app|php)$/i;
const inlineTypes=['image/jpeg','image/png','image/webp','image/gif','image/avif','application/pdf'];
// Upload a file into a channel the member belongs to. The message that references it is posted by the client.
const BIG=100*1024*1024;
type Where={drive?:string;folder_id?:string|null;lead_id?:string|null};
const placeOf=(b:Where)=>{const drive=b.drive??'my',folder=b.folder_id??'',lead=b.lead_id??'';
 if(!['my','team','client'].includes(drive)||(folder&&!uuid.test(folder))||(lead&&!uuid.test(lead))||(drive==='client'&&!lead&&!folder))return null;
 return {drive,folder_id:folder||null,lead_id:drive==='client'&&!folder?lead:null};};
// Drive uploads go straight from the browser to storage (up to 100 MB): sign, upload, then save.
// Chat attachments can also be saved into Drive; the copy points at the same stored file.
async function driveAction(request:Request,me:NonNullable<Awaited<ReturnType<typeof zarnMember>>>){
 const b=await request.json().catch(()=>null) as (Where&{action?:string;name?:string;type?:string;size?:number;key?:string;message_id?:string;index?:number})|null;
 if(!b)return Response.json({error:'Invalid request'},{status:400});
 if(me.account_type==='guest')return Response.json({error:'Drive is for team members.'},{status:403});
 const place=placeOf(b);if(!place)return Response.json({error:'Invalid request'},{status:400});
 const fail=(m:string,status=400)=>Response.json({error:m},{status});
 const insert=async(row:{name:string;size:number;type:string;key:string})=>{
  const id=crypto.randomUUID();
  const {error}=await me.db.from('zarn_files').insert({id,owner_id:me.user_id,...row,...place});
  return error?{error:/cannot|not available/.test(error.message)?error.message:'Could not save the file.'}:{id};
 };
 if(b.action==='sign'){
  const name=String(b.name??'').replace(/[^\w.\- ]+/g,'').slice(-120)||'file';
  if(blocked.test(name))return fail('That file type isn’t allowed.');
  if(!Number.isFinite(b.size)||Number(b.size)>BIG)return fail('Files must be under 100 MB.');
  const type=String(b.type||'application/octet-stream').slice(0,120);
  const key=`private/zarn/personal/${me.user_id}/${crypto.randomUUID()}-${name.replace(/\s+/g,'-')}`;
  return Response.json({key,type,url:await signPut(key,type)});
 }
 if(b.action==='save'){
  const key=String(b.key??'');
  if(!key.startsWith(`private/zarn/personal/${me.user_id}/`))return fail('Invalid file.');
  const head=await headPrivate(key);if(!head)return fail('Upload didn’t finish. Try again.');
  if(head.size>BIG){await deleteFile(key).catch(()=>{});return fail('Files must be under 100 MB.');}
  const name=String(b.name??'').replace(/[^\w.\- ]+/g,'').slice(-120)||'file';
  const r=await insert({name,size:head.size,type:head.type||'application/octet-stream',key});
  if('error' in r){await deleteFile(key).catch(()=>{});return fail(r.error!,502);}
  return Response.json(r);
 }
 if(b.action==='from_chat'){
  // The message must be readable by this member (RLS) and really carry the attachment.
  const mid=String(b.message_id??''),i=Number(b.index);
  if(!uuid.test(mid)||!Number.isInteger(i)||i<0)return fail('Invalid request');
  const {data:msg}=await me.db.from('zarn_messages').select('attachments,deleted_at').eq('id',mid).maybeSingle();
  const att=(msg?.attachments as {key:string;name:string;type:string;size:number}[]|undefined)?.[i];
  if(!msg||msg.deleted_at||!att?.key?.startsWith('private/zarn/'))return fail('File not found.',404);
  const r=await insert({name:att.name.slice(0,200),size:att.size||0,type:att.type||'application/octet-stream',key:att.key});
  return 'error' in r?fail(r.error!,502):Response.json(r);
 }
 return fail('Invalid request');
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const me=await zarnMember();if(!me)return Response.json({error:'Sign in first.'},{status:401});
 if(!r2Configured())return Response.json({error:'File storage isn’t configured.'},{status:503});
 if(request.headers.get('content-type')?.includes('application/json'))return driveAction(request,me);
 const form=await request.formData();const channel=String(form.get('channel_id')??''),file=form.get('file'),personal=form.get('scope')==='personal'||form.get('scope')==='drive';
 // Drive uploads say where they go: a folder, or the root of a drive (my / team / a client's).
 const drive=String(form.get('drive')??'my'),folder=String(form.get('folder_id')??''),lead=String(form.get('lead_id')??'');
 if(!['my','team','client'].includes(drive)||(folder&&!uuid.test(folder))||(lead&&!uuid.test(lead))||(drive==='client'&&!lead&&!folder))return Response.json({error:'Invalid request'},{status:400});
 if(!(file instanceof File)||(!personal&&!uuid.test(channel)))return Response.json({error:'Invalid request'},{status:400});
 if(file.size>MAX)return Response.json({error:'Files must be under 4 MB.'},{status:400});
 if(blocked.test(file.name))return Response.json({error:'That file type isn’t allowed.'},{status:400});
 if(!personal){
  const {data:inCh}=await me.db.from('zarn_channel_members').select('channel_id').eq('channel_id',channel).eq('user_id',me.user_id).maybeSingle();
  if(!inCh)return Response.json({error:'Join the channel first.'},{status:403});
 }else if(me.account_type==='guest')return Response.json({error:'Personal files are for team members.'},{status:403});
 const name=file.name.replace(/[^\w.\- ]+/g,'').slice(-120)||'file';
 try{
  const key=await putPrivate(`zarn/${personal?`personal/${me.user_id}`:channel}/${crypto.randomUUID()}-${name.replace(/\s+/g,'-')}`,new Uint8Array(await file.arrayBuffer()),file.type||'application/octet-stream',name);
  const type=file.type||'application/octet-stream';
  if(personal){
   // Saved to the member's own files; nobody else can open it until they share it.
   // The id is picked here: reading the new row back is refused by its own access rule mid-insert.
   const id=crypto.randomUUID();
   const {error}=await me.db.from('zarn_files').insert({id,owner_id:me.user_id,name,size:file.size,type,key,drive,folder_id:folder||null,lead_id:drive==='client'&&!folder?lead:null});
   if(error){await deleteFile(key).catch(()=>{});return Response.json({error:error.message.includes('cannot')||error.message.includes('not available')?error.message:'Could not save the file.'},{status:502});}
   return Response.json({id,key,name,size:file.size,type});
  }
  return Response.json({key,name,size:file.size,type});
 }catch{return Response.json({error:'Upload failed. Try again.'},{status:502});}
}
// Download: the message must be readable by this member (RLS) and actually reference the file.
export async function GET(request:Request){
 const me=await zarnMember();if(!me)return new Response('Sign in first.',{status:401});
 const u=new URL(request.url),fid=u.searchParams.get('f')??'',mid=u.searchParams.get('m')??'',i=Number(u.searchParams.get('i'));
 let att:{key:string;name:string;type:string}|undefined;
 if(fid){
  // A personal file: row-level security only returns it to its owner and the people it was shared with.
  if(!uuid.test(fid))return new Response('Invalid request',{status:400});
  const {data:row}=await me.db.from('zarn_files').select('key,name,type').eq('id',fid).maybeSingle();
  att=row??undefined;
  if(!att?.key?.startsWith('private/zarn/'))return new Response('Not found',{status:404});
 }else{
  if(!uuid.test(mid)||!Number.isInteger(i)||i<0)return new Response('Invalid request',{status:400});
  const {data:msg}=await me.db.from('zarn_messages').select('attachments,deleted_at').eq('id',mid).maybeSingle();
  att=(msg?.attachments as {key:string;name:string;type:string}[]|undefined)?.[i];
  if(!msg||msg.deleted_at||!att?.key?.startsWith('private/zarn/'))return new Response('Not found',{status:404});
 }
 try{
  const f=await getPrivate(att.key);const inline=inlineTypes.includes(f.type)&&u.searchParams.get('download')!=='1';
  return new Response(f.body,{headers:{'Content-Type':f.type,'Content-Disposition':`${inline?'inline':'attachment'}; filename="${att.name.replace(/"/g,'')}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=3600','Content-Security-Policy':f.type==='application/pdf'?"frame-ancestors 'self'":"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"}});
 }catch{return new Response('File unavailable',{status:502});}
}
// Delete one of your own files (the stored copy goes too). Copies already posted in chats are separate messages.
export async function DELETE(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const me=await zarnMember();if(!me)return Response.json({error:'Sign in first.'},{status:401});
 const fid=new URL(request.url).searchParams.get('f')??'';if(!uuid.test(fid))return Response.json({error:'Invalid request'},{status:400});
 const {data:row}=await me.db.from('zarn_files').select('key').eq('id',fid).maybeSingle();
 if(!row)return Response.json({error:'File not found.'},{status:404});
 const {error,count:gone}=await me.db.from('zarn_files').delete({count:'exact'}).eq('id',fid);
 if(error||!gone)return Response.json({error:'Could not delete it.'},{status:502});
 // Keep the stored copy if a chat message still points at it.
 const {count}=await me.db.from('zarn_messages').select('id',{count:'exact',head:true}).contains('attachments',[{key:row.key}]);
 const {count:copies}=await serviceClient().from('zarn_files').select('id',{count:'exact',head:true}).eq('key',row.key);
 if(!count&&!copies)await deleteFile(row.key).catch(()=>{});
 return Response.json({ok:true});
}
