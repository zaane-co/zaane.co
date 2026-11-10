import {redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
import AdminShell from '@/components/admin/AdminShell';
import '../../admin/(workspace)/admin.css';
export const dynamic='force-dynamic';
export const metadata={title:'ZARN admin',robots:{index:false,follow:false}};
// ZARN admin lives inside ZARN, separate from Studio admin, but uses the same shell and design.
// Only ZARN admins (and the Studio super admin) get in.
export default async function Layout({children}:{children:React.ReactNode}){
 const me=await zarnMember();if(!me)redirect('/zarn/login');if(!me.zarnAdmin)redirect('/zarn');
 return <AdminShell mode="zarn" user={{name:me.display_name,email:me.email,role:me.staffRole==='super_admin'?'super_admin':'ZARN admin'}} allowedKeys={[]} newLeads={0}>{children}</AdminShell>;
}
