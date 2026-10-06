'use client';
import {useEffect} from 'react';
import {createBrowserClient} from '@supabase/ssr';
import type {EmailOtpType} from '@supabase/supabase-js';

// Handles every link shape Supabase can send: ?code= (PKCE), ?token_hash=&type=, and #access_token= (implicit).
export default function Callback(){
 useEffect(()=>{(async()=>{
  const fail=()=>window.location.replace('/admin/login?error=expired');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return fail();
  const db=createBrowserClient(url,key,{auth:{detectSessionInUrl:false}});
  const q=new URLSearchParams(window.location.search),h=new URLSearchParams(window.location.hash.slice(1));
  const next=q.get('next')?.startsWith('/admin')?q.get('next')!:'/admin/reset-password';
  const code=q.get('code'),tokenHash=q.get('token_hash'),type=q.get('type') as EmailOtpType|null;
  const access=h.get('access_token'),refresh=h.get('refresh_token');
  const {error}=code?await db.auth.exchangeCodeForSession(code)
   :tokenHash&&type?await db.auth.verifyOtp({token_hash:tokenHash,type})
   :access&&refresh?await db.auth.setSession({access_token:access,refresh_token:refresh})
   :{error:true};
  if(error)return fail();
  window.location.replace(next);
 })();},[]);
 return <main className="admin-login" style={{alignItems:'center',justifyContent:'center',color:'#888',fontSize:14}}>Verifying your link…</main>;
}
