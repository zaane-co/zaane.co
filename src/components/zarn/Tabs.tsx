'use client';
import Link from 'next/link';
import {AtSign,BarChart3,Bell,Volume2,VolumeX,Briefcase,ChevronRight,Contact,Download,LayoutDashboard,LogOut,MessageSquarePlus,Moon,Plus,Search,Settings2,Sun,UserPlus,UserRound,Users} from 'lucide-react';
import {useAdminTheme,writeTheme} from '@/lib/admin-theme';
import {useZarn} from './ZarnProvider';
import {Avatar} from './format';
import {ChannelRow,useNav,useShell} from './nav';
import {useInstall} from './ZarnPwa';
import {setSound,useSound} from '@/lib/zarn-sound';
import {signOut} from './ZarnShell';

// Phone tab screens (Slack-style). They also work on a computer as plain list pages.
function Screen({title,action,children}:{title:string;action?:React.ReactNode;children:React.ReactNode}){
 return <div className="zn-page zn-tabscreen"><header className="zn-tab-head"><h1>{title}</h1>{action}</header><div className="zn-tab-body" data-lenis-prevent>{children}</div></div>;
}
const Group=({label,children,add}:{label:string;children:React.ReactNode;add?:()=>void})=><section className="zn-group"><div className="zn-group-head"><h2>{label}</h2>{add&&<button type="button" aria-label={`Add to ${label}`} onClick={add}><Plus size={18}/></button>}</div>{children}</section>;
const Row=({href,icon,label,sub,onClick,badge}:{href?:string;icon:React.ReactNode;label:string;sub?:string;onClick?:()=>void;badge?:number})=>{
 const body=<>{icon}<span>{label}{sub&&<small>{sub}</small>}</span>{badge?<em className="zn-badge">{badge}</em>:<ChevronRight size={16} className="zn-chev"/>}</>;
 return href?<Link href={href} className="zn-nav-item is-big">{body}</Link>:<button type="button" className="zn-nav-item is-big" onClick={onClick}>{body}</button>;
};

export function HomeTab(){
 const {open}=useShell(),{starred,rooms,guest,canCreate,canBusiness}=useNav();
 return <Screen title="Home" action={<button type="button" className="zn-tab-action" aria-label="Search" onClick={()=>open('search')}><Search size={20}/></button>}>
  <button type="button" className="zn-search-bar" onClick={()=>open('search')}><Search size={16}/>Search messages</button>
  {canBusiness&&<Group label="Business">
   <Row href="/zarn/business" icon={<BarChart3 size={18}/>} label="Overview" sub="Pipeline, my clients, my tasks"/>
   <Row href="/zarn/crm" icon={<Briefcase size={18}/>} label="Pipeline"/>
   <Row href="/zarn/business/clients" icon={<Users size={18}/>} label="All clients"/>
  </Group>}
  {starred.length>0&&<Group label="Starred">{starred.map(c=><ChannelRow key={c.id} c={c} big/>)}</Group>}
  <Group label="Channels" add={canCreate?()=>open('channel'):undefined}>
   {rooms.map(c=><ChannelRow key={c.id} c={c} big/>)}
   {!guest&&<Row icon={<Plus size={18}/>} label="Browse channels" onClick={()=>open('browse')}/>}
  </Group>
 </Screen>;
}

export function DmsTab(){
 const {open}=useShell(),{dms,staffAdmin}=useNav();
 return <Screen title="DMs" action={<button type="button" className="zn-tab-action" aria-label="New message" onClick={()=>open('dm')}><MessageSquarePlus size={20}/></button>}>
  <Group label="People"><Row href="/zarn/people" icon={<Contact size={18}/>} label="Team directory" sub="Find anyone and message them"/></Group>
  <Group label="Direct messages" add={()=>open('dm')}>
   {dms.length?dms.map(c=><ChannelRow key={c.id} c={c} big/>):<p className="zn-nav-note">No conversations yet. Tap + to message someone.</p>}
   {staffAdmin&&<Row icon={<UserPlus size={18}/>} label="Invite people" onClick={()=>open('invite')}/>}
  </Group>
 </Screen>;
}

export function ClientsTab(){
 const {open}=useShell(),{clients,canAddClient,staffAdmin}=useNav();
 return <Screen title="Clients" action={canAddClient?<button type="button" className="zn-tab-action" aria-label="Add client" onClick={()=>open('client')}><Plus size={22}/></button>:undefined}>
  <Group label={staffAdmin?'All client spaces':'My clients'}>
   {clients.length?clients.map(c=><ChannelRow key={c.id} c={c} big/>):<p className="zn-nav-note">No client spaces yet. When you’re added to a client, it shows up here.</p>}
   {canAddClient&&<Row icon={<Plus size={18}/>} label="Add client" onClick={()=>open('client')}/>}
  </Group>
  <Group label="More"><Row href="/zarn/business/clients" icon={<Users size={18}/>} label="All clients" sub="Every client, stage and team"/></Group>
 </Screen>;
}

export function YouTab(){
 const z=useZarn(),{me}=z,{open}=useShell(),{staffAdmin,canBusiness}=useNav(),{light}=useAdminTheme(),{mode,install}=useInstall(),sound=useSound();
 return <Screen title="You">
  <button type="button" className="zn-you-card" onClick={()=>open('profile')}>
   <Avatar m={me} size={56} online/><span><b>{me.display_name}</b><small>{me.status_text||me.title||'Set a status'}</small></span><ChevronRight size={18} className="zn-chev"/>
  </button>
  <Group label="Preferences">
   <Row icon={<UserRound size={18}/>} label="Profile and status" onClick={()=>open('profile')}/>
   <Row icon={light?<Moon size={18}/>:<Sun size={18}/>} label={light?'Dark mode':'Light mode'} onClick={()=>writeTheme(!light)}/>
   <Row icon={sound?<Volume2 size={18}/>:<VolumeX size={18}/>} label={sound?'Message sounds: on':'Message sounds: off'} sub="DMs, mentions and client messages" onClick={()=>setSound(!sound)}/>
   {!z.notifyOn&&<Row icon={<Bell size={18}/>} label="Turn on notifications" onClick={()=>z.enableNotify()}/>}
   {mode&&<Row icon={<Download size={18}/>} label="Install ZARN on this device" onClick={()=>{if(mode==='prompt')void install();else open('install');}}/>}
  </Group>
  <Group label="Go to">
   <Row href="/zarn/activity" icon={<AtSign size={18}/>} label="Mentions"/>
   <Row href="/zarn/people" icon={<Contact size={18}/>} label="People"/>
   {canBusiness&&<Row href="/zarn/business" icon={<BarChart3 size={18}/>} label="Business"/>}
  </Group>
  {(staffAdmin||me.staffRole)&&<Group label="Admin">
   {staffAdmin&&<Row icon={<UserPlus size={18}/>} label="Invite people" onClick={()=>open('invite')}/>}
   {staffAdmin&&<Row href="/admin/zarn" icon={<Settings2 size={18}/>} label="ZARN admin"/>}
   {me.staffRole&&<Row href="/admin" icon={<LayoutDashboard size={18}/>} label="Studio admin"/>}
  </Group>}
  <Group label=" "><Row icon={<LogOut size={18}/>} label="Sign out" onClick={()=>void signOut()}/></Group>
 </Screen>;
}
