'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {AlertTriangle} from 'lucide-react';
// An in-app confirmation overlay used instead of the browser's confirm() box: await confirm({...}) resolves true or false.
type Ask={title:string;message?:string;confirm?:string;danger?:boolean};
const Ctx=createContext<(o:Ask)=>Promise<boolean>>(async()=>false);
export const useConfirm=()=>useContext(Ctx);
export default function ConfirmProvider({children}:{children:React.ReactNode}){
 const [req,setReq]=useState<{o:Ask;res:(v:boolean)=>void}|null>(null);
 const ok=useRef<HTMLButtonElement>(null);
 const ask=useCallback((o:Ask)=>new Promise<boolean>(res=>setReq({o,res})),[]);
 const done=useCallback((v:boolean)=>{setReq(r=>{r?.res(v);return null;});},[]);
 useEffect(()=>{
  if(!req)return;
  const k=(e:KeyboardEvent)=>{if(e.key==='Escape')done(false);};
  window.addEventListener('keydown',k);ok.current?.focus();
  return()=>window.removeEventListener('keydown',k);
 },[req,done]);
 return <Ctx.Provider value={ask}>{children}
  {req&&createPortal(<div className="zn-modal-scrim" onClick={()=>done(false)}><div className="zn-modal zn-confirm" role="alertdialog" aria-modal="true" aria-label={req.o.title} onClick={e=>e.stopPropagation()}>
   <span className={`zn-confirm-ico${req.o.danger===false?'':' is-danger'}`}><AlertTriangle size={20}/></span>
   <h2>{req.o.title}</h2>
   {req.o.message&&<p>{req.o.message}</p>}
   <div className="zn-modal-foot"><button type="button" className="zn-btn" onClick={()=>done(false)}>Cancel</button><button ref={ok} type="button" className={`zn-btn ${req.o.danger===false?'is-primary':'is-danger'}`} onClick={()=>done(true)}>{req.o.confirm??'Confirm'}</button></div>
  </div></div>,document.querySelector('.zarn')??document.body)}
 </Ctx.Provider>;
}
