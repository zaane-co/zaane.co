'use client';
import {useEffect} from 'react';

// If Supabase falls back to the Site URL, forward reset/auth links on to the admin callback.
export default function AuthLinkForwarder(){
 useEffect(()=>{
  const {pathname,search,hash}=window.location;
  if(pathname.startsWith('/admin'))return;
  const q=new URLSearchParams(search);
  if(q.has('code')||q.has('token_hash')||/access_token=|type=recovery/.test(hash)){
   q.set('next','/admin/reset-password');
   window.location.replace(`/admin/auth/callback?${q}${hash}`);
  }
 },[]);
 return null;
}
