import {Suspense} from 'react';
import CrmPanel from '@/components/zarn/CrmPanel';
import {redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
export default async function Page(){
 const me=await zarnMember();if(!me)redirect('/zarn/login');
 if(me.account_type==='guest'||(me.staffRole!=='super_admin'&&me.staffRole!=='admin'))redirect('/zarn');
 return <Suspense><CrmPanel/></Suspense>;
}
