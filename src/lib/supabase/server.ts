import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';
export function configured() { return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); }
export async function sessionClient() {
  if (!configured()) throw new Error('Supabase is not configured.');
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: {
    getAll: () => jar.getAll(),
    setAll: (items) => { try { items.forEach(({name,value,options}) => jar.set(name,value,options)); } catch { /* Proxy refreshes cookies for server components. */ } },
  }});
}
export function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {auth:{persistSession:false,autoRefreshToken:false}});
}
export function serviceClient() {
  if (!configured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Submissions are not configured.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
}
// The signed-in user's id. getClaims() verifies the session JWT locally with the project's ES256 signing key
// (no round trip to Supabase Auth), and the result is shared by the layout and page within one request.
export const currentUserId = cache(async () => {
  if (!configured()) return null;
  const db = await sessionClient();
  const {data, error} = await db.auth.getClaims();
  return error || !data?.claims?.sub ? null : data.claims.sub as string;
});
export const staff = cache(async () => {
  const id = await currentUserId();
  if (!id) return null;
  const db = await sessionClient();
  const {data} = await db.from('users').select('id,name,email,role').eq('id',id).single();
  return data?.role ? data as {id:string;name:string;email:string;role:'super_admin'|'admin'|'editor'|'sales'|'finance'} : null;
});
