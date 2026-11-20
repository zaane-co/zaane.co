import {redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
import {serviceClient} from '@/lib/supabase/server';
import BizLeads from '@/components/zarn/BizLeads';
export const dynamic='force-dynamic';
export default async function Page(){
 const me=await zarnMember();if(!me)redirect('/zarn/login');
 if(me.account_type==='guest'||!me.zarnAdmin)redirect('/zarn');
 const {data}=await serviceClient().from('pipeline_stages').select('key,label,color');
 return <BizLeads stages={Object.fromEntries((data??[]).map(s=>[s.key,{label:s.label,color:s.color}]))}/>;
}
