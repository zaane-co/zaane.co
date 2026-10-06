import {sessionClient,configured} from '@/lib/supabase/server';
import {NextResponse} from 'next/server';
import type {EmailOtpType} from '@supabase/supabase-js';
export async function GET(request:Request){
 const url=new URL(request.url);
 const next=url.searchParams.get('next');
 const target=next?.startsWith('/admin')?next:'/admin';
 const fail=NextResponse.redirect(new URL('/admin/login?error=expired',url.origin));
 if(!configured())return fail;
 const db=await sessionClient();
 const code=url.searchParams.get('code');const tokenHash=url.searchParams.get('token_hash');const type=url.searchParams.get('type') as EmailOtpType|null;
 const {error}=code?await db.auth.exchangeCodeForSession(code):tokenHash&&type?await db.auth.verifyOtp({token_hash:tokenHash,type}):{error:true};
 return error?fail:NextResponse.redirect(new URL(target,url.origin));
}
