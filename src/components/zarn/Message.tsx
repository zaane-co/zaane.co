'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Download,FileText,MessageSquareText,Pencil,Pin,SmilePlus,Trash2,TrendingUp,Receipt,UserPlus} from 'lucide-react';
import {quickReactions,zarnApi,type ZMessage,type ZReaction} from '@/lib/zarn';
import {money} from '@/lib/crm';
import {useZarn} from './ZarnProvider';
import {Avatar,renderBody,timeOf,tokensToText,textToTokens} from './format';

// One message row. compact = same author as the previous message within a few minutes (no avatar/name).
export default function Message({m,reactions,compact,inThread,onThread}:{m:ZMessage;reactions:ZReaction[];compact:boolean;inThread?:boolean;onThread?:(m:ZMessage)=>void}){
 const {me,people,members,db,membership,emit}=useZarn();
 const [picker,setPicker]=useState(false),[editing,setEditing]=useState(false),[draft,setDraft]=useState(''),[confirm,setConfirm]=useState(false);
 const author=m.user_id?people[m.user_id]:undefined,mine=m.user_id===me.user_id,canAct=!!membership[m.channel_id];
 const groups=reactions.reduce<Record<string,string[]>>((g,r)=>{(g[r.emoji]??=[]).push(r.user_id);return g;},{});
 async function toggle(emoji:string){
  setPicker(false);if(!canAct)return;
  const has=reactions.some(r=>r.emoji===emoji&&r.user_id===me.user_id);
  const row={message_id:m.id,user_id:me.user_id,channel_id:m.channel_id,emoji};
  emit({table:'zarn_reactions',type:has?'DELETE':'INSERT',row});
  const {error}=has?await db.from('zarn_reactions').delete().eq('message_id',m.id).eq('user_id',me.user_id).eq('emoji',emoji):await db.from('zarn_reactions').insert(row);
  if(error)emit({table:'zarn_reactions',type:has?'INSERT':'DELETE',row});
 }
 async function saveEdit(){
  const body=textToTokens(draft.trim(),members);if(!body||body===m.body){setEditing(false);return;}
  const edited_at=new Date().toISOString();emit({table:'zarn_messages',type:'UPDATE',row:{...m,body,edited_at}});
  await db.from('zarn_messages').update({body,edited_at}).eq('id',m.id);setEditing(false);
 }
 const remove=async()=>{const deleted_at=new Date().toISOString();emit({table:'zarn_messages',type:'UPDATE',row:{...m,body:'',deleted_at}});await db.from('zarn_messages').update({deleted_at,body:''}).eq('id',m.id);setConfirm(false);};
 const pin=()=>void zarnApi('/api/zarn',{action:'pin',message_id:m.id,pinned:!m.pinned_at}).catch(()=>{});

 if(m.kind==='system')return <div className="zn-system">{systemText(m,people)}</div>;
 if(m.deleted_at)return <div className={`zn-msg${compact?' is-compact':''}`}><div className="zn-gutter">{!compact&&<Avatar m={author}/>}</div><div className="zn-msg-main"><p className="zn-deleted">This message was deleted.</p></div></div>;

 return <div className={`zn-msg${compact?' is-compact':''}${m.pinned_at?' is-pinned':''}${m.pending?' is-pending':''}`} id={`m-${m.id}`}>
  <div className="zn-gutter">{compact?<time className="zn-hover-time">{timeOf(m.created_at)}</time>:m.kind==='crm'?<span className="zn-bot"><TrendingUp size={16}/></span>:<Avatar m={author}/>}</div>
  <div className="zn-msg-main">
   {!compact&&<p className="zn-msg-head"><b>{m.kind==='crm'?'CRM':author?.display_name??'Former member'}</b>{m.kind==='crm'&&<span className="zn-app-tag">APP</span>}<time title={new Date(m.created_at).toLocaleString('en-GB')}>{timeOf(m.created_at)}</time>{m.pinned_at&&<span className="zn-pin-tag"><Pin size={11}/>Pinned</span>}</p>}
   {editing?<div className="zn-edit"><textarea autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void saveEdit();}if(e.key==='Escape')setEditing(false);}}/><div><button type="button" onClick={()=>setEditing(false)}>Cancel</button><button type="button" className="is-primary" onClick={()=>void saveEdit()}>Save</button></div></div>
    :m.body&&<div className="zn-body">{renderBody(m.body,people,me.user_id)}{m.edited_at&&<span className="zn-edited"> (edited)</span>}</div>}
   {m.kind==='crm'&&<CrmEvent m={m}/>}
   {m.kind!=='crm'&&m.lead_id&&<LeadCard id={m.lead_id}/>}
   {m.attachments.length>0&&<div className="zn-files">{m.attachments.map((a,i)=>a.type.startsWith('image/')&&a.type!=='image/svg+xml'
    ?<a key={i} href={`/api/zarn/files?m=${m.id}&i=${i}`} target="_blank" rel="noopener noreferrer" className="zn-image"><img src={`/api/zarn/files?m=${m.id}&i=${i}`} alt={a.name} loading="lazy"/></a>
    :<a key={i} href={`/api/zarn/files?m=${m.id}&i=${i}&download=1`} className="zn-file"><FileText size={18}/><span><b>{a.name}</b><small>{(a.size/1024).toFixed(a.size>1024*1024?0:1)} KB</small></span><Download size={15}/></a>)}</div>}
   {Object.keys(groups).length>0&&<div className="zn-reactions">{Object.entries(groups).map(([e,users])=><button key={e} type="button" className={users.includes(me.user_id)?'is-mine':''} title={users.map(u=>people[u]?.display_name??'Someone').join(', ')} onClick={()=>void toggle(e)}>{e}<span>{users.length}</span></button>)}
    {canAct&&<button type="button" className="zn-react-add" aria-label="Add reaction" onClick={()=>setPicker(v=>!v)}><SmilePlus size={14}/></button>}</div>}
   {!inThread&&m.reply_count>0&&<button type="button" className="zn-thread-link" onClick={()=>onThread?.(m)}><MessageSquareText size={13}/>{m.reply_count} repl{m.reply_count===1?'y':'ies'}{m.last_reply_at&&<span>Last reply {timeOf(m.last_reply_at)}</span>}</button>}
  </div>
  {canAct&&!editing&&m.kind!=='crm'&&<div className="zn-actions" role="toolbar" aria-label="Message actions">
   {quickReactions.slice(0,3).map(e=><button key={e} type="button" aria-label={`React ${e}`} onClick={()=>void toggle(e)}>{e}</button>)}
   <button type="button" aria-label="More reactions" data-tip="React" onClick={()=>setPicker(v=>!v)}><SmilePlus size={15}/></button>
   {!inThread&&<button type="button" aria-label="Reply in thread" data-tip="Reply in thread" onClick={()=>onThread?.(m)}><MessageSquareText size={15}/></button>}
   {!inThread&&<button type="button" aria-label={m.pinned_at?'Unpin':'Pin'} data-tip={m.pinned_at?'Unpin':'Pin to channel'} onClick={pin}><Pin size={15}/></button>}
   {mine&&<button type="button" aria-label="Edit" data-tip="Edit" onClick={()=>{setDraft(tokensToText(m.body,people));setEditing(true);}}><Pencil size={15}/></button>}
   {mine&&<button type="button" aria-label="Delete" data-tip="Delete" className="is-danger" onClick={()=>setConfirm(true)}><Trash2 size={15}/></button>}
  </div>}
  {canAct&&m.kind==='crm'&&<div className="zn-actions">{quickReactions.slice(0,3).map(e=><button key={e} type="button" aria-label={`React ${e}`} onClick={()=>void toggle(e)}>{e}</button>)}{!inThread&&<button type="button" aria-label="Reply in thread" onClick={()=>onThread?.(m)}><MessageSquareText size={15}/></button>}</div>}
  {picker&&<><button type="button" className="zn-scrim" aria-label="Close" onClick={()=>setPicker(false)}/><div className="zn-picker">{quickReactions.concat(['😮','😢','💯','🚀','👏','🤝','💡','⏳']).map(e=><button key={e} type="button" onClick={()=>void toggle(e)}>{e}</button>)}</div></>}
  {confirm&&<div className="zn-confirm"><span>Delete this message?</span><button type="button" onClick={()=>setConfirm(false)}>Cancel</button><button type="button" className="is-danger" onClick={()=>void remove()}>Delete</button></div>}
 </div>;
}

function systemText(m:ZMessage,people:Record<string,{display_name:string}>){
 const by=people[String(m.meta.by??'')]?.display_name??'Someone';
 switch(m.meta.event){
  case 'channel_created':return `${by} created this channel.`;
  case 'topic':return m.meta.topic?`${by} set the topic: ${m.meta.topic}`:`${by} cleared the topic.`;
  case 'members_added':{const names=String(m.meta.users??'').split(',').map(id=>people[id]?.display_name).filter(Boolean);return `${by} added ${names.join(', ')||'people'}.`;}
  default:return '';
 }
}

// Live summary of a CRM lead (read-only fields from the zarn_leads view).
export function LeadCard({id,compact}:{id:string;compact?:boolean}){
 const {lead,loadLead,me}=useZarn();const l=lead(id);
 useEffect(()=>{loadLead(id);},[id,loadLead]);
 const staff=me.staffRole&&['super_admin','admin','sales'].includes(me.staffRole);
 if(!l)return <div className="zn-lead is-loading">Loading lead…</div>;
 return <div className={`zn-lead${compact?' is-compact':''}`}>
  <div className="zn-lead-top"><b>{l.name}</b>{l.stage_label&&<span className="zn-stage" style={{background:l.stage_color??'#52525b'}}>{l.stage_label}</span>}</div>
  <p>{[l.company,l.service_interested].filter(Boolean).join(' · ')||'No company'}</p>
  <div className="zn-lead-meta">{l.deal_value!=null&&<span>{money(Number(l.deal_value),l.currency)}</span>}{l.owner_name&&<span>Owner: {l.owner_name}</span>}{l.categories.slice(0,3).map(c=><span key={c} className="zn-cat">{c}</span>)}</div>
  <div className="zn-lead-links"><Link href={`/zarn/crm?lead=${l.id}`}>View in CRM</Link>{staff&&<a href={`/admin/leads/${l.id}`} target="_blank" rel="noopener noreferrer">Open in admin</a>}</div>
 </div>;
}

function CrmEvent({m}:{m:ZMessage}){
 const {lead,loadLead}=useZarn();const l=m.lead_id?lead(m.lead_id):undefined;
 useEffect(()=>{if(m.lead_id)loadLead(m.lead_id);},[m.lead_id,loadLead]);
 const e=String(m.meta.event);const name=l?.company||l?.name||'a lead';
 const text=e==='lead_created'?<><UserPlus size={14}/> New lead from {m.meta.source==='website'||m.meta.source==='partnership'?'the website':String(m.meta.source)}: <b>{name}</b></>
  :e==='stage'?<><TrendingUp size={14}/> <b>{name}</b> moved to <b>{l?.stage_label&&l.status===m.meta.to?l.stage_label:String(m.meta.to)}</b></>
  :e==='invoice_sent'?<><Receipt size={14}/> Invoice <b>{String(m.meta.number)}</b> ({money(Number(m.meta.total),String(m.meta.currency))}) sent to <b>{name}</b></>
  :e==='invoice_paid'?<><Receipt size={14}/> Invoice <b>{String(m.meta.number)}</b> paid by <b>{name}</b>: {money(Number(m.meta.total),String(m.meta.currency))}</>:null;
 return <div className="zn-crm"><p>{text}</p>{m.lead_id&&<LeadCard id={m.lead_id} compact/>}</div>;
}
