import {redirect} from 'next/navigation';
import {zarnMember} from '@/lib/zarn-server';
// Open #general (or the first channel they're in).
export default async function Page(){
 const me=await zarnMember();if(!me)redirect('/zarn/login');
 const {data}=await me.db.from('zarn_channel_members').select('channel_id,zarn_channels!inner(name,kind,archived_at)').eq('user_id',me.user_id);
 const rows=(data??[]) as unknown as {channel_id:string;zarn_channels:{name:string|null;kind:string;archived_at:string|null}}[];
 const pick=rows.find(r=>r.zarn_channels.name==='general'&&!r.zarn_channels.archived_at)??rows.find(r=>r.zarn_channels.kind!=='dm'&&!r.zarn_channels.archived_at)??rows[0];
 if(pick)redirect(`/zarn/c/${pick.channel_id}`);
 return <div className="zn-empty-state"><h2>You’re not in any channels yet</h2><p>Use “Browse channels” in the sidebar to join one.</p></div>;
}
