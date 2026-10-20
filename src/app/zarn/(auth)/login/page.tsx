import {redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
import ZarnAuth from '@/components/zarn/ZarnAuth';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{error?:string}>}){
 if(await zarnMember())redirect('/zarn');
 const {error}=await searchParams;
 return <ZarnAuth initial="login" notice={error==='expired'?'That link has expired. Sign in, or ask a Zaane admin for a new one.':''}/>;
}
