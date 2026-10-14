import 'server-only';
import {createHash} from 'node:crypto';
import {serviceClient} from '@/lib/supabase/server';
export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const sameOrigin=(r:Request)=>r.headers.get('origin')===new URL(r.url).origin;
export const clientIp=(r:Request)=>r.headers.get('x-vercel-forwarded-for')||r.headers.get('x-real-ip')||'local';
// Only live posts accept views, likes and comments.
export async function livePost(id:unknown){
 if(typeof id!=='string'||!uuid.test(id))return null;
 const {data}=await serviceClient().from('blog_posts').select('id,title,slug').eq('id',id).eq('status','published').lte('published_at',new Date().toISOString()).maybeSingle();
 return data;
}
// Shared 5-per-hour limiter (consume_rate_limit RPC); key is hashed so raw IPs are never stored.
export async function allow(...parts:string[]){
 const bucket=createHash('sha256').update((process.env.RATE_LIMIT_SALT||process.env.SUPABASE_SERVICE_ROLE_KEY!)+parts.join(':')).digest('hex');
 const {data,error}=await serviceClient().rpc('consume_rate_limit',{bucket});
 return !error&&!!data;
}
