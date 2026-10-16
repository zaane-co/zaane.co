'use client';
import {useEffect,useState} from 'react';
import {ExternalLink,X} from 'lucide-react';
// Full-screen view of a picture: Esc, the X or a click outside closes it.
export default function ImageLightbox({src,alt,onClose}:{src:string;alt?:string;onClose:()=>void}){
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose]);
 return <div className="zn-viewer" role="dialog" aria-label={alt||'Picture'} onClick={onClose}>
  <div className="zn-viewer-bar" onClick={e=>e.stopPropagation()}><span>{alt||'Picture'}</span><a href={src} target="_blank" rel="noopener noreferrer" aria-label="Open original"><ExternalLink size={20}/></a><button type="button" aria-label="Close" onClick={onClose}><X size={22}/></button></div>
  <img src={src} alt={alt??''} referrerPolicy="no-referrer" onClick={e=>e.stopPropagation()}/>
 </div>;
}
// For read-only text with pictures in it: click a picture to enlarge it.
export function usePictureClick(){
 const [pic,setPic]=useState<{src:string;alt:string}|null>(null);
 const onClick=(e:React.MouseEvent)=>{const t=e.target as HTMLElement;if(t.tagName==='IMG'){e.preventDefault();setPic({src:(t as HTMLImageElement).src,alt:(t as HTMLImageElement).alt});}};
 return {onClick,node:pic?<ImageLightbox src={pic.src} alt={pic.alt} onClose={()=>setPic(null)}/>:null};
}
