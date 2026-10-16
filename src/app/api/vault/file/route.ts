import {serviceClient} from '@/lib/supabase/server';
import {getPrivate} from '@/lib/r2';
import {decryptBytes} from '@/lib/vault';
import {loadShare,shareLive,shareUnlocked} from '@/lib/vault-share';
// Downloads a secret file for someone holding an unlocked client link, only if that file is part of the link. Logged.
export async function GET(request:Request){
 const u=new URL(request.url),token=u.searchParams.get('t')??'',itemId=u.searchParams.get('id')??'';
 const s=await loadShare(token);
 if(!s||!shareLive(s)||!await shareUnlocked(token))return new Response('Not available',{status:403});
 const db=serviceClient();
 const {data:link}=await db.from('zarn_vault_share_items').select('item_id').eq('share_id',s.id).eq('item_id',itemId).maybeSingle();
 if(!link)return new Response('Not found',{status:404});
 const {data:it}=await db.from('zarn_vault_items').select('id,lead_id,label,kind,file_key,file_name').eq('id',itemId).maybeSingle();
 if(!it||it.lead_id!==s.lead_id||it.kind!=='file'||!it.file_key)return new Response('Not found',{status:404});
 try{
  const f=await getPrivate(it.file_key),buf=Buffer.from(await new Response(f.body).arrayBuffer());
  await db.from('zarn_vault_log').insert({lead_id:s.lead_id,item_id:it.id,item_label:it.label,action:'share_download'});
  return new Response(new Uint8Array(decryptBytes(buf)),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${it.file_name.replace(/"/g,'')}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('Could not decrypt.',{status:500});}
}
