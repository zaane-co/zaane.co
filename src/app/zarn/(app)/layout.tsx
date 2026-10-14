import {redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
import ZarnProvider from '@/components/zarn/ZarnProvider';
import ZarnShell from '@/components/zarn/ZarnShell';
import type {ZChannel,ZLead,ZMember,ZMembership} from '@/lib/zarn';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}){
 const me=await zarnMember();if(!me)redirect('/zarn/login');
 if(!me.joined_at)redirect('/zarn/welcome');
 const [{data:members},{data:channels},{data:membership}]=await Promise.all([
  me.db.from('zarn_members').select('*').order('display_name'),
  me.db.from('zarn_channels').select('*').order('name'),
  me.db.from('zarn_channel_members').select('*').eq('user_id',me.user_id),
 ]);
 // Client spaces are named after their client, so send those names with the first render.
 const clientLeads=((channels??[]) as ZChannel[]).filter(c=>c.kind==='client'&&c.lead_id).map(c=>c.lead_id!);
 const {data:leads}=clientLeads.length?await me.db.from('zarn_leads').select('*').in('id',clientLeads):{data:[]};
 const {db,...self}=me;void db;
 return <ZarnProvider me={self} initial={{members:(members??[]) as ZMember[],channels:(channels??[]) as ZChannel[],membership:(membership??[]) as ZMembership[],leads:(leads??[]) as ZLead[]}}><ZarnShell>{children}</ZarnShell></ZarnProvider>;
}
