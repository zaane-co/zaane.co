'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Lock} from 'lucide-react';
import {useZarn} from './ZarnProvider';
// Pending invitations to private channels. Nobody is added until they accept.
export default function Invites(){
 const {invites,reloadInvites,reload}=useZarn(),router=useRouter(),[busy,setBusy]=useState('');
 if(!invites.length)return null;
 async function respond(channelId:string,accept:boolean){
  setBusy(channelId);
  try{
   const r=await fetch('/api/zarn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:accept?'invite_accept':'invite_decline',channel_id:channelId})});
   await reloadInvites();
   if(r.ok&&accept){await reload();router.push(`/zarn/c/${channelId}`);}
  }finally{setBusy('');}
 }
 return <div className="zn-invites" role="region" aria-label="Channel invitations">
  <p className="zn-invites-title">Invitations <span>{invites.length}</span></p>
  {invites.map(i=><div key={i.channel_id} className="zn-invite">
   <span className="zn-invite-ico"><Lock size={14}/></span>
   <div className="zn-invite-text"><b>{i.name}</b><small>{i.inviter} invited you</small></div>
   <div className="zn-invite-actions">
    <button type="button" className="zn-btn is-primary" disabled={busy===i.channel_id} onClick={()=>void respond(i.channel_id,true)}>Accept</button>
    <button type="button" className="zn-btn" disabled={busy===i.channel_id} onClick={()=>void respond(i.channel_id,false)}>Decline</button>
   </div>
  </div>)}
 </div>;
}
