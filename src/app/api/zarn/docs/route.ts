import {z} from 'zod';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {hashPassword,newToken} from '@/lib/doc-share';
import {siteUrl} from '@/lib/newsletter';
// Sharing for documents. Only the owner can change who has access or manage links.
const id=z.uuid();
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('share'),id,visibility:z.enum(['private','team']),team_role:z.enum(['view','edit']),lead_id:id.nullable(),members:z.array(z.object({user_id:id,role:z.enum(['view','edit'])})).max(300)}),
 z.object({action:z.literal('links'),id}),
 z.object({action:z.literal('link_create'),id,password:z.string().min(4).max(100).optional(),days:z.number().int().min(1).max(365).nullable().optional()}),
 z.object({action:z.literal('link_revoke'),link_id:id}),
]);
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me)return fail('Sign in first.',401);
 if(me.account_type==='guest')return fail('Guests can’t share documents.',403);
 const parsed=actions.safeParse(await request.json().catch(()=>null));if(!parsed.success)return fail('Invalid request');
 const b=parsed.data,db=serviceClient();
 const owns=async(docId:string)=>{const {data}=await db.from('zarn_docs').select('id').eq('id',docId).eq('owner_id',me.user_id).maybeSingle();return !!data;};
 if(b.action==='link_revoke'){
  const {data:l}=await db.from('zarn_doc_links').select('doc_id').eq('id',b.link_id).maybeSingle();
  if(!l||!await owns(l.doc_id))return fail('Not found.',404);
  await db.from('zarn_doc_links').update({revoked_at:new Date().toISOString()}).eq('id',b.link_id);
  return Response.json({ok:true});
 }
 if(!await owns(b.id))return fail('Only the owner can do that.',403);
 if(b.action==='share'){
  const {error}=await db.from('zarn_docs').update({visibility:b.visibility,team_role:b.team_role,lead_id:b.lead_id}).eq('id',b.id);
  if(error)return fail('Could not save sharing.');
  const {data:active}=await db.from('zarn_members').select('user_id').in('user_id',b.members.map(m=>m.user_id)).is('deactivated_at',null);
  const ok=new Set((active??[]).map(a=>a.user_id));
  await db.from('zarn_doc_members').delete().eq('doc_id',b.id);
  const rows=b.members.filter(m=>ok.has(m.user_id)&&m.user_id!==me.user_id).map(m=>({doc_id:b.id,user_id:m.user_id,role:m.role}));
  if(rows.length)await db.from('zarn_doc_members').insert(rows);
  return Response.json({ok:true});
 }
 if(b.action==='links'){
  const {data}=await db.from('zarn_doc_links').select('id,token,password_hash,expires_at,views,created_at').eq('doc_id',b.id).is('revoked_at',null).order('created_at',{ascending:false});
  return Response.json({links:(data??[]).map(l=>({id:l.id,url:`${siteUrl()}/doc/${l.token}`,protected:!!l.password_hash,expires_at:l.expires_at,views:l.views,created_at:l.created_at}))});
 }
 // link_create
 const token=newToken();
 const expires_at=b.days?new Date(Date.now()+b.days*86400_000).toISOString():null;
 const {data,error}=await db.from('zarn_doc_links').insert({doc_id:b.id,token,password_hash:b.password?hashPassword(b.password):null,expires_at,created_by:me.user_id}).select('id').single();
 if(error||!data)return fail('Could not create the link.');
 return Response.json({link:{id:data.id,url:`${siteUrl()}/doc/${token}`,protected:!!b.password,expires_at,views:0,created_at:new Date().toISOString()}});
}
