import ZarnChannels,{type ChannelRow} from '@/components/admin/zarn/ZarnChannels';
import {zarnAdmin} from '../data';
export default async function Page(){
 const {db}=await zarnAdmin();
 const [{data:channels},{data:members},{data:links},{data:counts}]=await Promise.all([
  db.from('zarn_channels').select('*').neq('kind','dm').order('name'),
  db.from('zarn_members').select('user_id,display_name,email').is('deactivated_at',null).order('display_name'),
  db.from('zarn_channel_members').select('channel_id,user_id'),
  db.from('zarn_messages').select('channel_id').is('parent_id',null).is('deleted_at',null),
 ]);
 const memberIds=(links??[]).reduce<Record<string,string[]>>((m,l)=>{(m[l.channel_id]??=[]).push(l.user_id);return m;},{});
 const msgCount=(counts??[]).reduce<Record<string,number>>((m,r)=>{m[r.channel_id]=(m[r.channel_id]??0)+1;return m;},{});
 const rows:ChannelRow[]=(channels??[]).map(c=>({...c,member_ids:memberIds[c.id]??[],messages:msgCount[c.id]??0}));
 return <ZarnChannels rows={rows} members={members??[]}/>;
}
