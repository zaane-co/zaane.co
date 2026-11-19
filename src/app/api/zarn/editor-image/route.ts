import {cookies} from 'next/headers';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {clientAccess} from '@/lib/zarn-clients';
import {getPrivate,putPrivate,r2Configured} from '@/lib/r2';
import {cookieName,verifyUnlock} from '@/lib/doc-share';
// Pictures pasted into a client brief or a document. They are stored privately and only served to people who can read that brief or
// document (or to someone holding a valid, unlocked share link for the document).
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const types:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
const MAX=4*1024*1024;
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const me=await zarnMember();if(!me)return Response.json({error:'Sign in first.'},{status:401});
 if(me.account_type==='guest')return Response.json({error:'Guests can’t add pictures.'},{status:403});
 if(!r2Configured())return Response.json({error:'File storage isn’t configured.'},{status:503});
 const form=await request.formData(),file=form.get('file'),scope=String(form.get('scope')??''),id=String(form.get('id')??'');
 if(!(file instanceof File)||!types[file.type]||!uuid.test(id)||!['lead','doc'].includes(scope))return Response.json({error:'Choose a JPG, PNG, WebP or GIF picture.'},{status:400});
 if(file.size>MAX)return Response.json({error:'Pictures must be under 4 MB.'},{status:400});
 if(scope==='lead'){const {allowed}=await clientAccess(me,id);if(!allowed)return Response.json({error:'No access.'},{status:403});}
 else{const {data:role}=await me.db.rpc('zarn_doc_role',{d:id});if(role!=='owner'&&role!=='edit')return Response.json({error:'You can’t edit this document.'},{status:403});}
 try{
  const key=await putPrivate(`brief/${scope}/${id}/${crypto.randomUUID()}.${types[file.type]}`,new Uint8Array(await file.arrayBuffer()),file.type,`picture.${types[file.type]}`);
  return Response.json({url:`/api/zarn/editor-image?k=${encodeURIComponent(key)}`});
 }catch{return Response.json({error:'Upload failed. Try again.'},{status:502});}
}
export async function GET(request:Request){
 const u=new URL(request.url),key=u.searchParams.get('k')??'',token=u.searchParams.get('t')??'';
 const m=key.match(/^private\/brief\/(lead|doc)\/([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp|gif)$/i);
 if(!m||!uuid.test(m[2]!))return new Response('Not found',{status:404});
 const scope=m[1]!,id=m[2]!;
 let ok=false;
 if(token){
  // A shared document link: the link must be valid, belong to this document and (if protected) be unlocked.
  if(scope==='doc'&&/^[A-Za-z0-9_-]{20,60}$/.test(token)){
   const {data:l}=await serviceClient().from('zarn_doc_links').select('doc_id,password_hash,expires_at,revoked_at').eq('token',token).maybeSingle();
   ok=!!l&&l.doc_id===id&&!l.revoked_at&&!(l.expires_at&&new Date(l.expires_at)<new Date())&&(!l.password_hash||verifyUnlock(token,(await cookies()).get(cookieName(token))?.value));
  }
 }else{
  const me=await zarnMember();
  if(me){
   if(scope==='lead')ok=(await clientAccess(me,id)).allowed;
   else{const {data:role}=await me.db.rpc('zarn_doc_role',{d:id});ok=!!role;}
  }
 }
 if(!ok)return new Response('Not found',{status:404});
 try{
  const f=await getPrivate(key);
  return new Response(f.body,{headers:{'Content-Type':f.type,'Content-Disposition':'inline','X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=3600','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"}});
 }catch{return new Response('Not found',{status:404});}
}
