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
export function campaignEmail(body:string,token:string){
 const url=unsubscribeUrl(token),site=siteUrl();
 const html=`<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;font-family:system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<tr><td style="padding:0 4px 18px"><a href="${site}" style="text-decoration:none;color:#111;font-size:20px;font-weight:700;letter-spacing:-.02em"><span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background:${RED};color:#fff;border-radius:7px;font-size:16px;margin-right:9px;vertical-align:middle">Z</span><span style="vertical-align:middle">zaane.co</span></a></td></tr>
<tr><td style="background:#fff;border-radius:16px;padding:36px 34px 20px;font-size:16px;line-height:1.65;color:#27272a">${bodyToHtml(body)}</td></tr>
<tr><td style="padding:22px 8px 0;font-size:12px;line-height:1.6;color:#71717a;text-align:center">You’re getting this because you joined the Zaane newsletter.<br><a href="${url}" style="color:#71717a;text-decoration:underline">Unsubscribe</a> &nbsp;·&nbsp; <a href="${site}" style="color:#71717a;text-decoration:underline">zaane.co</a></td></tr>
</table></td></tr></table></body></html>`;
 return {html,text:`${body.trim()}\n\n--\nYou’re getting this because you joined the Zaane newsletter. Unsubscribe: ${url}`,url};
}
