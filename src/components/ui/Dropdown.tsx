'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown} from 'lucide-react';
import './dropdown.css';

export type DropOption={value:string;label:string;color?:string;group?:string;hint?:string};
type Pos={left:number;width:number;top?:number;bottom?:number;maxHeight:number};

// Styled replacement for <select>, used in the admin and in ZARN. The menu is fixed-positioned inside the
// themed root so it picks up the right colours and is never clipped by a modal or card.
export default function Dropdown({value,options,onChange,label,id,placeholder,disabled,variant='field',className='',style,icon}:{
 value:string;options:DropOption[];onChange:(v:string)=>void;label?:string;id?:string;placeholder?:string;disabled?:boolean;
 variant?:'field'|'toolbar'|'pill'|'inline';className?:string;style?:React.CSSProperties;icon?:React.ReactNode;
}){
 const [open,setOpen]=useState(false),[hover,setHover]=useState(-1),[pos,setPos]=useState<Pos|null>(null),[root,setRoot]=useState<Element|null>(null);
 const btn=useRef<HTMLButtonElement>(null),menu=useRef<HTMLUListElement>(null),typed=useRef({text:'',at:0});
 const current=options.find(o=>o.value===value);

 const place=()=>{
  const r=btn.current?.getBoundingClientRect();if(!r)return;
  const below=innerHeight-r.bottom-12,above=r.top-12,want=Math.min(320,options.length*38+12);
  const width=Math.max(r.width,180),left=Math.min(r.left,innerWidth-width-12);
  setPos(below>=want||below>=above?{left,width,top:r.bottom+6,maxHeight:Math.min(320,below)}:{left,width,bottom:innerHeight-r.top+6,maxHeight:Math.min(320,above)});
 };
 function show(){
  if(disabled)return;
  setRoot(btn.current?.closest('.za-admin,.zarn')??document.body);
  place();setHover(Math.max(0,options.findIndex(o=>o.value===value)));setOpen(true);
 }
 const close=(focus=true)=>{setOpen(false);if(focus)btn.current?.focus();};
 const pick=(v:string)=>{if(v!==value)onChange(v);close();};

 useEffect(()=>{
  if(!open)return;
  const down=(e:MouseEvent)=>{const t=e.target as Node;if(!btn.current?.contains(t)&&!menu.current?.contains(t))close(false);};
  const scroll=(e:Event)=>{if(!menu.current?.contains(e.target as Node))close(false);};
  const resize=()=>close(false);
  document.addEventListener('mousedown',down);window.addEventListener('scroll',scroll,true);window.addEventListener('resize',resize);
  return()=>{document.removeEventListener('mousedown',down);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',resize);};
 },[open]);
 // Keep the highlighted option in view while using the arrow keys.
 useLayoutEffect(()=>{if(open)menu.current?.querySelector<HTMLElement>(`[data-i="${hover}"]`)?.scrollIntoView({block:'nearest'});},[open,hover]);

 function key(e:React.KeyboardEvent){
  if(disabled)return;
  if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();close();return;}
  if(e.key==='Tab'){if(open)close(false);return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!open){show();return;}setHover(h=>(h+(e.key==='ArrowDown'?1:-1)+options.length)%options.length);return;}
  if(e.key==='Home'||e.key==='End'){if(open){e.preventDefault();setHover(e.key==='Home'?0:options.length-1);}return;}
  if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!open)show();else if(hover>=0)pick(options[hover].value);return;}
  if(e.key.length===1&&/\S/.test(e.key)){
   // Type to jump, like a native select.
   const now=Date.now(),t=typed.current;t.text=(now-t.at<700?t.text:'')+e.key.toLowerCase();t.at=now;
   const i=options.findIndex(o=>o.label.toLowerCase().startsWith(t.text));
   if(i>=0){if(open)setHover(i);else if(options[i].value!==value)onChange(options[i].value);}
  }
 }

 const pill=variant==='pill';
 return <>
  <button ref={btn} id={id} type="button" disabled={disabled} className={`dd dd-${variant}${open?' is-open':''}${current?'':' is-empty'} ${className}`} style={pill?{background:current?.color??'#52525b',...style}:style}
   aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={()=>open?close():show()} onKeyDown={key}>
   {icon}{!pill&&current?.color&&<i className="dd-dot" style={{background:current.color}}/>}
   <span className="dd-value">{current?.label??placeholder??'Choose…'}</span><ChevronDown size={pill?13:14} className="dd-chev"/>
  </button>
  {open&&pos&&root&&createPortal(
   <ul ref={menu} className="dd-menu" role="listbox" aria-label={label} style={{left:pos.left,minWidth:pos.width,top:pos.top,bottom:pos.bottom,maxHeight:pos.maxHeight}} onKeyDown={key}>
    {options.map((o,i)=><li key={o.value||`_${i}`} role="presentation">
     {o.group&&o.group!==options[i-1]?.group&&<p className="dd-group">{o.group}</p>}
     <button type="button" role="option" tabIndex={-1} data-i={i} aria-selected={o.value===value} className={`dd-opt${i===hover?' is-hover':''}`} onMouseEnter={()=>setHover(i)} onClick={()=>pick(o.value)}>
      {o.color&&<i className="dd-dot" style={{background:o.color}}/>}<span>{o.label}{o.hint&&<small>{o.hint}</small>}</span>{o.value===value&&<Check size={14} className="dd-check"/>}
     </button>
    </li>)}
   </ul>,root)}
 </>;
}
