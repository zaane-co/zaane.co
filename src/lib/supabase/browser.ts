'use client';
import {createBrowserClient} from '@supabase/ssr';
// One browser client per tab: ZARN reads and live updates go through it, so RLS applies as the signed-in member.
let client:ReturnType<typeof createBrowserClient>|null=null;
export function browserClient(){return client??=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);}
