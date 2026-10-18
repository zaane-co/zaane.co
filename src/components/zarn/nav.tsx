'use client';
import {createContext,useContext} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Hash,Lock} from 'lucide-react';
import type {ZChannel} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {Avatar,StatusMark} from './format';

// Shared navigation pieces for the desktop sidebar and the phone tab screens.
export type Dialog='channel'|'dm'|'browse'|'search'|'profile'|'invite'|'client'|'install'|'assistant'|null;
export const ShellCtx=createContext<{open:(d:Dialog)=>void;profile:(userId:string)=>void}>({open:()=>{},profile:()=>{}});
export const useShell=()=>useContext(ShellCtx);

// Lists, permissions and unread badges, computed once from ZARN state.
export function useNav(){
 const z=useZarn(),{me,channels,membership,unread,title}=z;
 const staffAdmin=me.staffRole==='super_admin'||me.staffRole==='admin';
 const guest=me.account_type==='guest';
 const canCreate=!guest&&me.can_create_channels,canBusiness=!guest&&staffAdmin;
 const canAddClient=!guest&&(staffAdmin||me.staffRole==='sales');
 // Amounts (deal values, invoice totals) are for admins only.

 // Conversations with deactivated people are hidden from the lists; they're still found by searching for the person.
 const gone=(c:ZChannel)=>c.kind==='dm'&&(c.dm_key??'').split(',').some(id=>id!==me.user_id&&(!z.people[id]||z.people[id]?.deactivated_at))&&Object.keys(z.people).length>0;
 const live=channels.filter(c=>!c.archived_at&&!gone(c)),mine=live.filter(c=>membership[c.id]);
 const starred=mine.filter(c=>c.kind!=='client'&&membership[c.id]?.starred);
 const rooms=mine.filter(c=>(c.kind==='public'||c.kind==='private')&&!membership[c.id]?.starred).sort((a,b)=>(a.name??'').localeCompare(b.name??''));
 const dms=mine.filter(c=>c.kind==='dm').sort((a,b)=>(unread[b.id]?.unread??0)-(unread[a.id]?.unread??0));
 const clients=live.filter(c=>c.kind==='client'&&(membership[c.id]||staffAdmin)).sort((a,b)=>title(a).localeCompare(title(b)));
 // Archived clients are only listed for admins, in their own section.
 const archivedClients=channels.filter(c=>c.kind==='client'&&c.archived_at&&staffAdmin).sort((a,b)=>title(a).localeCompare(title(b)));
 const count=(list:ZChannel[],k:'unread'|'mentions')=>list.reduce((t,c)=>t+(membership[c.id]?.muted&&k==='unread'?0:unread[c.id]?.[k]??0),0);
 const badges={
  home:count([...starred,...rooms].filter(c=>c.kind!=='dm'),'unread'),
  dms:count(dms,'unread'),
  clients:count(clients.filter(c=>membership[c.id]),'unread'),
  activity:Object.values(unread).reduce((t,u)=>t+u.mentions,0),
 };
 return {staffAdmin,guest,canCreate,canBusiness,canAddClient,starred,rooms,dms,clients,archivedClients,badges};
}

export const channelPath=(c:ZChannel)=>c.kind==='client'?`/zarn/clients/${c.lead_id}`:`/zarn/c/${c.id}`;

// One conversation in a list (channel, DM or client space).
export function ChannelRow({c,big}:{c:ZChannel;big?:boolean}){
 const z=useZarn(),{me,membership,unread,online,people,title}=z,pathname=usePathname();
 const u=unread[c.id],muted=membership[c.id]?.muted,href=channelPath(c),isActive=pathname===href;
 const other=c.kind==='dm'?(c.dm_key??'').split(',').find(id=>id!==me.user_id):undefined;
 const lead=c.kind==='client'&&c.lead_id?z.lead(c.lead_id):undefined;
 const gone=c.kind==='dm'&&Object.keys(people).length>0&&(!people[other??'']||!!people[other??'']?.deactivated_at);
 const icon=c.kind==='dm'?<Avatar m={people[other??me.user_id]} size={big?36:20} online={online.has(other??me.user_id)}/>
  :c.kind==='client'?<i className="zn-client-dot" style={{background:lead?.stage_color??'#52525b'}}/>
  :c.kind==='private'?<Lock size={big?17:15}/>:<Hash size={big?18:15}/>;
 // Every unread message counts (muted conversations only show @mentions). Mentions use the accent colour, plain unread a neutral one.
 const badge=muted?u?.mentions??0:u?.unread??0,mentioned=!!u?.mentions;
 return <Link href={href} className={`zn-nav-item${big?' is-big':''}${isActive?' is-active':''}${u?.unread&&!muted?' is-unread':''}${muted||gone?' is-muted':''}`}>
  {icon}<span>{title(c)}{c.kind==='dm'&&other&&<StatusMark m={people[other]}/>}{big&&c.kind==='client'&&lead?.stage_label&&<small>{lead.stage_label}</small>}{big&&c.kind==='dm'&&<small>{online.has(other??'')?'Online':people[other??'']?.title||'Direct message'}</small>}</span>
  {gone?<em className="zn-admin-eye">Deactivated</em>:badge?<em className={`zn-badge${mentioned?'':' is-soft'}`}>{badge>99?'99+':badge}</em>:!membership[c.id]&&c.kind==='client'?<em className="zn-admin-eye" title="You can see this as an admin">admin</em>:null}
 </Link>;
}
