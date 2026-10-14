'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {AtSign,BarChart3,Bell,Volume2,VolumeX,Briefcase,ChevronDown,ChevronLeft,Contact,Download,Home,LayoutDashboard,LogOut,MessageSquare,MessageSquarePlus,Moon,Plus,Search,Settings2,Sun,UserPlus,UserRound,Users,X} from 'lucide-react';
import {useAdminTheme,writeTheme} from '@/lib/admin-theme';
import {useZarn} from './ZarnProvider';
import {Avatar} from './format';
import {Browse,Invite,NewChannel,NewDm,Profile,SearchDialog} from './Dialogs';
import AddClient from './AddClient';
import {useInstall} from './ZarnPwa';
import ProfileSheet from './ProfileSheet';
import {setSound,useSound} from '@/lib/zarn-sound';
import {ChannelRow,ShellCtx,useNav,type Dialog} from './nav';

type Area='chat'|'business'|'clients';
const areaOf=(p:string):Area=>p.startsWith('/zarn/clients')?'clients':p.startsWith('/zarn/business')||p.startsWith('/zarn/crm')?'business':'chat';
// Phone tab roots (tab bar visible). Inside a conversation the tab bar hides and a back arrow shows instead.
const tabs=['/zarn/home','/zarn/dms','/zarn/clients','/zarn/activity','/zarn/you'];

// ZARN layout. Computers: a rail switches between Chat, Business and Clients, with that area's sidebar.
// Phones: Slack-style bottom tabs (Home, DMs, Clients, Activity, You), full-screen lists, back arrows in conversations.
export default function ZarnShell({children}:{children:React.ReactNode}){
 const z=useZarn(),{me,channels}=z,pathname=usePathname(),{light}=useAdminTheme();
 const nav=useNav(),{staffAdmin,guest,canCreate,canBusiness,canAddClient,starred,rooms,dms,clients,badges}=nav;
 const [menu,setMenu]=useState(false),[dialog,setDialog]=useState<Dialog>(null),[collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 const [clientQ,setClientQ]=useState(''),[profileId,setProfileId]=useState<string|null>(null);
 const {mode:installMode,install}=useInstall(),sound=useSound();
 const routeArea=areaOf(pathname);
 const [area,setArea]=useState<Area>(routeArea);
 // Follow the route's area whenever the route changes.
 const [seenPath,setSeenPath]=useState(pathname);
 if(seenPath!==pathname){setSeenPath(pathname);setArea(routeArea);setMenu(false);}
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setDialog('search');}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[]);

 const shownClients=clients.filter(c=>z.title(c).toLowerCase().includes(clientQ.toLowerCase()));
 const isTab=tabs.includes(pathname)||pathname==='/zarn';
 // Where the phone back arrow goes from the current screen.
 const back=(()=>{
  const m=pathname.match(/^\/zarn\/c\/([0-9a-f-]{36})/);
  if(m){const c=channels.find(x=>x.id===m[1]);return c?.kind==='dm'?'/zarn/dms':'/zarn/home';}
  if(pathname.startsWith('/zarn/clients/'))return '/zarn/clients';
  if(pathname.startsWith('/zarn/people'))return '/zarn/dms';
  return '/zarn/home';
 })();

 const section=(id:string,label:string,children:React.ReactNode,add?:()=>void)=><div className="zn-section">
  <div className="zn-section-head"><button type="button" className="zn-section-toggle" onClick={()=>setCollapsed(c=>({...c,[id]:!c[id]}))}><ChevronDown size={14} className={collapsed[id]?'is-closed':''}/>{label}</button>{add&&<button type="button" className="zn-section-add" aria-label={`Add ${label.toLowerCase()}`} data-tip={`Add ${label.toLowerCase()}`} onClick={add}><Plus size={15}/></button>}</div>
  {!collapsed[id]&&children}
 </div>;
 const link=(href:string,icon:React.ReactNode,label:string,badge?:number,exact=true)=><Link href={href} className={`zn-nav-item${(exact?pathname===href:pathname.startsWith(href))?' is-active':''}${badge?' is-unread':''}`}>{icon}<span>{label}</span>{badge?<em className="zn-badge">{badge}</em>:null}</Link>;
 const railBtn=(a:Area,icon:React.ReactNode,label:string,badge:number)=><button type="button" className={`zn-rail-btn${area===a?' is-on':''}`} aria-pressed={area===a} onClick={()=>setArea(a)}><span className="zn-rail-icon">{icon}{badge>0&&<em>{badge>99?'99+':badge}</em>}</span><small>{label}</small></button>;
 const tab=(href:string,icon:React.ReactNode,label:string,badge:number)=>{const on=pathname===href||(href==='/zarn/home'&&pathname==='/zarn');return <Link href={href} className={`zn-tab${on?' is-on':''}`} aria-current={on?'page':undefined}><span className="zn-tab-icon">{icon}{badge>0&&<em>{badge>99?'99+':badge}</em>}</span><small>{label}</small></Link>;};

 return <ShellCtx.Provider value={{open:setDialog,profile:setProfileId}}>
 <div className={`zarn${light?' is-light':''}${isTab?' is-tab':' is-deep'}`}>
  <div className="zn-nav-wrap">
   <nav className="zn-rail" aria-label="Areas">
    <button type="button" className="zn-rail-logo" aria-label="Workspace menu" onClick={()=>setMenu(v=>!v)}><img src="/zarnlogo.png" alt="ZARN"/></button>
    {railBtn('chat',<MessageSquare size={20}/>,'Chat',badges.home+badges.dms)}
    {canBusiness&&railBtn('business',<BarChart3 size={20}/>,'Business',0)}
    {!guest&&railBtn('clients',<Briefcase size={20}/>,'Clients',badges.clients)}
    <button type="button" className="zn-rail-me" aria-label="Your profile" onClick={()=>setProfileId(me.user_id)}><Avatar m={me} size={34} online/></button>
   </nav>
   <aside className="zn-sidebar">
    <div className="zn-workspace">
     <button type="button" className="zn-ws-btn" onClick={()=>setMenu(v=>!v)} aria-expanded={menu}><b>{area==='chat'?'ZARN':area==='business'?'Business':'Clients'}</b>{guest&&<span className="zn-guest-tag">Guest</span>}<ChevronDown size={14}/></button>
     {area==='chat'&&<button type="button" className="zn-icon" aria-label="New message" data-tip="New message" onClick={()=>setDialog('dm')}><MessageSquarePlus size={17}/></button>}
     {area==='clients'&&canAddClient&&<button type="button" className="zn-icon" aria-label="Add client" data-tip="Add client" onClick={()=>setDialog('client')}><Plus size={18}/></button>}
     {menu&&<><button type="button" className="zn-scrim" aria-label="Close" onClick={()=>setMenu(false)}/><div className="zn-menu">
      <div className="zn-menu-me"><Avatar m={me} size={36} online/><span><b>{me.display_name}</b><small>{me.status_text||me.title||me.email}</small></span></div>
      <button type="button" onClick={()=>{setMenu(false);setDialog('profile');}}><UserRound size={15}/>Profile and status</button>
      <button type="button" onClick={()=>writeTheme(!light)}>{light?<Moon size={15}/>:<Sun size={15}/>}{light?'Dark mode':'Light mode'}</button>
      <button type="button" onClick={()=>setSound(!sound)}>{sound?<Volume2 size={15}/>:<VolumeX size={15}/>}{sound?'Message sounds: on':'Message sounds: off'}</button>
      {!z.notifyOn&&<button type="button" onClick={()=>{z.enableNotify();setMenu(false);}}><Bell size={15}/>Turn on desktop notifications</button>}
      {installMode&&<button type="button" onClick={()=>{setMenu(false);if(installMode==='prompt')void install();else setDialog('install');}}><Download size={15}/>Install ZARN on this device</button>}
      {staffAdmin&&<><div className="zn-menu-sep"/><p className="zn-menu-label">Admin</p>
       <button type="button" onClick={()=>{setMenu(false);setDialog('invite');}}><UserPlus size={15}/>Invite people</button>
       <Link href="/admin/zarn"><Settings2 size={15}/>ZARN admin</Link></>}
      {me.staffRole&&<Link href="/admin"><LayoutDashboard size={15}/>Studio admin</Link>}
      <div className="zn-menu-sep"/>
      <button type="button" className="is-danger" onClick={()=>void signOut()}><LogOut size={15}/>Sign out</button>
     </div></>}
    </div>
    <div className="zn-nav" data-lenis-prevent>
     {area==='chat'&&<>
      <button type="button" className="zn-nav-item zn-search-btn" onClick={()=>setDialog('search')}><Search size={15}/><span>Search</span><kbd>⌘K</kbd></button>
      {link('/zarn/activity',<AtSign size={15}/>,'Mentions',badges.activity)}
      {link('/zarn/people',<Contact size={15}/>,'People')}
      {starred.length>0&&section('starred','Starred',starred.map(c=><ChannelRow key={c.id} c={c}/>))}
      {section('channels','Channels',<>{rooms.map(c=><ChannelRow key={c.id} c={c}/>)}{!guest&&<button type="button" className="zn-nav-item is-muted" onClick={()=>setDialog('browse')}><Plus size={15}/><span>Browse channels</span></button>}</>,canCreate?()=>setDialog('channel'):undefined)}
      {section('dms','Direct messages',<>{dms.map(c=><ChannelRow key={c.id} c={c}/>)}{staffAdmin&&<button type="button" className="zn-nav-item is-muted" onClick={()=>setDialog('invite')}><UserPlus size={15}/><span>Invite people</span></button>}</>,()=>setDialog('dm'))}
     </>}
     {area==='business'&&<>
      {link('/zarn/business',<BarChart3 size={15}/>,'Overview')}
      {link('/zarn/crm',<Briefcase size={15}/>,'Pipeline',0,false)}
      {link('/zarn/business/clients',<Users size={15}/>,'All clients')}
      {staffAdmin||me.staffRole==='finance'||me.staffRole==='sales'?<a className="zn-nav-item" href="/admin/invoices" target="_blank" rel="noopener noreferrer"><LayoutDashboard size={15}/><span>Invoices (admin)</span></a>:null}
      <p className="zn-nav-note">Client conversations live under Clients. Deals, values and stages live here.</p>
     </>}
     {area==='clients'&&<>
      {clients.length>6&&<label className="zn-client-search"><Search size={14}/><input placeholder="Find a client" value={clientQ} onChange={e=>setClientQ(e.target.value)}/></label>}
      {canAddClient&&<button type="button" className="zn-nav-item zn-add-client" onClick={()=>setDialog('client')}><Plus size={15}/><span>Add client</span></button>}
      {section('myclients',staffAdmin?'All client spaces':'My clients',shownClients.length?shownClients.map(c=><ChannelRow key={c.id} c={c}/>):<p className="zn-nav-note">{clients.length?'No match.':'No client spaces yet. When you’re added to a client, it shows up here.'}</p>)}
     </>}
    </div>
   </aside>
  </div>
  <main className="zn-main">
   {!isTab&&<Link href={back} className="zn-icon zn-back" aria-label="Back"><ChevronLeft size={22}/>{(badges.home+badges.dms+badges.clients)>0&&<i className="zn-ping"/>}</Link>}
   {children}
  </main>
  <nav className="zn-tabbar" aria-label="ZARN">
   {tab('/zarn/home',<Home size={22}/>,'Home',badges.home)}
   {tab('/zarn/dms',<MessageSquare size={22}/>,'DMs',badges.dms)}
   {!guest&&tab('/zarn/clients',<Briefcase size={22}/>,'Clients',badges.clients)}
   {tab('/zarn/activity',<AtSign size={22}/>,'Activity',badges.activity)}
   {tab('/zarn/you',<Avatar m={me} size={24}/>,'You',0)}
  </nav>
  {profileId&&<ProfileSheet userId={profileId} onClose={()=>setProfileId(null)} onEdit={()=>{setProfileId(null);setDialog('profile');}}/>}
  {dialog==='channel'&&<NewChannel onClose={()=>setDialog(null)}/>}
  {dialog==='dm'&&<NewDm onClose={()=>setDialog(null)}/>}
  {dialog==='browse'&&<Browse onClose={()=>setDialog(null)}/>}
  {dialog==='search'&&<SearchDialog onClose={()=>setDialog(null)}/>}
  {dialog==='profile'&&<Profile onClose={()=>setDialog(null)}/>}
  {dialog==='invite'&&<Invite onClose={()=>setDialog(null)}/>}
  {dialog==='client'&&<AddClient onClose={()=>setDialog(null)}/>}
  {dialog==='install'&&<div className="zn-modal-scrim" onClick={()=>setDialog(null)}><div className="zn-modal" role="dialog" aria-label="Install ZARN" onClick={e=>e.stopPropagation()}>
   <div className="zn-modal-head"><h2>Install ZARN on iPhone</h2><button type="button" aria-label="Close" onClick={()=>setDialog(null)}><X size={18}/></button></div>
   <ol className="zn-steps"><li>Open zaane.co/zarn in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (the square with an arrow).</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>
   <p className="zn-note">ZARN then opens full-screen from your home screen like any other app.</p>
  </div></div>}
 </div>
 </ShellCtx.Provider>;
}

export async function signOut(){await fetch('/api/zarn/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});window.location.assign('/zarn/login');}
