import {zarnMember} from '@/lib/zarn-server';
import {getPrivate,putPrivate,r2Configured} from '@/lib/r2';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Vercel caps request bodies at 4.5 MB; images are shrunk in the browser first.
const MAX=4*1024*1024;
const blocked=/\.(html?|svg|js|mjs|xhtml|xml|exe|bat|cmd|sh|msi|dmg|app|php)$/i;
const inlineTypes=['image/jpeg','image/png','image/webp','image/gif','image/avif','application/pdf'];
// Upload a file into a channel the member belongs to. The message that references it is posted by the client.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const me=await zarnMember();if(!me)return Response.json({error:'Sign in first.'},{status:401});
 if(!r2Configured())return Response.json({error:'File storage isn’t configured.'},{status:503});
 const form=await request.formData();const channel=String(form.get('channel_id')??''),file=form.get('file');
 if(!uuid.test(channel)||!(file instanceof File))return Response.json({error:'Invalid request'},{status:400});
 if(file.size>MAX)return Response.json({error:'Files must be under 4 MB.'},{status:400});
 if(blocked.test(file.name))return Response.json({error:'That file type isn’t allowed.'},{status:400});
 const {data:inCh}=await me.db.from('zarn_channel_members').select('channel_id').eq('channel_id',channel).eq('user_id',me.user_id).maybeSingle();
 if(!inCh)return Response.json({error:'Join the channel first.'},{status:403});
 const name=file.name.replace(/[^\w.\- ]+/g,'').slice(-120)||'file';
 try{
  const key=await putPrivate(`zarn/${channel}/${crypto.randomUUID()}-${name.replace(/\s+/g,'-')}`,new Uint8Array(await file.arrayBuffer()),file.type||'application/octet-stream',name);
  return Response.json({key,name,size:file.size,type:file.type||'application/octet-stream'});
 }catch{return Response.json({error:'Upload failed. Try again.'},{status:502});}
}
// Download: the message must be readable by this member (RLS) and actually reference the file.
export async function GET(request:Request){
 const me=await zarnMember();if(!me)return new Response('Sign in first.',{status:401});
 const u=new URL(request.url),mid=u.searchParams.get('m')??'',i=Number(u.searchParams.get('i'));
 if(!uuid.test(mid)||!Number.isInteger(i)||i<0)return new Response('Invalid request',{status:400});
 const {data:msg}=await me.db.from('zarn_messages').select('attachments,deleted_at').eq('id',mid).maybeSingle();
 const att=(msg?.attachments as {key:string;name:string;type:string}[]|undefined)?.[i];
 if(!msg||msg.deleted_at||!att?.key?.startsWith('private/zarn/'))return new Response('Not found',{status:404});
 try{
  const f=await getPrivate(att.key);const inline=inlineTypes.includes(f.type)&&u.searchParams.get('download')!=='1';
  return new Response(f.body,{headers:{'Content-Type':f.type,'Content-Disposition':`${inline?'inline':'attachment'}; filename="${att.name.replace(/"/g,'')}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=3600','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"}});
 }catch{return new Response('File unavailable',{status:502});}
}
