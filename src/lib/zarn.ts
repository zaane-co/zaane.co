// ZARN (team chat) shared types and helpers for the client and the API routes.
export type ZMember={user_id:string;email:string;display_name:string;title:string;status_text:string;avatar_url:string|null;joined_at:string|null;deactivated_at:string|null;last_seen_at:string|null;created_at:string;account_type:'member'|'guest';can_view_crm:boolean;can_create_channels:boolean;expires_at:string|null;username:string|null;phone:string;work_email:string;status_emoji:string;status_until:string|null};
export type ZEmergency={user_id:string;name:string;relation:string;phone:string};
export const usernameOk=(u:string)=>/^[a-z0-9][a-z0-9._]{1,29}$/.test(u);
export type ZChannel={id:string;kind:'public'|'private'|'dm'|'client';lead_id:string|null;name:string|null;topic:string;crm_feed:string|null;dm_key:string|null;is_default:boolean;archived_at:string|null;created_at:string;created_by?:string|null};
export type ZMembership={channel_id:string;user_id:string;last_read_at:string;muted:boolean;starred:boolean};
export type ZAttachment={key:string;name:string;size:number;type:string;duration?:number};
export type ZMessage={id:string;channel_id:string;user_id:string|null;parent_id:string|null;body:string;attachments:ZAttachment[];lead_id:string|null;invoice_id:string|null;kind:'user'|'system'|'crm';meta:Record<string,string|number>;reply_count:number;last_reply_at:string|null;pinned_at:string|null;edited_at:string|null;deleted_at:string|null;created_at:string;author_name?:string|null;pending?:boolean};
export type ZReaction={message_id:string;user_id:string;channel_id:string;emoji:string};
export type ZLead={id:string;name:string;company:string;status:string;stage_label:string|null;stage_color:string|null;stage_kind:string|null;deal_value:number|null;currency:string;categories:string[];service_interested:string;owner_id:string|null;owner_name:string|null;created_at:string;last_activity_at:string};
export const quickReactions=['👍','❤️','😂','🎉','👀','✅','🙏','🔥'];
export const channelSlug=(s:string)=>s.toLowerCase().trim().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
// Name shown for a channel: #name, or the other people in a DM.
export function channelTitle(c:ZChannel,me:string,people:Record<string,ZMember>){
 if(c.kind==='client')return 'Client';
 if(c.kind!=='dm')return c.name??'';
 const others=(c.dm_key??'').split(',').filter(id=>id&&id!==me);
 return others.length?others.map(id=>people[id]?.display_name??'Former member').join(', '):`${people[me]?.display_name??'You'} (you)`;
}
export async function zarnApi<T=Record<string,unknown>>(path:string,body:object):Promise<T>{
 const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Something went wrong.');return data;
}
// Where a conversation lives: client spaces have their own page.
export const channelHref=(c:Pick<ZChannel,'id'|'kind'|'lead_id'>|undefined,id:string)=>c?.kind==='client'&&c.lead_id?`/zarn/clients/${c.lead_id}`:`/zarn/c/${id}`;

// Slack-style status presets. clear: minutes, 'today' (end of day), 'pick' (choose a date) or null (until cleared).
export const statusPresets:{emoji:string;text:string;clear:number|'today'|'pick'|null}[]=[
 {emoji:'📅',text:'In a meeting',clear:60},{emoji:'🤒',text:'Out sick',clear:'today'},{emoji:'🌴',text:'On leave',clear:'pick'},
 {emoji:'🌙',text:'Away',clear:null},{emoji:'🚌',text:'Commuting',clear:30},{emoji:'🏠',text:'Working remotely',clear:'today'},
 {emoji:'🎯',text:'Focusing',clear:120},{emoji:'🍽️',text:'On lunch',clear:60},
];
export const clearOptions:[string,string][]=[['','Don’t clear'],['30','30 minutes'],['60','1 hour'],['120','2 hours'],['240','4 hours'],['today','Today'],['week','This week'],['pick','Pick a date']];
export function clearAt(v:string,date?:string){
 const d=new Date();
 if(!v)return null;
 if(v==='today'){d.setHours(23,59,59,0);return d.toISOString();}
 if(v==='week'){d.setDate(d.getDate()+((7-d.getDay())%7||7));d.setHours(23,59,59,0);return d.toISOString();}
 if(v==='pick')return date?new Date(date+'T23:59:59').toISOString():null;
 return new Date(Date.now()+Number(v)*60000).toISOString();
}
// The status to show right now (expired statuses disappear on their own).
export function liveStatus(m?:Pick<ZMember,'status_emoji'|'status_text'|'status_until'>|null){
 if(!m||(!m.status_emoji&&!m.status_text))return null;
 if(m.status_until&&new Date(m.status_until)<=new Date())return null;
 return {emoji:m.status_emoji,text:m.status_text,until:m.status_until};
}
