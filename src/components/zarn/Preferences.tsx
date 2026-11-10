'use client';
import {useState} from 'react';
import {Bell,Clock,Paintbrush,Smile,X} from 'lucide-react';
import {useZarn} from './ZarnProvider';
import {SoundSettings} from './SoundDialog';
import {usePushState} from '@/lib/zarn-push-client';
import {useAdminTheme,writeTheme} from '@/lib/admin-theme';
type Section='availability'|'notifications'|'appearance';
const sections:{id:Section;label:string;icon:React.ReactNode}[]=[
 {id:'availability',label:'Availability',icon:<Clock size={17}/>},
 {id:'notifications',label:'Notifications',icon:<Bell size={17}/>},
 {id:'appearance',label:'Appearance',icon:<Paintbrush size={17}/>},
];
// Slack-style Preferences: sections on the left, settings on the right.
export default function Preferences({onClose,onStatus,initial='availability'}:{onClose:()=>void;onStatus:()=>void;initial?:Section}){
 const [tab,setTab]=useState<Section>(initial),z=useZarn(),push=usePushState(),{light}=useAdminTheme();
 return <div className="zn-modal-scrim" onClick={onClose}><div className="zn-prefs" role="dialog" aria-label="Preferences" onClick={e=>e.stopPropagation()}>
  <header className="zn-prefs-head"><h2>Preferences</h2><button type="button" aria-label="Close" onClick={onClose}><X size={20}/></button></header>
  <div className="zn-prefs-body">
   <nav className="zn-prefs-nav">{sections.map(s=><button key={s.id} type="button" className={tab===s.id?'is-on':''} onClick={()=>setTab(s.id)}>{s.icon}{s.label}</button>)}</nav>
   <section className="zn-prefs-pane" data-lenis-prevent>
    <h3>{sections.find(s=>s.id===tab)!.label}</h3>
    {tab==='availability'&&<>
     <div className="zn-prefs-block"><h4>Away</h4><p>When you’re away, you don’t show as online to the team. Messages still reach you.</p>
      <label className="zn-sound-row"><span><b>Set yourself as away</b><small>Stays on until you turn it off. Applies to this device.</small></span><input type="checkbox" checked={z.away} onChange={e=>z.setAway(e.target.checked)}/></label></div>
     <div className="zn-prefs-block"><h4>Status</h4><p>Let people know what you’re up to, like “In a meeting” or “On leave”.</p>
      <button type="button" className="zn-btn" onClick={onStatus}><Smile size={15}/>{z.me.status_text?`${z.me.status_emoji??''} ${z.me.status_text}`.trim():'Set a status'}</button></div>
    </>}
    {tab==='notifications'&&<>
     <div className="zn-prefs-block"><h4>Notifications on this device</h4><p>Get notified about DMs, mentions and client messages, even when ZARN is closed.</p>
      {push.state==='on'?<p className="zn-prefs-ok">Notifications are on.</p>:<button type="button" className="zn-btn is-primary" onClick={()=>z.enableNotify()}><Bell size={15}/>{push.state==='error'?'Fix notifications':'Turn on notifications'}</button>}
      {push.state==='error'&&<p className="zn-prefs-warn">{push.reason}</p>}</div>
     <div className="zn-prefs-block"><h4>Message sounds</h4><SoundSettings/></div>
    </>}
    {tab==='appearance'&&<div className="zn-prefs-block"><h4>Theme</h4><p>Applies to ZARN and the admin on this device.</p>
     <div className="zn-seg" role="radiogroup" aria-label="Theme">{([['dark','Dark'],['light','Light']] as const).map(([v,l])=><button key={v} type="button" role="radio" aria-checked={(v==='light')===light} className={`zn-seg-btn${(v==='light')===light?' is-on':''}`} onClick={()=>writeTheme(v==='light')}>{l}</button>)}</div></div>}
   </section>
  </div>
 </div></div>;
}
