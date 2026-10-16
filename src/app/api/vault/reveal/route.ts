import {serviceClient} from '@/lib/supabase/server';
import {decrypt} from '@/lib/vault';
import {loadShare,shareLive,shareUnlocked} from '@/lib/vault-share';
// Shows one secret to someone holding an unlocked client link, only if that item is part of the link. Logged.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const b=await request.json().catch(()=>null);
 const token=typeof b?.token==='string'?b.token:'',itemId=typeof b?.item_id==='string'?b.item_id:'';
 const s=await loadShare(token);
 if(!s||!shareLive(s)||!await shareUnlocked(token))return Response.json({error:'This link is no longer available.'},{status:403});
 const db=serviceClient();
 const {data:link}=await db.from('zarn_vault_share_items').select('item_id').eq('share_id',s.id).eq('item_id',itemId).maybeSingle();
 if(!link)return Response.json({error:'Not found.'},{status:404});
 const {data:it}=await db.from('zarn_vault_items').select('id,lead_id,label,secret_enc').eq('id',itemId).maybeSingle();
 if(!it||it.lead_id!==s.lead_id)return Response.json({error:'Not found.'},{status:404});
 let secret='';try{secret=it.secret_enc?decrypt(it.secret_enc):'';}catch{return Response.json({error:'Could not decrypt.'},{status:500});}
 await db.from('zarn_vault_log').insert({lead_id:s.lead_id,item_id:it.id,item_label:it.label,action:'share_reveal'});
 return Response.json({secret},{headers:{'Cache-Control':'no-store'}});
}
