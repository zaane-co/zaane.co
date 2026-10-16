'use client';
import {useMemo,useState} from 'react';
import {Search,X} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {Avatar} from './format';
// Pick people by searching, so it still works with hundreds of staff. Chosen people show as chips you can remove.
export default function AssigneePicker({candidates,value,onToggle}:{candidates:string[];value:string[];onToggle:(id:string)=>void}){
 const {people,me}=useZarn();
 const [q,setQ]=useState(''),[open,setOpen]=useState(false);
 const name=(id:string)=>id===me.user_id?'Me':people[id]?.display_name??'Member';
 const results=useMemo(()=>{
  const s=q.trim().toLowerCase();
  return candidates.filter(id=>!value.includes(id)&&(!s||`${people[id]?.display_name??''} ${people[id]?.title??''} ${people[id]?.email??''}`.toLowerCase().includes(s))).slice(0,8);
 },[candidates,value,q,people]);
 return <div className="zp-picker">
  {value.length>0&&<div className="zp-assign">{value.map(id=><button key={id} type="button" className="is-on" aria-label={`Remove ${name(id)}`} onClick={()=>onToggle(id)}><Avatar m={people[id]} size={20}/>{name(id)}<X size={13}/></button>)}</div>}
  <label className="zp-picker-input"><Search size={14}/><input value={q} placeholder={value.length?'Add more people':'Search people to assign'} onChange={e=>{setQ(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),150)} aria-label="Search people"/></label>
  {open&&<ul className="zp-picker-list" role="listbox">{results.length?results.map(id=><li key={id}><button type="button" role="option" aria-selected="false" onMouseDown={e=>e.preventDefault()} onClick={()=>{onToggle(id);setQ('');}}><Avatar m={people[id]} size={26}/><span><b>{name(id)}</b><small>{people[id]?.title||people[id]?.email||''}</small></span></button></li>):<li className="zp-picker-empty">{q?'No one matches.':'Everyone is already assigned.'}</li>}</ul>}
 </div>;
}
