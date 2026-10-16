'use client';
import {useEffect,useState} from 'react';
import {ExternalLink} from 'lucide-react';
type P={url:string;title:string;description:string;image:string;site:string};
const cache=new Map<string,Promise<P|null>>();
const load=(url:string)=>{
 let p=cache.get(url);
 if(!p){p=fetch(`/api/zarn/preview?url=${encodeURIComponent(url)}`).then(r=>r.ok?r.json():null).then(d=>(d?.preview??null) as P|null).catch(()=>null);cache.set(url,p);}
 return p;
};
export const firstLink=(body:string)=>{const m=body.replace(/<@[^>]+>|<!channel>/g,'').match(/https?:\/\/[^\s<>"')\]]+/i);return m?m[0].replace(/[.,;:!?]+$/,''):null;};
// A card under a message that contains a link: the page's picture, site, title and description.
export default function LinkPreview({url}:{url:string}){
 const [p,setP]=useState<P|null>(null);
 useEffect(()=>{let live=true;void load(url).then(x=>{if(live)setP(x);});return()=>{live=false;};},[url]);
 if(!p)return null;
 return <a className="zn-linkcard" href={url} target="_blank" rel="noopener noreferrer">
  {p.image&&<img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';}}/>}
  <span className="zn-linkcard-text"><small>{p.site}</small><b>{p.title||url}</b>{p.description&&<em>{p.description}</em>}</span>
  <ExternalLink size={14} className="zn-linkcard-go"/>
 </a>;
}
