import {redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
import ZarnAuth from '@/components/zarn/ZarnAuth';
export const dynamic='force-dynamic';
// Landing page for invite links: the link signed them in; now they set a name and password.
export default async function Page(){
 const me=await zarnMember();if(!me)redirect('/zarn/login?error=expired');
 if(me.joined_at)redirect('/zarn');
 return <ZarnAuth initial="welcome" name={me.display_name} title={me.title}/>;
}
