import {z} from 'zod';
import {sessionClient,serviceClient,configured} from '@/lib/supabase/server';
// ZARN's own sign-in. Only active ZARN members get in; staff admin access is separate.
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('login'),email:z.email().max(254),password:z.string().min(1).max(256)}),
 z.object({action:z.literal('password'),password:z.string().min(8,'Use at least 8 characters.').max(256)}),
 z.object({action:z.literal('welcome'),password:z.string().min(8,'Use at least 8 characters.').max(256),display_name:z.string().trim().min(1,'Enter your name.').max(80),title:z.string().trim().max(80)}),
 z.object({action:z.literal('logout')}),
]);
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 const origin=new URL(request.url).origin;
 if(request.headers.get('origin')!==origin)return fail('Invalid origin',403);
 if(!configured())return fail('Sign-in isn’t configured.',503);
 const parsed=actions.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return fail(parsed.error.issues[0]?.message||'Enter your email and password.');
 const b=parsed.data,db=await sessionClient();
 switch(b.action){
  case 'logout':{await db.auth.signOut();return Response.json({ok:true});}
  case 'login':{
   const {error}=await db.auth.signInWithPassword({email:b.email.trim().toLowerCase(),password:b.password});
   if(error)return fail('Sign-in failed. Check your email and password.',401);
   const {data:{user}}=await db.auth.getUser();
   const {data:m}=await db.from('zarn_members').select('deactivated_at,expires_at').eq('user_id',user!.id).maybeSingle();
   const expired=!!m?.expires_at&&new Date(m.expires_at)<=new Date();
   if(!m||m.deactivated_at||expired){await db.auth.signOut();return fail(!m?'You’re not a member of ZARN yet. Ask an admin to invite you.':expired?'Your guest access has expired. Ask an admin to extend it.':'Your ZARN access has been turned off. Ask an admin.',403);}
   await db.from('zarn_members').update({last_seen_at:new Date().toISOString()}).eq('user_id',user!.id);
   return Response.json({ok:true});
  }
  case 'password':
  case 'welcome':{
   const {data:{user}}=await db.auth.getUser();if(!user)return fail('Your link has expired. Ask for a new one.',401);
   const {data:m}=await db.from('zarn_members').select('user_id,joined_at').eq('user_id',user.id).maybeSingle();if(!m)return fail('You’re not a ZARN member.',403);
   const {error}=await db.auth.updateUser({password:b.password});if(error)return fail(error.message);
   if(b.action==='welcome'){
    await db.from('zarn_members').update({display_name:b.display_name,title:b.title,last_seen_at:new Date().toISOString()}).eq('user_id',user.id);
    if(!m.joined_at)await serviceClient().from('zarn_members').update({joined_at:new Date().toISOString()}).eq('user_id',user.id);
   }
   return Response.json({ok:true});
  }
 }
}
