import {randomBytes} from 'crypto';
import {cookies} from 'next/headers';
import {zarnMember} from '@/lib/zarn-server';
import {SCOPES,redirectUri,zohoReady} from '@/lib/zoho-mail';
// Step 1 of connecting Zoho Mail: send the person to Zoho's sign-in page. A one-time code in a cookie
// proves the reply that comes back belongs to this sign-in.
export async function GET(request:Request){
 const origin=new URL(request.url).origin;
 const me=await zarnMember();if(!me)return Response.redirect(`${origin}/zarn`);
 if(!zohoReady()||me.account_type==='guest')return Response.redirect(`${origin}/zarn/mail?error=setup`);
 const state=randomBytes(18).toString('base64url');
 (await cookies()).set('zarn_zoho_state',state,{httpOnly:true,secure:origin.startsWith('https'),sameSite:'lax',path:'/api/zarn/zoho',maxAge:600});
 const q=new URLSearchParams({scope:SCOPES,client_id:process.env.ZOHO_CLIENT_ID!,response_type:'code',access_type:'offline',prompt:'consent',redirect_uri:redirectUri(origin),state});
 return Response.redirect(`https://accounts.zoho.com/oauth/v2/auth?${q}`);
}
