'use client';
import {Play,Volume1,Volume2,VolumeX,X} from 'lucide-react';
import {playChime,tones,updateSound,useSoundSettings,type Scope,type Tone,type Volume} from '@/lib/zarn-sound';
// Message sound settings for this browser: on/off, which sound, how loud, and which messages make a sound.
export default function SoundDialog({onClose}:{onClose:()=>void}){
 return <div className="zn-modal-scrim" onClick={onClose}><div className="zn-modal zn-sound-modal" role="dialog" aria-label="Message sounds" onClick={e=>e.stopPropagation()}>
  <div className="zn-modal-head"><h2>Message sounds</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
  <div className="zn-modal-body" data-lenis-prevent><SoundSettings/></div>
 </div></div>;
}
const volumes:[Volume,string][]=[['low','Low'],['medium','Medium'],['high','High'],['max','Max']];
// The sound controls on their own, shared with the Preferences window.
export function SoundSettings(){
 const s=useSoundSettings();
 const seg=<T extends string>(cur:T,opts:[T,string][],set:(v:T)=>void,label:string)=><div className="zn-seg" role="radiogroup" aria-label={label}>{opts.map(([v,l])=><button key={v} type="button" role="radio" aria-checked={cur===v} className={`zn-seg-btn${cur===v?' is-on':''}`} onClick={()=>set(v)}>{l}</button>)}</div>;
 return <div className="zn-snd">
  <button type="button" role="switch" aria-checked={s.on} className="zn-snd-toggle" onClick={()=>{updateSound({on:!s.on});if(!s.on)playChime(true);}}>
   <span className="zn-snd-ico">{s.on?<Volume2 size={18}/>:<VolumeX size={18}/>}</span><span><b>Play a sound for new messages</b><small>Applies to this browser or phone only.</small></span><i className={s.on?'is-on':''}/>
  </button>
  <div className={`zn-snd-opts${s.on?'':' is-off'}`}>
   <p className="zn-snd-label">Sound <span>Click to hear it</span></p>
   <div className="zn-snd-grid">{tones.map(t=><button key={t.id} type="button" className={s.tone===t.id?'is-on':''} onClick={()=>{updateSound({tone:t.id as Tone});playChime(true,{tone:t.id as Tone});}}><Play size={13}/>{t.label}{t.loud&&<em>Loud</em>}</button>)}</div>
   <p className="zn-snd-label">Volume {s.volume==='max'&&<span className="is-warn">Very loud</span>}</p>
   <div className="zn-snd-vol"><Volume1 size={16}/>{seg<Volume>(s.volume,volumes,v=>{updateSound({volume:v});playChime(true,{volume:v});},'Volume')}<Volume2 size={16}/></div>
   <p className="zn-snd-label">Play for</p>
   {seg<Scope>(s.scope,[['direct','DMs and mentions'],['all','Every message']],v=>updateSound({scope:v}),'Play for')}
   <p className="zn-snd-credit">Sounds by <a href="https://notifysound.com" target="_blank" rel="noopener noreferrer">Notify Sound</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.</p>
  </div>
 </div>;
}
