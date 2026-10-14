'use client';
import {useEffect,useState} from 'react';
// Instant tooltips for any admin element with data-tip. Rendered fixed so table/editor scroll containers never clip them.
export default function TipLayer(){
 const [tip,setTip]=useState<{text:string;x:number;y:number;below:boolean}|null>(null);
 useEffect(()=>{
  let current:Element|null=null;
  const show=(el:Element|null)=>{
   const target=el?.closest?.('[data-tip]')??null;if(target===current)return;current=target;
   if(!target){setTip(null);return;}
   const r=target.getBoundingClientRect(),below=r.top<48;
   setTip({text:target.getAttribute('data-tip')||'',x:Math.min(Math.max(r.left+r.width/2,70),window.innerWidth-70),y:below?r.bottom+8:r.top-8,below});
  };
  const over=(e:Event)=>show(e.target as Element),hide=()=>{current=null;setTip(null);};
  document.addEventListener('mouseover',over);document.addEventListener('focusin',over);
  document.addEventListener('mousedown',hide);document.addEventListener('scroll',hide,true);window.addEventListener('blur',hide);
  return()=>{document.removeEventListener('mouseover',over);document.removeEventListener('focusin',over);document.removeEventListener('mousedown',hide);document.removeEventListener('scroll',hide,true);window.removeEventListener('blur',hide);};
 },[]);
 if(!tip?.text)return null;
 return <div role="tooltip" className="za-tip" style={{left:tip.x,top:tip.y,transform:`translate(-50%,${tip.below?'0':'-100%'})`}}>{tip.text}</div>;
}
