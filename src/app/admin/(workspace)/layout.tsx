import {staff,sessionClient,serviceClient} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
import {collections,allowed} from '@/lib/cms';
import AdminShell from '@/components/admin/AdminShell';
import './admin.css';
export const dynamic='force-dynamic';
export const metadata={title:'Studio admin | Zaane',robots:{index:false,follow:false}};
export default async function Layout({children}:{children:React.ReactNode}){
 const user=await staff();if(!user)redirect('/admin/login');
 const allowedKeys=[...Object.keys(collections),'invoices','media','newsletter'].filter(k=>allowed(k,user.role));
 // ZARN links in the sidebar: chat for anyone active on ZARN, admin for ZARN admins (and the super admin).
 const {data:zm}=await serviceClient().from('zarn_members').select('is_admin,deactivated_at').eq('user_id',user.id).maybeSingle();
 if(zm&&!zm.deactivated_at)allowedKeys.push('zarn_chat');
 if(user.role==='super_admin'||(zm&&!zm.deactivated_at&&zm.is_admin))allowedKeys.push('zarn_admin');
 let newLeads=0;
 if(allowedKeys.includes('leads')){const db=await sessionClient();const {count}=await db.from('leads').select('id',{count:'exact',head:true}).eq('status','new');newLeads=count??0;}
 return <AdminShell user={{name:user.name||'',email:user.email,role:user.role}} allowedKeys={allowedKeys} newLeads={newLeads}>{children}</AdminShell>;
}
