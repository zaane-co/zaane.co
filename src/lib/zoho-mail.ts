import 'server-only';
import {serviceClient} from '@/lib/supabase/server';
import {encrypt,decrypt} from '@/lib/vault';
// Zoho Mail for ZARN. Each person connects their own mailbox once; the refresh token is stored encrypted and
// never reaches the browser. Zoho runs separate data centres, so every call goes to the host saved at connect time.
export const SCOPES='ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.ALL';
export const zohoReady=()=>!!(process.env.ZOHO_CLIENT_ID&&process.env.ZOHO_CLIENT_SECRET&&process.env.VAULT_KEY);
export const redirectUri=(origin:string)=>process.env.ZOHO_REDIRECT_URI||`${origin}/api/zarn/zoho/callback`;
// Only real Zoho login servers (accounts.zoho.com, accounts.zoho.eu, accounts.zohocloud.ca and so on).
export const okServer=(s:string)=>/^https:\/\/accounts\.zoho(cloud)?\.[a-z]{2,4}(\.[a-z]{2})?$/.test(s);
export const mailHostOf=(server:string)=>server.replace('https://accounts.','https://mail.');

export type MailAccount={user_id:string;zoho_account_id:string;email:string;display_name:string;accounts_server:string;mail_host:string;refresh_token:string;access_token:string|null;access_expires_at:string|null};

async function tokenCall(server:string,params:Record<string,string>){
 const body=new URLSearchParams({client_id:process.env.ZOHO_CLIENT_ID!,client_secret:process.env.ZOHO_CLIENT_SECRET!,...params});
 const r=await fetch(`${server}/oauth/v2/token`,{method:'POST',body,cache:'no-store'});
 const j=await r.json().catch(()=>({})) as {access_token?:string;refresh_token?:string;expires_in?:number;error?:string};
 if(!j.access_token)throw new Error(j.error==='invalid_code'?'That Zoho sign-in expired. Try connecting again.':'Zoho would not sign you in. Try connecting again.');
 return j;
}
export const exchangeCode=(server:string,code:string,redirect:string)=>tokenCall(server,{grant_type:'authorization_code',code,redirect_uri:redirect});

export async function getAccount(userId:string){
 const {data}=await serviceClient().from('zarn_mail_accounts').select('*').eq('user_id',userId).maybeSingle();
 return data as MailAccount|null;
}
// A working access token: the saved one while it lasts, otherwise a fresh one from the refresh token.
async function accessToken(a:MailAccount){
 if(a.access_token&&a.access_expires_at&&new Date(a.access_expires_at).getTime()>Date.now()+120_000)return decrypt(a.access_token);
 const j=await tokenCall(a.accounts_server,{grant_type:'refresh_token',refresh_token:decrypt(a.refresh_token)}).catch(()=>null);
 if(!j?.access_token)throw new MailError('Your Zoho connection has expired. Connect Zoho Mail again.',401);
 const exp=new Date(Date.now()+(j.expires_in??3600)*1000).toISOString();
 await serviceClient().from('zarn_mail_accounts').update({access_token:encrypt(j.access_token),access_expires_at:exp}).eq('user_id',a.user_id);
 a.access_token=encrypt(j.access_token);a.access_expires_at=exp;
 return j.access_token;
}
export class MailError extends Error{constructor(m:string,public status=502){super(m);}}

// A call to the Zoho Mail API for this person's mailbox. `path` starts after /api/accounts/{accountId}.
export async function zoho<T=unknown>(a:MailAccount,path:string,init?:{method?:string;json?:unknown;form?:FormData;raw?:boolean}){
 const tok=await accessToken(a);
 const r=await fetch(`${a.mail_host}/api/accounts/${a.zoho_account_id}${path}`,{method:init?.method??'GET',cache:'no-store',
  headers:{Authorization:`Zoho-oauthtoken ${tok}`,...(init?.json?{'Content-Type':'application/json'}:{})},body:init?.form??(init?.json?JSON.stringify(init.json):undefined)});
 if(init?.raw){if(!r.ok)throw new MailError('Could not get that file from Zoho.');return r as unknown as T;}
 const j=await r.json().catch(()=>null) as {data?:T;status?:{code?:number;description?:string}}|null;
 if(!r.ok||!j||(j.status?.code&&j.status.code>=300)){
  if(r.status===401)throw new MailError('Your Zoho connection has expired. Connect Zoho Mail again.',401);
  throw new MailError(j?.status?.description?`Zoho: ${j.status.description}`:'Zoho Mail did not respond. Try again.');
 }
 return j.data as T;
}
// The mailbox list right after sign-in, before the account id is known.
export async function firstAccount(host:string,token:string){
 const r=await fetch(`${host}/api/accounts`,{headers:{Authorization:`Zoho-oauthtoken ${token}`},cache:'no-store'});
 const j=await r.json().catch(()=>null) as {data?:{accountId:string;primaryEmailAddress:string;displayName?:string}[]}|null;
 const acc=j?.data?.[0];if(!acc)throw new Error('No Zoho Mail mailbox was found for that login.');
 return acc;
}
