import {cookies} from 'next/headers';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {encrypt} from '@/lib/vault';
import {exchangeCode,firstAccount,mailHostOf,okServer,redirectUri} from '@/lib/zoho-mail';
// Step 2: Zoho sends the person back here with a one-time code. Swap it for tokens, find their mailbox, save it.
export async function GET(request:Request){
 const url=new URL(request.url),origin=url.origin,back=(e?:string)=>Response.redirect(`${origin}/zarn/mail${e?`?error=${e}`:''}`);
 const me=await zarnMember();if(!me||me.account_type==='guest')return Response.redirect(`${origin}/zarn`);
 const jar=await cookies(),state=jar.get('zarn_zoho_state')?.value;jar.delete({name:'zarn_zoho_state',path:'/api/zarn/zoho'});
 const code=url.searchParams.get('code'),server=url.searchParams.get('accounts-server')||'https://accounts.zoho.com';
 if(url.searchParams.get('error'))return back('denied');
 if(!code||!state||state!==url.searchParams.get('state')||!okServer(server))return back('expired');
 try{
  const tok=await exchangeCode(server,code,redirectUri(origin));
  if(!tok.refresh_token)return back('expired');
  const host=mailHostOf(server),acc=await firstAccount(host,tok.access_token!);
  const {error}=await serviceClient().from('zarn_mail_accounts').upsert({user_id:me.user_id,zoho_account_id:String(acc.accountId),email:acc.primaryEmailAddress,display_name:acc.displayName??'',
   accounts_server:server,mail_host:host,refresh_token:encrypt(tok.refresh_token),access_token:encrypt(tok.access_token!),access_expires_at:new Date(Date.now()+(tok.expires_in??3600)*1000).toISOString()},{onConflict:'user_id'});
  if(error)return back('save');
  return back();
 }catch{return back('zoho');}
}
