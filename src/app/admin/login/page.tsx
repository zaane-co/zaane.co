import Login from '@/components/admin/Login';
import {configured,staff} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
import Link from 'next/link';
export const metadata={title:'Staff sign in | Zaane',robots:{index:false,follow:false}};
export default async function Page(){if(await staff())redirect('/admin');return <main className="login-page"><Link href="/" className="admin-brand">Zaane<span> / studio</span></Link><div className="login-card"><span className="eyebrow">The studio, behind the scenes</span><h1>Welcome back.</h1><p>Sign in to manage your content and conversations.</p>{!configured()&&<div className="notice">Setup required: add this project’s Supabase environment variables and apply the migration. See docs/BUILD.md for the setup steps.</div>}<Login configured={configured()}/></div></main>;}
