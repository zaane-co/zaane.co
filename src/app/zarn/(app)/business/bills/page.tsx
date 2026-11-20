import {redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
import BizBills from '@/components/zarn/BizBills';
export const dynamic='force-dynamic';
export default async function Page(){
 const me=await zarnMember();if(!me)redirect('/zarn/login');
 if(me.account_type==='guest'||!me.zarnAdmin)redirect('/zarn');
 return <BizBills/>;
}
