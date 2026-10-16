'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import ImageLightbox from './ImageLightbox';
type P={url:string;title:string;description:string;image:string;site:string};
const cache=new Map<string,Promise<P|null>>();
const load=(url:string)=>{
 let p=cache.get(url);
 if(!p){p=fetch(`/api/zarn/preview?url=${encodeURIComponent(url)}`).then(r=>r.ok?r.json():null).then(d=>(d?.preview??null) as P|null).catch(()=>null);cache.set(url,p);}
 return p;
};
export const firstLink=(body:string)=>{const m=body.replace(/<@[^>]+>|<!channel>/g,'').match(/https?:\/\/[^\s<>"')\]]+/i);return m?m[0].replace(/[.,;:!?]+$/,''):null;};
// A card under a message that contains a link. The picture opens large; the rest of the card opens the page.
export default function LinkPreview({url}:{url:string}){
 const [p,setP]=useState<P|null>(null),[zoom,setZoom]=useState(false),[bad,setBad]=useState(false);
 useEffect(()=>{let live=true;void load(url).then(x=>{if(live)setP(x);});return()=>{live=false;};},[url]);
 if(!p)return null;
 const showImage=!!p.image&&!bad;
 return <div className={`zn-lp${showImage?' has-img':''}`}>
  {showImage&&<button type="button" className="zn-lp-img" aria-label="View picture" onClick={()=>setZoom(true)}><img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setBad(true)}/></button>}
  <a className="zn-lp-body" href={url} target="_blank" rel="noopener noreferrer">
   <span className="zn-lp-site"><i>{(p.site||'?').slice(0,1).toUpperCase()}</i>{p.site}<ArrowUpRight size={13}/></span>
   <b>{p.title||url}</b>
   {p.description&&<em>{p.description}</em>}
  </a>
  {zoom&&<ImageLightbox src={p.image} alt={p.title} onClose={()=>setZoom(false)}/>}
 </div>;
}
