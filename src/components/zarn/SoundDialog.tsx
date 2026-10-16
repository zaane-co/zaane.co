'use client';
import {Play,X} from 'lucide-react';
import {playChime,tones,updateSound,useSoundSettings,type Scope,type Tone,type Volume} from '@/lib/zarn-sound';
// Message sound settings for this browser: on/off, which sound, how loud, and which messages make a sound.
const opt=<T extends string>(cur:T,val:T,label:string,set:(v:T)=>void)=><button type="button" key={val} role="radio" aria-checked={cur===val} className={`zn-seg-btn${cur===val?' is-on':''}`} onClick={()=>set(val)}>{label}</button>;
export default function SoundDialog({onClose}:{onClose:()=>void}){
 const s=useSoundSettings();
 return <div className="zn-modal-scrim" onClick={onClose}><div className="zn-modal" role="dialog" aria-label="Message sounds" onClick={e=>e.stopPropagation()}>
  <div className="zn-modal-head"><h2>Message sounds</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
  <div className="zn-modal-body">
   <label className="zn-sound-row"><span><b>Play a sound for new messages</b><small>Applies to this browser or phone only.</small></span><input type="checkbox" checked={s.on} onChange={e=>{updateSound({on:e.target.checked});if(e.target.checked)playChime(true);}}/></label>
   <div className={`zn-sound-opts${s.on?'':' is-off'}`}>
    <div className="zn-sound-field"><small>Sound</small><div className="zn-seg" role="radiogroup" aria-label="Sound">{tones.map(t=>opt<Tone>(s.tone,t.id,t.label,v=>{updateSound({tone:v});playChime(true,{tone:v});}))}</div></div>
    <div className="zn-sound-field"><small>Volume</small><div className="zn-seg" role="radiogroup" aria-label="Volume">{(['low','medium','high'] as Volume[]).map(v=>opt<Volume>(s.volume,v,v[0]!.toUpperCase()+v.slice(1),x=>{updateSound({volume:x});playChime(true,{volume:x});}))}</div></div>
    <div className="zn-sound-field"><small>Play for</small><div className="zn-seg" role="radiogroup" aria-label="Play for">{opt<Scope>(s.scope,'direct','DMs and mentions',v=>updateSound({scope:v}))}{opt<Scope>(s.scope,'all','Every message',v=>updateSound({scope:v}))}</div></div>
    <button type="button" className="zn-btn" onClick={()=>playChime(true)}><Play size={14}/>Play sample</button>
   </div>
  </div>
 </div></div>;
}
