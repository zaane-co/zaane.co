import type {Metadata} from 'next';
import {serviceClient} from '@/lib/supabase/server';
import {loadShare,shareLive,shareUnlocked} from '@/lib/vault-share';
import VaultUnlock from './VaultUnlock';
import VaultShareView,{type SharedItem} from './VaultShareView';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Secure handover | Zaane',robots:{index:false,follow:false}};
// What a client sees: only the items chosen for them, locked behind the password, until the link expires or is turned off.
export default async function Page({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const s=await loadShare(token);
 const closed=<main className="docpub"><div className="docpub-card"><h1>This link isn’t available</h1><p>It may have expired or been turned off. Ask Zaane for a new one.</p></div></main>;
 if(!s||!shareLive(s))return closed;
 if(!await shareUnlocked(token)){
  if(s.view_once&&s.opened_at)return <main className="docpub"><div className="docpub-card"><h1>This link has already been opened</h1><p>It could only be used once. Ask Zaane for a new one.</p></div></main>;
  return <main className="docpub"><VaultUnlock token={token}/></main>;
 }
 const db=serviceClient();
 const {data:links}=await db.from('zarn_vault_share_items').select('item_id').eq('share_id',s.id);
 const ids=(links??[]).map(l=>l.item_id);
 const {data:items}=ids.length?await db.from('zarn_vault_items').select('id,kind,label,url,username,note,secret_enc,file_name,file_size').in('id',ids).order('label'):{data:[]};
 const shared:SharedItem[]=(items??[]).map(i=>({id:i.id,kind:i.kind,label:i.label,url:i.url,username:i.username,note:i.note,hasSecret:!!i.secret_enc,fileName:i.file_name,fileSize:i.file_size}));
 return <main className="docpub"><div className="docpub-doc vs-doc"><h1>{s.label||'Your project details'}</h1>
  <p className="vs-lead">These details are private to you. {s.view_once?'This link can’t be opened again once you leave, so copy what you need now. ':''}Available until {new Date(s.expires_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}.</p>
  <VaultShareView token={token} items={shared}/>
  <footer>Shared securely by Zaane</footer></div></main>;
}
