import {sessionClient,configured} from '@/lib/supabase/server';
export async function POST(request:Request){
 const origin=new URL(request.url).origin;
 if(request.headers.get('origin')!==origin)return Response.json({error:'Invalid origin'},{status:403});
 if(!configured())return Response.json({error:'Connect this site to Supabase before signing in.'},{status:503});
 const body=await request.json().catch(()=>null);
 if(!body)return Response.json({error:'Invalid request'},{status:400});
 const db=await sessionClient();
 if(body.action==='logout'){await db.auth.signOut();return Response.json({ok:true});}
 if(body.action==='forgot'){
  if(typeof body.email!=='string'||!body.email||body.email.length>254)return Response.json({error:'Enter your email.'},{status:400});
  const {error}=await db.auth.resetPasswordForEmail(body.email,{redirectTo:`${origin}/admin/auth/callback?next=/admin/reset-password`});
  if(error?.status===429)return Response.json({error:'Too many reset requests. Try again in a little while.'},{status:429});
  return Response.json({ok:true});
 }
 if(body.action==='update'){
  if(typeof body.password!=='string'||body.password.length<8||body.password.length>256)return Response.json({error:'Use at least 8 characters.'},{status:400});
  const {data:{user}}=await db.auth.getUser();
  if(!user)return Response.json({error:'Your reset link has expired. Request a new one.'},{status:401});
  const {error}=await db.auth.updateUser({password:body.password});
  if(error)return Response.json({error:error.message},{status:400});
  return Response.json({ok:true});
 }
 if(typeof body.email!=='string'||typeof body.password!=='string'||body.email.length>254||body.password.length>256)return Response.json({error:'Enter your email and password.'},{status:400});
 const {error}=await db.auth.signInWithPassword({email:body.email,password:body.password});
 if(error)return Response.json({error:'Sign-in failed. Check your credentials and try again.'},{status:401});
 const {data:{user}}=await db.auth.getUser();
 const {data}=await db.from('users').select('role').eq('id',user!.id).single();
 if(!data?.role){await db.auth.signOut();return Response.json({error:'Your account does not have staff access. Contact your administrator.'},{status:403});}
 return Response.json({ok:true});
}
