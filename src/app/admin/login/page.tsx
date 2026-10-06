import Login from '@/components/admin/Login';
import {configured,staff} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
export const metadata={title:'Staff sign in | Zaane',robots:{index:false,follow:false}};
export default async function Page(){if(await staff())redirect('/admin');return <main className="admin-login">
 <aside className="admin-login-hero"><div className="admin-login-photo"><img src="/zaane-logo-light.svg" alt="Zaane" className="admin-login-logo"/><img src="/zaane-mark.svg" alt="" aria-hidden="true" className="admin-login-mark"/><div className="admin-login-shade"/><div className="admin-login-caption"><h2>Admin Portal</h2><p>Manage your projects, content, and inquiries from one place.</p></div></div></aside>
 <Login configured={configured()}/>
</main>;}
