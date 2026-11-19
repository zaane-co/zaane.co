import {z} from 'zod';
import {serviceClient,sessionClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {hashPassword,newToken} from '@/lib/doc-share';
// Share links always point at the live site, even when ZARN runs locally (same database, so they work there).
const siteUrl=()=>(process.env.NEXT_PUBLIC_SHARE_URL||'https://zaane.co').replace(/\/$/,'');
import {pushTo} from '@/lib/zarn-push';
// Sharing for documents. Only the owner can change who has access or manage links.
const id=z.uuid();
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('share'),id,visibility:z.enum(['private','team']),team_role:z.enum(['view','edit']),lead_id:id.nullable(),members:z.array(z.object({user_id:id,role:z.enum(['view','edit'])})).max(300)}),
 z.object({action:z.literal('links'),id}),
 z.object({action:z.literal('resolve'),token:z.string().min(8).max(200)}),
 z.object({action:z.literal('folder_notify'),folder_id:id,users:z.array(id).max(100)}),
 z.object({action:z.literal('link_create'),id,password:z.string().min(4).max(100).optional(),days:z.number().int().min(1).max(365).nullable().optional()}),
 z.object({action:z.literal('link_revoke'),link_id:id}),
 // One link per document, Google style: turn it on or off, and change its expiry or password without changing the URL.
 z.object({action:z.literal('link_set'),id,on:z.boolean(),days:z.number().int().min(0).max(365).optional(),password:z.string().min(4).max(100).optional(),clear_password:z.boolean().optional()}),
]);
const fail=(error:string,status=400)=>Response.json({error},{status});
// Like Google's share email: a direct message from the person sharing, with the link (chat shows it as a Drive card).
type Me=NonNullable<Awaited<ReturnType<typeof zarnMember>>>;
async function tellInChat(me:Me,to:{user_id:string;role:string}[],what:string,name:string,path:string){
 const label:Record<string,string>={view:'a Viewer',edit:'an Editor',manage:'a Manager'};
 for(const p of to){
  try{
   const {data:dm}=await me.db.rpc('zarn_open_dm',{others:[p.user_id]});if(!dm)continue;
   await me.db.from('zarn_messages').insert({channel_id:dm,user_id:me.user_id,body:`I shared the ${what} “${name}” with you as ${label[p.role]??'a Viewer'}.\n${siteUrl()}${path}`});
  }catch{}
 }
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me)return fail('Sign in first.',401);
 if(me.account_type==='guest')return fail('Guests can’t share documents.',403);
 const parsed=actions.safeParse(await request.json().catch(()=>null));if(!parsed.success)return fail('Invalid request');
 const b=parsed.data,db=serviceClient();
 // Like Google Docs, the owner and editors can share. Viewers can't.
 const owns=async(docId:string)=>{const ses=await sessionClient();const {data}=await ses.rpc('zarn_doc_role',{d:docId});return data==='owner'||data==='edit';};
 if(b.action==='link_revoke'){
  const {data:l}=await db.from('zarn_doc_links').select('doc_id').eq('id',b.link_id).maybeSingle();
  if(!l||!await owns(l.doc_id))return fail('Not found.',404);
  await db.from('zarn_doc_links').update({revoked_at:new Date().toISOString()}).eq('id',b.link_id);
  return Response.json({ok:true});
 }
 // Tell people they were just added to a folder. The caller must be able to open the folder, and only people added in the last few minutes are told.
 if(b.action==='folder_notify'){
  const ses=await sessionClient();
  const {data:f}=await ses.from('zarn_drive_folders').select('id,name,drive,lead_id').eq('id',b.folder_id).maybeSingle();
  if(!f)return fail('Not found.',404);
  const {data:rows}=await db.from('zarn_drive_folder_members').select('user_id,role').eq('folder_id',b.folder_id).in('user_id',b.users).gt('created_at',new Date(Date.now()-600_000).toISOString());
  const to=(rows??[]).map(r=>r.user_id).filter(u=>u!==me.user_id);
  const where=f.drive==='team'?'v=team':f.drive==='client'?`v=client&l=${f.lead_id}`:'v=my';
  if(to.length)await pushTo(to,{title:`${me.display_name} shared a folder with you`,body:f.name,tag:`folder-${f.id}`,url:`/zarn/drive?${where}&f=${f.id}`}).catch(()=>0);
  if(to.length)await tellInChat(me,(rows??[]).filter(r=>to.includes(r.user_id)),'folder',f.name,`/zarn/drive?${where}&f=${f.id}`);
  return Response.json({ok:true,notified:to.length});
 }
 // A public link pasted in chat: say which document it is, so the card can show its place in Drive (access is still checked when reading it).
 if(b.action==='resolve'){const {data:l}=await db.from('zarn_doc_links').select('doc_id').eq('token',b.token).is('revoked_at',null).maybeSingle();return Response.json({doc_id:l?.doc_id??null});}
 if(!await owns(b.id))return fail('Only the owner and editors can share this.',403);
 if(b.action==='share'){
  const {error}=await db.from('zarn_docs').update({visibility:b.visibility,team_role:b.team_role,lead_id:b.lead_id}).eq('id',b.id);
  if(error)return fail('Could not save sharing.');
  const {data:active}=await db.from('zarn_members').select('user_id').in('user_id',b.members.map(m=>m.user_id)).is('deactivated_at',null);
  const ok=new Set((active??[]).map(a=>a.user_id));
  const {data:before}=await db.from('zarn_doc_members').select('user_id').eq('doc_id',b.id);
  const had=new Set((before??[]).map(r=>r.user_id));
  const {data:own}=await db.from('zarn_docs').select('owner_id').eq('id',b.id).maybeSingle();
  const rows=b.members.filter(m=>ok.has(m.user_id)&&m.user_id!==own?.owner_id).map(m=>({doc_id:b.id,user_id:m.user_id,role:m.role}));
  const {error:delErr}=await db.from('zarn_doc_members').delete().eq('doc_id',b.id);
  if(delErr)return fail('Could not save sharing.');
  if(rows.length){const {error:insErr}=await db.from('zarn_doc_members').insert(rows);if(insErr)return fail('Could not save sharing.');}
  // Tell people who were just added, the way Google emails them.
  const added=rows.filter(r=>!had.has(r.user_id)).map(r=>r.user_id);
  if(added.length){
   const {data:doc}=await db.from('zarn_docs').select('title,kind').eq('id',b.id).maybeSingle();
   const sheet=doc?.kind==='sheet',form=doc?.kind==='form',what=form?'a form':sheet?'a sheet':'a document';
   await pushTo(added,{title:`${me.display_name} shared ${what} with you`,body:doc?.title||'Untitled',tag:`doc-${b.id}`,url:`/zarn/${form?'forms':sheet?'sheets':'docs'}/${b.id}`}).catch(()=>0);
   await tellInChat(me,rows.filter(r=>added.includes(r.user_id)),form?'form':sheet?'sheet':'document',doc?.title||'Untitled',`/zarn/${form?'forms':sheet?'sheets':'docs'}/${b.id}`);
  }
  return Response.json({ok:true,added:added.length});
 }
 if(b.action==='links'){
  const {data}=await db.from('zarn_doc_links').select('id,token,password_hash,expires_at,views,created_at').eq('doc_id',b.id).is('revoked_at',null).order('created_at',{ascending:false});
  return Response.json({links:(data??[]).map(l=>({id:l.id,url:`${siteUrl()}/doc/${l.token}`,protected:!!l.password_hash,expires_at:l.expires_at,views:l.views,created_at:l.created_at}))});
 }
 if(b.action==='link_set'){
  const {data:cur}=await db.from('zarn_doc_links').select('id,token,password_hash,expires_at,views').eq('doc_id',b.id).is('revoked_at',null).order('created_at',{ascending:false});
  if(!b.on){if(cur?.length)await db.from('zarn_doc_links').update({revoked_at:new Date().toISOString()}).eq('doc_id',b.id).is('revoked_at',null);return Response.json({link:null});}
  const patch:{expires_at?:string|null;password_hash?:string|null}={};
  if(b.days!==undefined)patch.expires_at=b.days?new Date(Date.now()+b.days*86400_000).toISOString():null;
  if(b.password)patch.password_hash=hashPassword(b.password);else if(b.clear_password)patch.password_hash=null;
  const live=(cur??[]).find(l=>!l.expires_at||new Date(l.expires_at)>new Date());
  if(live){
   if(Object.keys(patch).length){const {error}=await db.from('zarn_doc_links').update(patch).eq('id',live.id);if(error)return fail('Could not update the link.');}
   const l={...live,...patch};
   return Response.json({link:{id:l.id,url:`${siteUrl()}/doc/${l.token}`,protected:!!l.password_hash,expires_at:l.expires_at,views:l.views}});
  }
  const token=newToken();
  const {data,error}=await db.from('zarn_doc_links').insert({doc_id:b.id,token,password_hash:patch.password_hash??null,expires_at:patch.expires_at??null,created_by:me.user_id}).select('id').single();
  if(error||!data)return fail('Could not create the link.');
  return Response.json({link:{id:data.id,url:`${siteUrl()}/doc/${token}`,protected:!!patch.password_hash,expires_at:patch.expires_at??null,views:0}});
 }
 // link_create
 const token=newToken();
 const expires_at=b.days?new Date(Date.now()+b.days*86400_000).toISOString():null;
 const {data,error}=await db.from('zarn_doc_links').insert({doc_id:b.id,token,password_hash:b.password?hashPassword(b.password):null,expires_at,created_by:me.user_id}).select('id').single();
 if(error||!data)return fail('Could not create the link.');
 return Response.json({link:{id:data.id,url:`${siteUrl()}/doc/${token}`,protected:!!b.password,expires_at,views:0,created_at:new Date().toISOString()}});
}
