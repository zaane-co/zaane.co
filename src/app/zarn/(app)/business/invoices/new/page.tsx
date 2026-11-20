import {redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
import {InvoiceEditor} from '@/components/zarn/BizInvoices';
import {editorData} from '../data';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{c?:string}>}){
 const me=await zarnMember();if(!me)redirect('/zarn/login');
 if(me.account_type==='guest'||!me.zarnAdmin)redirect('/zarn');
 return <InvoiceEditor invoice={null} preset={(await searchParams).c} {...await editorData()}/>;
}
