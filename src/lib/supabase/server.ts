import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
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
export async function staff() {
  if (!configured()) return null;
  const db = await sessionClient();
  const {data:{user}} = await db.auth.getUser();
  if (!user) return null;
  const {data} = await db.from('users').select('id,name,email,role').eq('id',user.id).single();
  return data?.role ? data as {id:string;name:string;email:string;role:'super_admin'|'admin'|'editor'} : null;
}
