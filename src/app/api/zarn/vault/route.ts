import {z} from 'zod';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {clientAccess} from '@/lib/zarn-clients';
import {decrypt,encrypt,vaultReady} from '@/lib/vault';
import {hashPassword,newToken} from '@/lib/doc-share';
import {siteUrl} from '@/lib/newsletter';
// A client's vault of logins. Only that client's team and admins can use it, passwords are encrypted before they are stored,
// and every reveal, copy, edit and delete is logged. Passwords are never returned in a list.
const id=z.uuid();
const kinds=z.enum(['login','api','env']);
const field={label:z.string().trim().min(1).max(120),url:z.string().trim().max(500).default(''),username:z.string().trim().max(300).default(''),note:z.string().trim().max(2000).default('')};
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('list'),lead_id:id}),
 z.object({action:z.literal('create'),lead_id:id,kind:kinds.default('login'),...field,secret:z.string().max(20000).default('')}),
 z.object({action:z.literal('update'),id,...field,secret:z.string().max(20000).optional()}),
 z.object({action:z.literal('share_create'),lead_id:id,item_ids:z.array(id).min(1).max(40),label:z.string().trim().max(120).default(''),password:z.string().min(6).max(100),hours:z.number().int().min(1).max(720),view_once:z.boolean().default(false)}),
 z.object({action:z.literal('share_list'),lead_id:id}),
 z.object({action:z.literal('share_revoke'),id}),
 z.object({action:z.literal('delete'),id}),
 z.object({action:z.literal('reveal'),id,purpose:z.enum(['view','copy']).default('view')}),
 z.object({action:z.literal('log'),lead_id:id}),
]);
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me)return fail('Sign in first.',401);
 if(me.account_type==='guest')return fail('Guests can’t use the vault.',403);
 if(!vaultReady())return fail('The vault isn’t set up yet. An admin needs to add the VAULT_KEY setting.',503);
 const parsed=actions.safeParse(await request.json().catch(()=>null));if(!parsed.success)return fail(parsed.error.issues[0]?.message||'Invalid request');
 const b=parsed.data,db=serviceClient();
 const admin=me.staffRole==='super_admin'||me.staffRole==='admin';
 const log=(lead_id:string,item_id:string|null,item_label:string,action:'create'|'update'|'delete'|'reveal'|'copy'|'share_create'|'share_revoke')=>db.from('zarn_vault_log').insert({lead_id,item_id,item_label,user_id:me.user_id,action});
 // Items are always checked against the client they belong to, not just the id.
 const load=async(itemId:string)=>{const {data}=await db.from('zarn_vault_items').select('*').eq('id',itemId).maybeSingle();if(!data)return null;const {allowed}=await clientAccess(me,data.lead_id);return allowed?data:null;};
 const safe=(r:Record<string,unknown>)=>({id:r.id,kind:r.kind,file_name:r.file_name,file_size:r.file_size,label:r.label,url:r.url,username:r.username,note:r.note,has_secret:!!r.secret_enc,created_by:r.created_by,updated_at:r.updated_at});

 if(b.action==='list'||b.action==='log'||b.action==='create'||b.action==='share_create'||b.action==='share_list'){
  const {allowed}=await clientAccess(me,b.lead_id);if(!allowed)return fail('You don’t have access to this client.',403);
  if(b.action==='list'){
   const {data}=await db.from('zarn_vault_items').select('*').eq('lead_id',b.lead_id).order('label');
   return Response.json({items:(data??[]).map(safe),admin});
  }
  if(b.action==='log'){
   if(!admin)return fail('Only admins can see the activity.',403);
   const {data}=await db.from('zarn_vault_log').select('id,item_label,user_id,action,at').eq('lead_id',b.lead_id).order('at',{ascending:false}).limit(30);
   return Response.json({log:data??[]});
  }
  if(b.action==='share_list'){
   const {data}=await db.from('zarn_vault_shares').select('id,label,expires_at,view_once,opened_at,revoked_at,created_by,created_at').eq('lead_id',b.lead_id).order('created_at',{ascending:false}).limit(20);
   return Response.json({shares:data??[]});
  }
  if(b.action==='share_create'){
   // Only items of this client can go in a link.
   const {data:its}=await db.from('zarn_vault_items').select('id,label').eq('lead_id',b.lead_id).in('id',b.item_ids);
   if(!its?.length)return fail('Choose at least one item to share.');
   const token=newToken(),expires_at=new Date(Date.now()+b.hours*3600_000).toISOString();
   const {data:sh,error:e}=await db.from('zarn_vault_shares').insert({lead_id:b.lead_id,token,label:b.label,password_hash:hashPassword(b.password),expires_at,view_once:b.view_once,created_by:me.user_id}).select('id').single();
   if(e||!sh)return fail('Could not create the link.');
   await db.from('zarn_vault_share_items').insert(its.map(i=>({share_id:sh.id,item_id:i.id})));
   await log(b.lead_id,null,`${its.length} item${its.length===1?'':'s'} for the client`,'share_create');
   return Response.json({share:{id:sh.id,url:`${siteUrl()}/vault/${token}`,expires_at}});
  }
  const {data,error}=await db.from('zarn_vault_items').insert({lead_id:b.lead_id,kind:b.kind,label:b.label,url:b.url,username:b.username,note:b.note,secret_enc:b.secret?encrypt(b.secret):'',created_by:me.user_id}).select('*').single();
  if(error||!data)return fail('Could not save the login.');
  await log(b.lead_id,data.id,data.label,'create');
  return Response.json({item:safe(data)});
 }
 if(b.action==='share_revoke'){
  const {data:sh}=await db.from('zarn_vault_shares').select('id,lead_id,label').eq('id',b.id).maybeSingle();
  if(!sh||!(await clientAccess(me,sh.lead_id)).allowed)return fail('Not found.',404);
  await db.from('zarn_vault_shares').update({revoked_at:new Date().toISOString()}).eq('id',sh.id);
  await log(sh.lead_id,null,sh.label||'a client link','share_revoke');
  return Response.json({ok:true});
 }
 const item=await load(b.id);if(!item)return fail('That login isn’t available.',404);
 if(b.action==='reveal'){
  if(!item.secret_enc)return Response.json({secret:''});
  let secret='';try{secret=decrypt(item.secret_enc);}catch{return fail('This password can’t be decrypted. The vault key may have changed.',500);}
  await log(item.lead_id,item.id,item.label,b.purpose==='copy'?'copy':'reveal');
  return Response.json({secret},{headers:{'Cache-Control':'no-store'}});
 }
 if(b.action==='update'){
  if(item.created_by!==me.user_id&&!admin)return fail('Only the person who added this login, or an admin, can change it.',403);
  const patch:Record<string,unknown>={label:b.label,url:b.url,username:b.username,note:b.note,updated_at:new Date().toISOString()};
  if(b.secret!==undefined)patch.secret_enc=b.secret?encrypt(b.secret):'';
  const {data,error}=await db.from('zarn_vault_items').update(patch).eq('id',item.id).select('*').single();
  if(error||!data)return fail('Could not save the login.');
  await log(item.lead_id,item.id,b.label,'update');
  return Response.json({item:safe(data)});
 }
 // delete
 if(item.created_by!==me.user_id&&!admin)return fail('Only the person who added this login, or an admin, can delete it.',403);
 await db.from('zarn_vault_items').delete().eq('id',item.id);
 await log(item.lead_id,null,item.label,'delete');
 return Response.json({ok:true});
}
