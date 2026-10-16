import 'server-only';
import dns from 'dns/promises';
import net from 'net';
// Fetches the title, description and image a page advertises (Open Graph tags) so shared links can show a preview.
// The server fetches arbitrary addresses, so every hop is checked to be a public web address (no internal networks).
export type Preview={url:string;title:string;description:string;image:string;site:string};
const privateV4=(ip:string)=>{const [a,b]=ip.split('.').map(Number) as [number,number];return a===10||a===127||a===0||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||a>=224;};
const privateV6=(ip:string)=>{const x=ip.toLowerCase();return x==='::1'||x==='::'||x.startsWith('fc')||x.startsWith('fd')||x.startsWith('fe80')||x.startsWith('::ffff:');};
async function safeHost(host:string){
 if(!host||host==='localhost'||host.endsWith('.local')||host.endsWith('.internal'))return false;
 if(net.isIP(host))return net.isIPv4(host)?!privateV4(host):!privateV6(host);
 try{const addrs=await dns.lookup(host,{all:true});return addrs.length>0&&addrs.every(a=>a.family===4?!privateV4(a.address):!privateV6(a.address));}catch{return false;}
}
const decode=(s:string)=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&#x27;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
function meta(html:string,keys:string[]){
 for(const key of keys){
  const re=new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`,'i'),m=html.match(re);
  if(m){const c=m[0].match(/content=(["'])([\s\S]*?)\1/i);if(c?.[2])return decode(c[2]);}
  const re2=new RegExp(`<meta[^>]+content=(["'])([\\s\\S]*?)\\1[^>]+(?:property|name)=["']${key}["']`,'i'),m2=html.match(re2);
  if(m2?.[2])return decode(m2[2]);
 }
 return '';
}
export async function fetchPreview(input:string):Promise<Preview|null>{
 let url:URL;try{url=new URL(input);}catch{return null;}
 let html='';
 for(let hop=0;hop<4;hop++){
  if(!['http:','https:'].includes(url.protocol)||!await safeHost(url.hostname))return null;
  let res:Response;
  try{res=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(4500),headers:{'User-Agent':'Mozilla/5.0 (compatible; ZarnLinkPreview/1.0; +https://zaane.co)',Accept:'text/html,application/xhtml+xml'}});}catch{return null;}
  if(res.status>=300&&res.status<400){const loc=res.headers.get('location');if(!loc)return null;try{url=new URL(loc,url);}catch{return null;}continue;}
  if(!res.ok||!(res.headers.get('content-type')||'').includes('html')||!res.body)return null;
  const reader=res.body.getReader();let size=0;const parts:Uint8Array[]=[];
  while(size<400_000){const {done,value}=await reader.read();if(done)break;parts.push(value);size+=value.length;}
  void reader.cancel().catch(()=>{});
  html=Buffer.concat(parts).toString('utf8');
  break;
 }
 if(!html)return null;
 const title=meta(html,['og:title','twitter:title'])||decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]??'')),
  description=meta(html,['og:description','twitter:description','description']),
  imageRaw=meta(html,['og:image','og:image:url','twitter:image']),
  site=meta(html,['og:site_name'])||url.hostname.replace(/^www\./,'');
 let image='';if(imageRaw){try{const u=new URL(imageRaw,url);if(u.protocol==='https:'||u.protocol==='http:')image=u.href;}catch{}}
 if(!title&&!description&&!image)return null;
 return {url:url.href,title:title.slice(0,200),description:description.slice(0,300),image:image.slice(0,1000),site:site.slice(0,80)};
}
