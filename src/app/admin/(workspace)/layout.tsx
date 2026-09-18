import {staff} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
import {collections,allowed} from '@/lib/cms';
import Link from 'next/link';
import Logout from '@/components/admin/Logout';
export const dynamic='force-dynamic';
export const metadata={title:'Studio admin | Zaane',robots:{index:false,follow:false}};
export default async function Layout({children}:{children:React.ReactNode}){const user=await staff();if(!user)redirect('/admin/login');return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/admin" className="admin-brand">Zaane<span> / studio</span></Link><nav aria-label="Admin navigation"><Link href="/admin">Overview</Link>{Object.entries(collections).filter(([k])=>allowed(k,user.role)).map(([k,c])=><Link key={k} href={`/admin/${k}`}>{c.label}</Link>)}</nav><div className="admin-profile"><p>{user.name||user.email}</p><small>{user.role.replace('_',' ')}</small><Link href="/">View website ↗</Link><Logout/></div></aside><main className="admin-main">{children}</main></div>;}
