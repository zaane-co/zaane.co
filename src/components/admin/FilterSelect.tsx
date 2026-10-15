'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,ChevronDown} from 'lucide-react';

export type FilterOption={value:string;label:string;group?:string;avatar?:boolean};

// A styled replacement for <select> in toolbars: the menu matches the admin instead of the OS.
export default function FilterSelect({value,options,onChange,label,icon}:{value:string;options:FilterOption[];onChange:(v:string)=>void;label:string;icon?:React.ReactNode}){
 const [open,setOpen]=useState(false),[hover,setHover]=useState(-1);
 const box=useRef<HTMLDivElement>(null);
 const current=options.find(o=>o.value===value)??options[0];
 useEffect(()=>{
  if(!open)return;
  const out=(e:MouseEvent)=>{if(!box.current?.contains(e.target as Node))setOpen(false);};
  document.addEventListener('mousedown',out);return()=>document.removeEventListener('mousedown',out);
 },[open]);
 const pick=(v:string)=>{onChange(v);setOpen(false);};
 function key(e:React.KeyboardEvent){
  if(e.key==='Escape'){setOpen(false);return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!open){setOpen(true);setHover(options.indexOf(current));return;}setHover(h=>(h+(e.key==='ArrowDown'?1:-1)+options.length)%options.length);}
  if((e.key==='Enter'||e.key===' ')&&open&&hover>=0){e.preventDefault();pick(options[hover].value);}
 }
 const initials=(s:string)=>s.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
 return <div className="za-fsel" ref={box} onKeyDown={key}>
  <button type="button" className={`za-fsel-btn${value!==options[0]?.value?' is-set':''}`} aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={()=>{setOpen(o=>!o);setHover(options.indexOf(current));}}>
   {icon}<span>{current?.label}</span><ChevronDown size={14}/>
  </button>
  {open&&<ul className="za-fsel-menu" role="listbox" aria-label={label}>
   {options.map((o,i)=><li key={o.value} role="presentation">
    {o.group&&o.group!==options[i-1]?.group&&<p className="za-fsel-group">{o.group}</p>}
    <button type="button" role="option" aria-selected={o.value===value} className={`za-fsel-opt${i===hover?' is-hover':''}`} onMouseEnter={()=>setHover(i)} onClick={()=>pick(o.value)}>
     {o.avatar&&<i className="za-fsel-av">{initials(o.label)}</i>}<span>{o.label}</span>{o.value===value&&<Check size={14}/>}
    </button>
   </li>)}
  </ul>}
 </div>;
}
