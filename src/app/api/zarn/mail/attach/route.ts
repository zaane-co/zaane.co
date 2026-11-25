import {zarnMember} from '@/lib/zarn-server';
import {getAccount,zoho,MailError} from '@/lib/zoho-mail';
// Small files go to Zoho as real email attachments. Larger ones are sent as a download link instead
// (see the 'link_sign' action in ../route.ts), because uploads through the site are capped at about 4.5 MB.
const MAX_ATTACH=3.5*1024*1024;
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me||me.account_type==='guest')return fail('Sign in first.',401);
 const a=await getAccount(me.user_id);if(!a)return fail('Connect Zoho Mail first.',409);
 const file=(await request.formData().catch(()=>null))?.get('file');
 if(!(file instanceof File)||!file.size)return fail('Pick a file.');
 if(file.size>MAX_ATTACH)return fail('That file is too big to attach. It will be sent as a link.');
 const form=new FormData();form.append('attach',file,file.name.slice(0,200));
 try{
  const d=await zoho<{storeName:string;attachmentName:string;attachmentPath:string}|{storeName:string;attachmentName:string;attachmentPath:string}[]>(a,'/messages/attachments?uploadType=multipart',{method:'POST',form});
  const x=Array.isArray(d)?d[0]:d;if(!x?.storeName)return fail('Zoho didn’t take that file. Try again.',502);
  return Response.json({storeName:x.storeName,attachmentName:x.attachmentName,attachmentPath:x.attachmentPath});
 }catch(e){return fail(e instanceof MailError?e.message:'Zoho didn’t take that file. Try again.',502);}
}
