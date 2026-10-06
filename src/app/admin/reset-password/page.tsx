import Login from '@/components/admin/Login';
import LoginHero from '@/components/admin/LoginHero';
import {configured,staff} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
export const metadata={title:'Reset password | Zaane',robots:{index:false,follow:false}};
export default async function Page(){if(!await staff())redirect('/admin/login?error=expired');return <main className="admin-login"><LoginHero/><Login configured={configured()} initialView="reset"/></main>;}
