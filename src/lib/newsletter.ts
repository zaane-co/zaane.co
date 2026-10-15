import sanitize from 'sanitize-html';
export const siteUrl=()=>(process.env.NEXT_PUBLIC_SITE_URL||'https://zaane.co').replace(/\/$/,'');
export const unsubscribeUrl=(token:string)=>`${siteUrl()}/unsubscribe?t=${token}`;
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const RED='#c40a3a';
const inline=(s:string)=>esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/(https?:\/\/[^\s<]+)/g,`<a href="$1" style="color:${RED};text-decoration:underline">$1</a>`);
// Campaigns are written as plain text. Blank line = new paragraph. "# Title" = heading,
// "button: Label | https://link" = button, "- item" lines = list, **bold**, bare links are clickable.
export function bodyToHtml(body:string){
 return body.trim().split(/\n{2,}/).map(block=>{
  const b=block.trim();
  const btn=b.match(/^button:\s*(.+?)\s*\|\s*(https?:\/\/\S+)$/i);
  if(btn)return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:${RED};border-radius:999px"><a href="${esc(btn[2])}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#fff;text-decoration:none">${esc(btn[1])}</a></td></tr></table>`;
  if(/^#\s+/.test(b))return `<h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;letter-spacing:-.02em;font-weight:600;color:#111">${inline(b.replace(/^#\s+/,''))}</h1>`;
  const lines=b.split('\n');
  if(lines.every(l=>/^[-*]\s+/.test(l)))return `<ul style="margin:0 0 18px;padding-left:20px">${lines.map(l=>`<li style="margin:0 0 6px">${inline(l.replace(/^[-*]\s+/,''))}</li>`).join('')}</ul>`;
  return `<p style="margin:0 0 18px">${inline(b).replace(/\n/g,'<br>')}</p>`;
 }).join('');
}
export const isHtmlBody=(s:string)=>/^\s*</.test(s);
// Fonts that survive in email clients (web fonts don't), offered by the editor's font menu.
export const emailFonts=[
 {label:'Default',value:''},
 {label:'Georgia',value:"Georgia, 'Times New Roman', serif"},
 {label:'Trebuchet',value:"'Trebuchet MS', Helvetica, sans-serif"},
 {label:'Verdana',value:'Verdana, Geneva, sans-serif'},
 {label:'Courier',value:"'Courier New', Courier, monospace"},
];
const base={
 p:'margin:0 0 18px;',h1:'margin:0 0 16px;font-size:26px;line-height:1.25;letter-spacing:-.02em;font-weight:600;color:#111;',
 h2:'margin:0 0 14px;font-size:21px;line-height:1.3;font-weight:600;color:#111;',ul:'margin:0 0 18px;padding-left:20px;',ol:'margin:0 0 18px;padding-left:20px;',li:'margin:0 0 6px;',
 blockquote:'margin:0 0 18px;padding-left:16px;border-left:3px solid #d4d4d8;color:#52525b;',hr:'border:0;border-top:1px solid #e4e4e7;margin:24px 0;',
 img:'display:block;max-width:100%;height:auto;border-radius:10px;margin:0 0 18px;',
};
const button=`display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#fff;background:${RED};border-radius:999px;text-decoration:none;`;
const safeValue=/^(?!.*url\()[\w\s#%.,'"()-]{1,160}$/;
const styleKeys=['text-align','color','font-family','font-size','font-weight','font-style','text-decoration','line-height','letter-spacing','margin','padding','display','max-width','width','height','border-radius','border-left','border-top','background','background-color'];
const allowedStyles=Object.fromEntries(styleKeys.map(k=>[k,[safeValue]]));
const withBase=(tag:keyof typeof base)=>(tagName:string,attribs:sanitize.Attributes)=>({tagName,attribs:{...attribs,style:base[tag]+(attribs.style||'')}});
// What the rich editor writes is sanitized and given inline styles, because email clients ignore stylesheets.
export function richBodyToEmail(html:string){return sanitize(html,{
 allowedTags:['p','br','h1','h2','h3','strong','b','em','i','u','s','a','ul','ol','li','blockquote','img','span','hr','div'],
 allowedAttributes:{a:['href','data-button','target','rel','style'],img:['src','alt','width','style'],'*':['style']},
 allowedStyles:{'*':allowedStyles},
 allowedSchemes:['http','https','mailto'],allowedSchemesByTag:{img:['http','https']},
 transformTags:{
  p:withBase('p'),h1:withBase('h1'),h2:withBase('h2'),h3:withBase('h2'),ul:withBase('ul'),ol:withBase('ol'),li:withBase('li'),blockquote:withBase('blockquote'),hr:withBase('hr'),img:withBase('img'),
  a:(tagName,attribs)=>({tagName,attribs:{...attribs,rel:'noopener noreferrer',target:'_blank',style:attribs['data-button']?button+(attribs.style||''):`color:${RED};text-decoration:underline;`+(attribs.style||'')}}),
 },
});}
export const bodyToEmailHtml=(body:string)=>isHtmlBody(body)?richBodyToEmail(body):bodyToHtml(body);
const plain=(html:string)=>sanitize(html.replace(/<\/(p|h[1-3]|li|blockquote)>|<br\s*\/?>|<hr\s*\/?>/gi,'\n$&').replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi,'$2 ($1)'),{allowedTags:[],allowedAttributes:{}}).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\n{3,}/g,'\n\n').trim();
export const bodyToText=(body:string)=>isHtmlBody(body)?plain(body):body.trim();
// Older drafts were plain text with a few markers; open them in the rich editor as HTML.
export function legacyToEditorHtml(body:string){
 if(!body.trim())return '';
 return body.trim().split(/\n{2,}/).map(block=>{
  const b=block.trim(),btn=b.match(/^button:\s*(.+?)\s*\|\s*(https?:\/\/\S+)$/i);
  if(btn)return `<p><a href="${esc(btn[2])}" data-button="true">${esc(btn[1])}</a></p>`;
  if(/^#\s+/.test(b))return `<h1>${inline(b.replace(/^#\s+/,''))}</h1>`;
  const lines=b.split('\n');
  if(lines.every(l=>/^[-*]\s+/.test(l)))return `<ul>${lines.map(l=>`<li>${inline(l.replace(/^[-*]\s+/,''))}</li>`).join('')}</ul>`;
  return `<p>${inline(b).replace(/\n/g,'<br>')}</p>`;
 }).join('');
}
export function campaignEmail(body:string,token:string){
 const url=unsubscribeUrl(token),site=siteUrl();
 const html=`<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;font-family:system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<tr><td style="padding:0 4px 18px"><a href="${site}" style="text-decoration:none;color:#111;font-size:20px;font-weight:700;letter-spacing:-.02em"><span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background:${RED};color:#fff;border-radius:7px;font-size:16px;margin-right:9px;vertical-align:middle">Z</span><span style="vertical-align:middle">zaane.co</span></a></td></tr>
<tr><td style="background:#fff;border-radius:16px;padding:36px 34px 20px;font-size:16px;line-height:1.65;color:#27272a">${bodyToEmailHtml(body)}</td></tr>
<tr><td style="padding:22px 8px 0;font-size:12px;line-height:1.6;color:#71717a;text-align:center">You’re getting this because you joined the Zaane newsletter.<br><a href="${url}" style="color:#71717a;text-decoration:underline">Unsubscribe</a> &nbsp;·&nbsp; <a href="${site}" style="color:#71717a;text-decoration:underline">zaane.co</a></td></tr>
</table></td></tr></table></body></html>`;
 return {html,text:`${bodyToText(body)}\n\n--\nYou’re getting this because you joined the Zaane newsletter. Unsubscribe: ${url}`,url};
}
