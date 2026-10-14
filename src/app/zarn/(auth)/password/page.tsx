import {redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
import ZarnAuth from '@/components/zarn/ZarnAuth';
export const dynamic='force-dynamic';
export default async function Page(){if(!await zarnMember())redirect('/zarn/login?error=expired');return <ZarnAuth initial="password"/>;}
