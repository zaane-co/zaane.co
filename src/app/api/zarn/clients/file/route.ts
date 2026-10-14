import {zarnMember} from '@/lib/zarn-server';
import {clientAccess} from '@/lib/zarn-clients';
import {getPrivate} from '@/lib/r2';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Client material files, for people on that client's team (or Studio admins).
export async function GET(request:Request){
 const me=await zarnMember();if(!me)return new Response('Sign in first.',{status:401});
 const mid=new URL(request.url).searchParams.get('id')??'';if(!uuid.test(mid))return new Response('Invalid request',{status:400});
 const {serviceClient}=await import('@/lib/supabase/server');
 const {data:m}=await serviceClient().from('lead_materials').select('lead_id,file_key,file_name').eq('id',mid).maybeSingle();
 if(!m?.file_key)return new Response('Not found',{status:404});
 const {allowed}=await clientAccess(me,m.lead_id);if(!allowed)return new Response('Not found',{status:404});
 try{const f=await getPrivate(m.file_key);return new Response(f.body,{headers:{'Content-Type':f.type,'Content-Disposition':`attachment; filename="${m.file_name.replace(/"/g,'')}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});}
 catch{return new Response('File unavailable',{status:502});}
}
