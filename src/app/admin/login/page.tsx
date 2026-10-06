import Login from '@/components/admin/Login';
import LoginHero from '@/components/admin/LoginHero';
import {configured,staff} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
export const metadata={title:'Staff sign in | Zaane',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{error?:string}>}){if(await staff())redirect('/admin');const {error}=await searchParams;return <main className="admin-login"><LoginHero/><Login configured={configured()} notice={error==='expired'?'That reset link is invalid or has expired. Request a new one.':''}/></main>;}
