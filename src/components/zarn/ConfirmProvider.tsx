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
 const ok=useRef<HTMLButtonElement>(null),cancel=useRef<HTMLButtonElement>(null);
 // Anything dangerous (deleting, removing) takes two steps: the question, then a last check.
 const [step,setStep]=useState<1|2>(1),[armed,setArmed]=useState(true);
 const ask=useCallback((o:Ask)=>new Promise<boolean>(res=>{setStep(1);setArmed(true);setReq({o,res});}),[]);
 const done=useCallback((v:boolean)=>{setReq(r=>{r?.res(v);return null;});setStep(1);},[]);
 const yes=()=>{if(!req)return;if(req.o.danger!==false&&step===1){setStep(2);setArmed(false);setTimeout(()=>setArmed(true),700);return;}if(armed)done(true);};
 useEffect(()=>{if(step===2)cancel.current?.focus();},[step]);
 useEffect(()=>{
  if(!req)return;
  const k=(e:KeyboardEvent)=>{if(e.key==='Escape')done(false);};
  window.addEventListener('keydown',k);ok.current?.focus();
  return()=>window.removeEventListener('keydown',k);
 },[req,done]);
 return <Ctx.Provider value={ask}>{children}
  {req&&createPortal(<div className="zn-modal-scrim" onClick={()=>done(false)}><div className="zn-modal zn-confirm" role="alertdialog" aria-modal="true" aria-label={req.o.title} onClick={e=>e.stopPropagation()}>
   <span className={`zn-confirm-ico${req.o.danger===false?'':' is-danger'}`}><AlertTriangle size={20}/></span>
   {step===1?<><h2>{req.o.title}</h2>{req.o.message&&<p>{req.o.message}</p>}</>
    :<><h2>Last check</h2><p>Are you sure? This is the final step, and it goes ahead as soon as you confirm.</p><p className="zn-confirm-what">{req.o.title}</p></>}
   {req.o.danger!==false&&<span className="zn-confirm-steps" aria-label={`Step ${step} of 2`}><i className="is-on"/><i className={step===2?'is-on':''}/></span>}
   <div className="zn-modal-foot"><button ref={cancel} type="button" className="zn-btn" onClick={()=>done(false)}>Cancel</button><button ref={ok} type="button" disabled={!armed} className={`zn-btn ${req.o.danger===false?'is-primary':'is-danger'}`} onClick={yes}>{step===2?`Yes, ${(req.o.confirm??'confirm').replace(/^./,c=>c.toLowerCase())}`:req.o.confirm??'Confirm'}</button></div>
  </div></div>,document.querySelector('.zarn')??document.body)}
 </Ctx.Provider>;
}
