// ZARN (team chat) shared types and helpers for the client and the API routes.
export type ZMember={user_id:string;email:string;display_name:string;title:string;status_text:string;avatar_url:string|null;joined_at:string|null;deactivated_at:string|null;last_seen_at:string|null;created_at:string};
export type ZChannel={id:string;kind:'public'|'private'|'dm';name:string|null;topic:string;crm_feed:string|null;dm_key:string|null;is_default:boolean;archived_at:string|null;created_at:string};
export type ZMembership={channel_id:string;user_id:string;last_read_at:string;muted:boolean;starred:boolean};
export type ZAttachment={key:string;name:string;size:number;type:string};
export type ZMessage={id:string;channel_id:string;user_id:string|null;parent_id:string|null;body:string;attachments:ZAttachment[];lead_id:string|null;invoice_id:string|null;kind:'user'|'system'|'crm';meta:Record<string,string|number>;reply_count:number;last_reply_at:string|null;pinned_at:string|null;edited_at:string|null;deleted_at:string|null;created_at:string;pending?:boolean};
export type ZReaction={message_id:string;user_id:string;channel_id:string;emoji:string};
export type ZLead={id:string;name:string;company:string;status:string;stage_label:string|null;stage_color:string|null;stage_kind:string|null;deal_value:number|null;currency:string;categories:string[];service_interested:string;owner_id:string|null;owner_name:string|null;created_at:string;last_activity_at:string};
export const quickReactions=['👍','❤️','😂','🎉','👀','✅','🙏','🔥'];
export const channelSlug=(s:string)=>s.toLowerCase().trim().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
// Name shown for a channel: #name, or the other people in a DM.
export function channelTitle(c:ZChannel,me:string,people:Record<string,ZMember>){
 if(c.kind!=='dm')return c.name??'';
 const others=(c.dm_key??'').split(',').filter(id=>id&&id!==me);
 return others.length?others.map(id=>people[id]?.display_name??'Former member').join(', '):`${people[me]?.display_name??'You'} (you)`;
}
export async function zarnApi<T=Record<string,unknown>>(path:string,body:object):Promise<T>{
 const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Something went wrong.');return data;
}
