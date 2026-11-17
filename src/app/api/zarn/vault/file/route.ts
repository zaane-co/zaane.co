import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {clientAccess} from '@/lib/zarn-clients';
import {getPrivate,putPrivate,r2Configured} from '@/lib/r2';
import {decryptBytes,encryptBytes,vaultReady} from '@/lib/vault';
// Secret files (an .env file, a certificate, a key). The file is encrypted before it is stored and decrypted only for people
// on this client's team or admins. Every download is logged.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX=4*1024*1024;
// A vault is a client's (that client's team and admins) or a project's (its members and ZARN admins).
async function allowed(me:NonNullable<Awaited<ReturnType<typeof zarnMember>>>,w:{lead_id?:string|null;project_id?:string|null}){
 if(w.lead_id)return (await clientAccess(me,w.lead_id)).allowed;
 if(!w.project_id)return false;if(me.zarnAdmin)return true;
 const {data}=await serviceClient().from('zarn_project_members').select('user_id').eq('project_id',w.project_id).eq('user_id',me.user_id).maybeSingle();return !!data;
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const me=await zarnMember();if(!me||me.account_type==='guest')return Response.json({error:'Sign in first.'},{status:401});
 if(!vaultReady()||!r2Configured())return Response.json({error:'The vault isn’t set up yet.'},{status:503});
 const form=await request.formData(),file=form.get('file'),lead=String(form.get('lead_id')??''),project=String(form.get('project_id')??''),label=String(form.get('label')??'').trim().slice(0,120),note=String(form.get('note')??'').trim().slice(0,2000);
 if(!(file instanceof File)||(uuid.test(lead)===uuid.test(project)))return Response.json({error:'Choose a file.'},{status:400});
 if(file.size>MAX)return Response.json({error:'Files must be under 4 MB.'},{status:400});
 const w=uuid.test(lead)?{lead_id:lead}:{project_id:project};
 if(!(await allowed(me,w)))return Response.json({error:'No access.'},{status:403});
 const name=file.name.replace(/[^\w.\- ]+/g,'').slice(-120)||'file';
 try{
  const key=await putPrivate(`vault/${lead||`project-${project}`}/${crypto.randomUUID()}.bin`,encryptBytes(Buffer.from(await file.arrayBuffer())),'application/octet-stream','secret.bin');
  const db=serviceClient();
  const {data,error}=await db.from('zarn_vault_items').insert({...w,kind:'file',label:label||name,note,file_key:key,file_name:name,file_size:file.size,created_by:me.user_id}).select('id,label').single();
  if(error||!data)throw new Error();
  await db.from('zarn_vault_log').insert({...w,item_id:data.id,item_label:data.label,user_id:me.user_id,action:'create'});
  return Response.json({ok:true});
 }catch{return Response.json({error:'Could not save the file.'},{status:502});}
}
export async function GET(request:Request){
 const me=await zarnMember();if(!me||me.account_type==='guest')return new Response('Sign in first.',{status:401});
 const id=new URL(request.url).searchParams.get('id')??'';if(!uuid.test(id)||!vaultReady())return new Response('Not found',{status:404});
 const db=serviceClient();
 const {data:it}=await db.from('zarn_vault_items').select('id,lead_id,project_id,label,kind,file_key,file_name').eq('id',id).maybeSingle();
 if(!it||it.kind!=='file'||!it.file_key||!(await allowed(me,it)))return new Response('Not found',{status:404});
 try{
  const f=await getPrivate(it.file_key);
  const buf=Buffer.from(await new Response(f.body).arrayBuffer());
  await db.from('zarn_vault_log').insert({lead_id:it.lead_id,item_id:it.id,item_label:it.label,user_id:me.user_id,action:'download'});
  return new Response(new Uint8Array(decryptBytes(buf)),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${it.file_name.replace(/"/g,'')}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('This file can’t be decrypted.',{status:500});}
}
