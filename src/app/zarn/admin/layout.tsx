import {redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
import ZarnAdminFrame from '@/components/admin/zarn/ZarnAdminFrame';
import '../../admin/(workspace)/admin.css';
export const dynamic='force-dynamic';
export const metadata={title:'ZARN admin',robots:{index:false,follow:false}};
// ZARN admin lives inside ZARN, separate from Studio admin. Only ZARN admins (and the Studio super admin) get in.
export default async function Layout({children}:{children:React.ReactNode}){
 const me=await zarnMember();if(!me)redirect('/zarn/login');if(!me.zarnAdmin)redirect('/zarn');
 return <ZarnAdminFrame>{children}</ZarnAdminFrame>;
}
