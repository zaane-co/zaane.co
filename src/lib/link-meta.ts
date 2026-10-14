import 'server-only';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
// Pulls title/description/image for a curated link (ported from Finance with Anne). Falls back to a partial result so the admin can fill it in by hand.
const decode=(s:string)=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&apos;/g,"'");
function attr(html:string,prop:string){
 for(const re of [new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"'<>]+)["']`,'i'),new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+(?:property|name)=["']${prop}["']`,'i')]){const m=html.match(re);if(m)return decode(m[1]);}
 return null;
}
const known:Record<string,string>={'techcrunch.com':'TechCrunch','theverge.com':'The Verge','wired.com':'WIRED','smashingmagazine.com':'Smashing Magazine','css-tricks.com':'CSS-Tricks','medium.com':'Medium','nngroup.com':'Nielsen Norman Group','figma.com':'Figma','vercel.com':'Vercel','a16z.com':'a16z','ycombinator.com':'Y Combinator','forbes.com':'Forbes','bloomberg.com':'Bloomberg','reuters.com':'Reuters','bbc.com':'BBC','bbc.co.uk':'BBC','nytimes.com':'New York Times','theguardian.com':'The Guardian','fastcompany.com':'Fast Company','techcabal.com':'TechCabal'};
export function domainToName(url:string){try{const host=new URL(url).hostname.replace(/^www\./,'');if(known[host])return known[host];const p=host.split('.')[0];return p.charAt(0).toUpperCase()+p.slice(1);}catch{return 'Source';}}
const absolute=(img:string,base:string)=>{try{return img?new URL(img,base).href:'';}catch{return '';}};
// Refuse to fetch internal addresses from the server.
function privateAddr(ip:string):boolean{
 if(isIP(ip)===6){const v=ip.toLowerCase();return v==='::1'||v.startsWith('fc')||v.startsWith('fd')||v.startsWith('fe80')||v.startsWith('::ffff:')&&privateAddr(v.slice(7));}
 const [a,b]=ip.split('.').map(Number);return a===10||a===127||a===0||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127;
}
async function safeTarget(url:string){try{const u=new URL(url);if(!['http:','https:'].includes(u.protocol))return false;const {address}=await lookup(u.hostname);return !privateAddr(address);}catch{return false;}}
async function tryDirect(url:string){
 if(!await safeTarget(url))return null;
 const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',Accept:'text/html'},signal:AbortSignal.timeout(8000),redirect:'manual'});
 if(!res.ok)return null;
 const html=(await res.text()).slice(0,500000);
 const title=attr(html,'og:title')??html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim();
 if(!title)return null;
 return {title:decode(title),description:attr(html,'og:description')??attr(html,'description')??'',image:absolute(attr(html,'og:image')??'',url),site_name:attr(html,'og:site_name')??domainToName(url)};
}
async function tryMicrolink(url:string){
 const res=await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false&meta=true`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(8000)});
 if(!res.ok)return null;const j=await res.json();if(j.status!=='success'||!j.data?.title)return null;
 return {title:j.data.title??'',description:j.data.description??'',image:j.data.image?.url??'',site_name:j.data.publisher??domainToName(url)};
}
export async function fetchMeta(url:string){
 const results=await Promise.allSettled([tryDirect(url),tryMicrolink(url)]);
 for(const r of results)if(r.status==='fulfilled'&&r.value?.title){const img=/^https?:/.test(r.value.image)?r.value.image:'';return {...r.value,image:img,url,partial:false};}
 return {title:'',description:'',image:'',site_name:domainToName(url),url,partial:true};
}
