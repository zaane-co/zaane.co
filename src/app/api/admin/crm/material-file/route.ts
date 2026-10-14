import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import {deleteFile,getPrivate,putPrivate,r2Configured} from '@/lib/r2';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Vercel caps request bodies at 4.5 MB; bigger files go in as a link (Drive, WeTransfer) on the item instead.
const MAX=4*1024*1024;
// Anything a browser could execute is refused, even though files are always downloaded as attachments.
const blocked=/\.(html?|svg|js|mjs|xhtml|xml|exe|bat|cmd|sh|msi|dmg|app|php)$/i;
async function access(){const user=await staff();return user&&allowed('leads',user.role)?user:null;}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 if(!await access())return Response.json({error:'Access denied'},{status:403});
 if(!r2Configured())return Response.json({error:'File storage isn’t configured. Add a link instead.'},{status:503});
 const form=await request.formData();const id=String(form.get('id')??''),file=form.get('file');
 if(!uuid.test(id)||!(file instanceof File))return Response.json({error:'Invalid request'},{status:400});
 if(file.size>MAX)return Response.json({error:'Files must be under 4 MB. For bigger files, paste a Drive or WeTransfer link.'},{status:400});
 if(blocked.test(file.name))return Response.json({error:'That file type isn’t allowed.'},{status:400});
 const db=await sessionClient();
 const {data:m}=await db.from('lead_materials').select('lead_id,file_key').eq('id',id).single();
 if(!m)return Response.json({error:'Item not found.'},{status:404});
 const name=file.name.replace(/[^\w.\- ]+/g,'').slice(-120)||'file';
 try{
  const key=await putPrivate(`materials/${m.lead_id}/${crypto.randomUUID()}-${name.replace(/\s+/g,'-')}`,new Uint8Array(await file.arrayBuffer()),file.type||'application/octet-stream',name);
  const {error}=await db.from('lead_materials').update({file_key:key,file_name:name,received_at:new Date().toISOString()}).eq('id',id);
  if(error){await deleteFile(key).catch(()=>{});throw error;}
  if(m.file_key)await deleteFile(m.file_key).catch(()=>{});
  return Response.json({ok:true});
 }catch{return Response.json({error:'Upload failed. Try again.'},{status:502});}
}
export async function GET(request:Request){
 if(!await access())return new Response('Access denied',{status:403});
 const id=new URL(request.url).searchParams.get('id')??'';if(!uuid.test(id))return new Response('Invalid request',{status:400});
 const db=await sessionClient();
 const {data:m}=await db.from('lead_materials').select('file_key,file_name').eq('id',id).single();
 if(!m?.file_key)return new Response('Not found',{status:404});
 try{const f=await getPrivate(m.file_key);return new Response(f.body,{headers:{'Content-Type':f.type,'Content-Disposition':`attachment; filename="${m.file_name.replace(/"/g,'')}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});}
 catch{return new Response('File unavailable',{status:502});}
}
