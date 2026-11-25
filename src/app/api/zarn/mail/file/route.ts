import {signGet} from '@/lib/r2';
// Download link for a large file sent by email. The key holds a random id, so only people who got the email can find it.
export async function GET(request:Request){
 const k=new URL(request.url).searchParams.get('k')??'';
 const m=k.match(/^private\/zarn\/mail\/[0-9a-f-]{36}\/([^/]{1,200})$/i);
 if(!m)return new Response('Not found',{status:404});
 return Response.redirect(await signGet(k,m[1]),302);
}
