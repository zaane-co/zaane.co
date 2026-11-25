import {z} from 'zod';
import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {decrypt} from '@/lib/vault';
import {signPut} from '@/lib/r2';
import {getAccount,zoho,zohoReady,MailError,type MailAccount} from '@/lib/zoho-mail';
// ZARN Mail: each person's own Zoho mailbox. Everything goes through here so Zoho tokens stay on the server.
const fail=(error:string,status=400)=>Response.json({error},{status});
const zid=z.string().regex(/^\d{1,30}$/);
const addrs=z.string().trim().max(2000).default('').refine(s=>!s||s.split(/[,;]/).map(x=>x.trim()).filter(Boolean).every(x=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(x)),'Check the email addresses.');
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('status')}),
 z.object({action:z.literal('folders')}),
 z.object({action:z.literal('list'),folderId:zid,start:z.number().int().min(1).max(100000).default(1),q:z.string().trim().max(200).default(''),unread:z.boolean().default(false)}),
 z.object({action:z.literal('read'),folderId:zid,messageId:zid}),
 z.object({action:z.literal('send'),to:addrs.refine(Boolean,'Add who it’s to.'),cc:addrs,bcc:addrs,subject:z.string().trim().max(500),html:z.string().max(500000),
  attachments:z.array(z.object({storeName:z.string().max(300),attachmentPath:z.string().max(1000),attachmentName:z.string().max(300)})).max(20).default([]),
  links:z.array(z.object({key:z.string().regex(/^private\/zarn\/mail\/[0-9a-f-]{36}\/[\w.-]{1,200}$/i),name:z.string().max(300),size:z.number().min(0)})).max(20).default([]),
  reply:z.object({folderId:zid,messageId:zid,mode:z.enum(['reply','replyall','forward'])}).optional()}),
 z.object({action:z.literal('link_sign'),name:z.string().trim().min(1).max(300),type:z.string().max(200).default(''),size:z.number().int().min(1).max(5*1024**3,'Files must be under 5 GB.')}),
 z.object({action:z.literal('flag'),messageIds:z.array(zid).min(1).max(100),mode:z.enum(['markAsRead','markAsUnread'])}),
 z.object({action:z.literal('disconnect')}),
]);
type Msg={messageId:string;folderId:string;subject?:string;summary?:string;sender?:string;fromAddress?:string;toAddress?:string;receivedTime?:string;status?:string;hasAttachment?:string;threadCount?:string};
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const clean=(h:string)=>h.replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1>/gi,'').replace(/<(script|iframe|object|embed|meta|link|base)[^>]*>/gi,'').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi,'$1="#"');
const list=(s:string)=>s.split(/[,;]/).map(x=>x.trim()).filter(Boolean).join(',');

export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Invalid origin',403);
 const me=await zarnMember();if(!me||me.account_type==='guest')return fail('Sign in first.',401);
 const p=actions.safeParse(await request.json().catch(()=>null));
 if(!p.success)return fail(p.error.issues[0]?.message??'Invalid request');
 const b=p.data;
 const a=zohoReady()?await getAccount(me.user_id):null;
 if(b.action==='status')return Response.json({ready:zohoReady(),connected:!!a,email:a?.email??null,name:a?.display_name??null});
 if(!a)return fail('Connect Zoho Mail first.',409);
 try{
  if(b.action==='folders'){
   const f=await zoho<{folderId:string;folderName:string;folderType:string;path:string;unreadCount?:number}[]>(a,'/folders');
   return Response.json({folders:f.map(x=>({id:String(x.folderId),name:x.folderName,type:x.folderType,path:x.path,unread:x.unreadCount??0}))});
  }
  if(b.action==='list'){
   const qs=new URLSearchParams({start:String(b.start),limit:'50',includeto:'true'});
   const row=(m:Msg,unread:boolean)=>({id:String(m.messageId),folderId:String(m.folderId),subject:m.subject??'',summary:m.summary??'',from:m.sender||m.fromAddress||'',fromAddress:m.fromAddress??'',to:m.toAddress??'',
    at:Number(m.receivedTime)||0,unread,attach:m.hasAttachment==='1'});
   if(b.q){qs.set('searchKey',`entire:${b.q}`);const msgs=await zoho<Msg[]>(a,`/messages/search?${qs}`);return Response.json({messages:(msgs??[]).map(m=>row(m,false)),more:(msgs??[]).length===50});}
   // Zoho is asked for the unread ones directly, so the unread marks and the folder count are always right.
   qs.set('folderId',b.folderId);
   const uq=new URLSearchParams({folderId:b.folderId,status:'unread',start:'1',limit:'200'});
   const [msgs,un]=await Promise.all([b.unread?Promise.resolve(null):zoho<Msg[]>(a,`/messages/view?${qs}&status=all`),zoho<Msg[]>(a,`/messages/view?${uq}`).catch(()=>[] as Msg[])]);
   const unread=new Set((un??[]).map(m=>String(m.messageId)));
   const list=b.unread?(un??[]).slice(b.start-1,b.start-1+50):(msgs??[]);
   return Response.json({messages:list.map(m=>row(m,unread.has(String(m.messageId)))),more:b.unread?(un??[]).length>b.start-1+50:list.length===50,unreadCount:unread.size});
  }
  if(b.action==='read'){
   const base=`/folders/${b.folderId}/messages/${b.messageId}`;
   const [content,details,att]=await Promise.all([
    zoho<{content:string}>(a,`${base}/content`),
    zoho<{subject?:string;fromAddress?:string;sender?:string;toAddress?:string;ccAddress?:string;receivedTime?:string;replyTo?:string}>(a,`${base}/details`),
    zoho<{attachments?:{attachmentId:string;attachmentName:string;attachmentSize:number}[]}>(a,`${base}/attachmentinfo`).catch(()=>({attachments:[]})),
   ]);
   void zoho(a,'/updatemessage',{method:'PUT',json:{mode:'markAsRead',messageId:[b.messageId]}}).catch(()=>0);
   return Response.json({html:content?.content??'',subject:details?.subject??'',from:details?.sender??'',fromAddress:details?.fromAddress??'',to:details?.toAddress??'',cc:details?.ccAddress??'',replyTo:details?.replyTo??'',
    at:Number(details?.receivedTime)||0,files:(att?.attachments??[]).map(x=>({id:String(x.attachmentId),name:x.attachmentName,size:Number(x.attachmentSize)||0}))});
  }
  if(b.action==='link_sign'){
   const key=`private/zarn/mail/${crypto.randomUUID()}/${b.name.replace(/[^\w.-]+/g,'_').slice(-120)||'file'}`;
   return Response.json({key,url:await signPut(key,b.type||'application/octet-stream')});
  }
  if(b.action==='flag'){await zoho(a,'/updatemessage',{method:'PUT',json:{mode:b.mode,messageId:b.messageIds}});return Response.json({ok:true});}
  if(b.action==='send'){
   // The composer's HTML (script and event handlers stripped), big files as download links, then the earlier email quoted.
   let html=`<div style="font-family:Arial,sans-serif;font-size:14px">${clean(b.html)}</div>`;
   if(b.links.length){const o=new URL(request.url).origin;
    html+=`<div style="margin-top:14px;font-family:Arial,sans-serif;font-size:13px">${b.links.map(l=>`<div style="margin:4px 0">&#128206; <a href="${o}/api/zarn/mail/file?k=${encodeURIComponent(l.key)}">${esc(l.name)}</a> <span style="color:#777">(${(l.size/1024/1024).toFixed(1)} MB)</span></div>`).join('')}</div>`;}
   if(b.reply){
    const base=`/folders/${b.reply.folderId}/messages/${b.reply.messageId}`;
    const [c,d]=await Promise.all([zoho<{content:string}>(a,`${base}/content`).catch(()=>null),zoho<{sender?:string;receivedTime?:string}>(a,`${base}/details`).catch(()=>null)]);
    if(c?.content)html+=`<br><div>On ${new Date(Number(d?.receivedTime)||Date.now()).toUTCString()}, ${esc(d?.sender??'')} wrote:</div><blockquote style="margin:0 0 0 8px;padding-left:10px;border-left:2px solid #ccc">${c.content}</blockquote>`;
   }
   const msg={fromAddress:a.email,toAddress:list(b.to),ccAddress:list(b.cc)||undefined,bccAddress:list(b.bcc)||undefined,attachments:b.attachments.length?b.attachments:undefined,subject:b.subject||'(no subject)',content:html,mailFormat:'html',
    ...(b.reply&&b.reply.mode!=='forward'?{action:'reply'}:{})};
   await zoho(a,b.reply&&b.reply.mode!=='forward'?`/messages/${b.reply.messageId}`:'/messages',{method:'POST',json:msg});
   return Response.json({ok:true});
  }
  // disconnect: forget the mailbox here and cancel the token at Zoho.
  await fetch(`${a.accounts_server}/oauth/v2/token/revoke?token=${encodeURIComponent(decrypt(a.refresh_token))}`,{method:'POST'}).catch(()=>0);
  await serviceClient().from('zarn_mail_accounts').delete().eq('user_id',me.user_id);
  return Response.json({ok:true});
 }catch(e){
  if(e instanceof MailError)return fail(e.message,e.status===401?401:502);
  return fail('Zoho Mail did not respond. Try again.',502);
 }
}

// Attachments stream through here so the Zoho token never reaches the browser.
export async function GET(request:Request){
 const me=await zarnMember();if(!me||me.account_type==='guest')return fail('Sign in first.',401);
 const u=new URL(request.url).searchParams,[f,m,at]=['f','m','a'].map(k=>u.get(k)??'');
 if(![f,m,at].every(x=>/^\d{1,30}$/.test(x)))return fail('Invalid request');
 const a:MailAccount|null=await getAccount(me.user_id);if(!a)return fail('Connect Zoho Mail first.',409);
 try{
  const r=await zoho<Response>(a,`/folders/${f}/messages/${m}/attachments/${at}`,{raw:true});
  const name=(u.get('n')||'attachment').replace(/[\r\n"\\]/g,'').slice(0,200);
  return new Response(r.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return fail('Could not get that file from Zoho.',502);}
}
