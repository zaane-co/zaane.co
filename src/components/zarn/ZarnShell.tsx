'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {AtSign,BarChart3,Bell,Download,Briefcase,ChevronDown,Contact,Hash,LayoutDashboard,Lock,LogOut,Menu,MessageSquare,MessageSquarePlus,Moon,Plus,Search,Settings2,Sun,UserPlus,UserRound,Users,X} from 'lucide-react';
import {useAdminTheme,writeTheme} from '@/lib/admin-theme';
import type {ZChannel} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {Avatar} from './format';
import {Browse,Invite,NewChannel,NewDm,Profile,SearchDialog} from './Dialogs';
import AddClient from './AddClient';
import {useInstall} from './ZarnPwa';

type Dialog='channel'|'dm'|'browse'|'search'|'profile'|'invite'|'client'|null;
type Area='chat'|'business'|'clients';
const areaOf=(p:string):Area=>p.startsWith('/zarn/clients')?'clients':p.startsWith('/zarn/business')||p.startsWith('/zarn/crm')?'business':'chat';

// ZARN layout: a narrow rail switches between three areas (Chat, Business, Clients); the sidebar shows that area's navigation.
export default function ZarnShell({children}:{children:React.ReactNode}){
 const z=useZarn(),{me,channels,membership,unread,online,people,title}=z,pathname=usePathname(),{light}=useAdminTheme();
 const [menu,setMenu]=useState(false),[dialog,setDialog]=useState<Dialog>(null),[open,setOpen]=useState(false),[collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 const [clientQ,setClientQ]=useState(''),[iosHelp,setIosHelp]=useState(false);
 const {mode:installMode,install}=useInstall();
 const routeArea=areaOf(pathname);
 const [area,setArea]=useState<Area>(routeArea);
 // Close the mobile drawer and follow the route's area whenever the route changes.
 const [seenPath,setSeenPath]=useState(pathname);
 if(seenPath!==pathname){setSeenPath(pathname);setOpen(false);setArea(routeArea);}
 const staffAdmin=me.staffRole==='super_admin'||me.staffRole==='admin';
 const guest=me.account_type==='guest',canCreate=!guest&&me.can_create_channels,canBusiness=!guest&&(me.can_view_crm||staffAdmin);
 const canAddClient=!guest&&(me.can_view_crm||staffAdmin||me.staffRole==='sales');
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setDialog('search');}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[]);

 const live=channels.filter(c=>!c.archived_at);
 const mine=live.filter(c=>membership[c.id]);
 const starred=mine.filter(c=>c.kind!=='client'&&membership[c.id]?.starred);
 const rooms=mine.filter(c=>(c.kind==='public'||c.kind==='private')&&!membership[c.id]?.starred).sort((a,b)=>(a.name??'').localeCompare(b.name??''));
 const dms=mine.filter(c=>c.kind==='dm'&&!membership[c.id]?.starred);
 // Admins see every client space; everyone else sees the ones they're on.
 const clients=live.filter(c=>c.kind==='client'&&(membership[c.id]||staffAdmin)).sort((a,b)=>title(a).localeCompare(title(b)));
 const shownClients=clients.filter(c=>title(c).toLowerCase().includes(clientQ.toLowerCase()));
 const sum=(list:ZChannel[],k:'unread'|'mentions')=>list.reduce((t,c)=>t+(membership[c.id]?.muted&&k==='unread'?0:unread[c.id]?.[k]??0),0);
 const chatBadge=sum(mine.filter(c=>c.kind!=='client'),'mentions')+sum(dms,'unread'),clientBadge=sum(clients.filter(c=>membership[c.id]),'unread');
 const mentions=Object.values(unread).reduce((t,u)=>t+u.mentions,0);

 const row=(c:ZChannel)=>{
  const u=unread[c.id],muted=membership[c.id]?.muted,href=c.kind==='client'?`/zarn/clients/${c.lead_id}`:`/zarn/c/${c.id}`,isActive=pathname===href;
  const other=c.kind==='dm'?(c.dm_key??'').split(',').find(id=>id!==me.user_id):undefined;
  const lead=c.kind==='client'&&c.lead_id?z.lead(c.lead_id):undefined;
  return <Link key={c.id} href={href} className={`zn-nav-item${isActive?' is-active':''}${u?.unread&&!muted?' is-unread':''}${muted?' is-muted':''}`}>
   {c.kind==='dm'?<Avatar m={people[other??me.user_id]} size={20} online={online.has(other??me.user_id)}/>:c.kind==='client'?<i className="zn-client-dot" style={{background:lead?.stage_color??'#52525b'}}/>:c.kind==='private'?<Lock size={15}/>:<Hash size={15}/>}
   <span>{title(c)}</span>{u?.mentions?<em className="zn-badge">{u.mentions}</em>:(c.kind==='dm'||c.kind==='client')&&u?.unread?<em className="zn-badge">{u.unread}</em>:!membership[c.id]&&c.kind==='client'?<em className="zn-admin-eye" title="You can see this as an admin">admin</em>:null}
  </Link>;
 };
 const section=(id:string,label:string,children:React.ReactNode,add?:()=>void)=><div className="zn-section">
  <div className="zn-section-head"><button type="button" className="zn-section-toggle" onClick={()=>setCollapsed(c=>({...c,[id]:!c[id]}))}><ChevronDown size={14} className={collapsed[id]?'is-closed':''}/>{label}</button>{add&&<button type="button" className="zn-section-add" aria-label={`Add ${label.toLowerCase()}`} data-tip={`Add ${label.toLowerCase()}`} onClick={add}><Plus size={15}/></button>}</div>
  {!collapsed[id]&&children}
 </div>;
 const link=(href:string,icon:React.ReactNode,label:string,badge?:number,exact=true)=><Link href={href} className={`zn-nav-item${(exact?pathname===href:pathname.startsWith(href))?' is-active':''}${badge?' is-unread':''}`}>{icon}<span>{label}</span>{badge?<em className="zn-badge">{badge}</em>:null}</Link>;
 const railBtn=(a:Area,icon:React.ReactNode,label:string,badge:number)=><button type="button" className={`zn-rail-btn${area===a?' is-on':''}`} aria-pressed={area===a} onClick={()=>setArea(a)}><span className="zn-rail-icon">{icon}{badge>0&&<em>{badge>99?'99+':badge}</em>}</span><small>{label}</small></button>;

 return <div className={`zarn${light?' is-light':''}`}>
  {open&&<button type="button" className="zn-scrim zn-mobile-scrim" aria-label="Close menu" onClick={()=>setOpen(false)}/>}
  <div className={`zn-nav-wrap${open?' is-open':''}`}>
   <nav className="zn-rail" aria-label="Areas">
    <button type="button" className="zn-rail-logo" aria-label="Workspace menu" onClick={()=>setMenu(v=>!v)}><img src="/zarnlogo.png" alt="ZARN"/></button>
    {railBtn('chat',<MessageSquare size={20}/>,'Chat',chatBadge)}
    {canBusiness&&railBtn('business',<BarChart3 size={20}/>,'Business',0)}
    {!guest&&railBtn('clients',<Briefcase size={20}/>,'Clients',clientBadge)}
    <button type="button" className="zn-rail-me" aria-label="Your profile" onClick={()=>setDialog('profile')}><Avatar m={me} size={34} online/></button>
   </nav>
   <aside className="zn-sidebar">
    <div className="zn-workspace">
     <button type="button" className="zn-ws-btn" onClick={()=>setMenu(v=>!v)} aria-expanded={menu}><b>{area==='chat'?'ZARN':area==='business'?'Business':'Clients'}</b>{guest&&<span className="zn-guest-tag">Guest</span>}<ChevronDown size={14}/></button>
     {area==='chat'&&<button type="button" className="zn-icon" aria-label="New message" data-tip="New message" onClick={()=>setDialog('dm')}><MessageSquarePlus size={17}/></button>}
     {area==='clients'&&canAddClient&&<button type="button" className="zn-icon" aria-label="Add client" data-tip="Add client" onClick={()=>setDialog('client')}><Plus size={18}/></button>}
     <button type="button" className="zn-icon zn-only-mobile" aria-label="Close menu" onClick={()=>setOpen(false)}><X size={17}/></button>
     {menu&&<><button type="button" className="zn-scrim" aria-label="Close" onClick={()=>setMenu(false)}/><div className="zn-menu">
      <div className="zn-menu-me"><Avatar m={me} size={36} online/><span><b>{me.display_name}</b><small>{me.status_text||me.title||me.email}</small></span></div>
      <button type="button" onClick={()=>{setMenu(false);setDialog('profile');}}><UserRound size={15}/>Profile and status</button>
      <button type="button" onClick={()=>writeTheme(!light)}>{light?<Moon size={15}/>:<Sun size={15}/>}{light?'Dark mode':'Light mode'}</button>
      {!z.notifyOn&&<button type="button" onClick={()=>{z.enableNotify();setMenu(false);}}><Bell size={15}/>Turn on desktop notifications</button>}
      {installMode&&<button type="button" onClick={()=>{setMenu(false);if(installMode==='prompt')void install();else setIosHelp(true);}}><Download size={15}/>Install ZARN on this device</button>}
      {staffAdmin&&<><div className="zn-menu-sep"/><p className="zn-menu-label">Admin</p>
       <button type="button" onClick={()=>{setMenu(false);setDialog('invite');}}><UserPlus size={15}/>Invite people</button>
       <Link href="/admin/zarn"><Settings2 size={15}/>ZARN admin</Link></>}
      {me.staffRole&&<Link href="/admin"><LayoutDashboard size={15}/>Studio admin</Link>}
      <div className="zn-menu-sep"/>
      <button type="button" className="is-danger" onClick={async()=>{await fetch('/api/zarn/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});window.location.assign('/zarn/login');}}><LogOut size={15}/>Sign out</button>
     </div></>}
    </div>
    <div className="zn-nav" data-lenis-prevent>
     {area==='chat'&&<>
      <button type="button" className="zn-nav-item zn-search-btn" onClick={()=>setDialog('search')}><Search size={15}/><span>Search</span><kbd>⌘K</kbd></button>
      {link('/zarn/activity',<AtSign size={15}/>,'Mentions',mentions)}
      {link('/zarn/people',<Contact size={15}/>,'People')}
      {starred.length>0&&section('starred','Starred',starred.map(row))}
      {section('channels','Channels',<>{rooms.map(row)}{!guest&&<button type="button" className="zn-nav-item is-muted" onClick={()=>setDialog('browse')}><Plus size={15}/><span>Browse channels</span></button>}</>,canCreate?()=>setDialog('channel'):undefined)}
      {section('dms','Direct messages',<>{dms.map(row)}{staffAdmin&&<button type="button" className="zn-nav-item is-muted" onClick={()=>setDialog('invite')}><UserPlus size={15}/><span>Invite people</span></button>}</>,()=>setDialog('dm'))}
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
      {section('myclients',staffAdmin?'All client spaces':'My clients',shownClients.length?shownClients.map(row):<p className="zn-nav-note">{clients.length?'No match.':'No client spaces yet. When you’re added to a client, it shows up here.'}</p>)}
     </>}
    </div>
   </aside>
  </div>
  <main className="zn-main">
   <button type="button" className="zn-icon zn-menu-toggle" aria-label="Open menu" onClick={()=>setOpen(true)}><Menu size={18}/>{(chatBadge+clientBadge)>0&&<i className="zn-ping"/>}</button>
   {children}
  </main>
  {dialog==='channel'&&<NewChannel onClose={()=>setDialog(null)}/>}
  {dialog==='dm'&&<NewDm onClose={()=>setDialog(null)}/>}
  {dialog==='browse'&&<Browse onClose={()=>setDialog(null)}/>}
  {dialog==='search'&&<SearchDialog onClose={()=>setDialog(null)}/>}
  {dialog==='profile'&&<Profile onClose={()=>setDialog(null)}/>}
  {dialog==='invite'&&<Invite onClose={()=>setDialog(null)}/>}
  {dialog==='client'&&<AddClient onClose={()=>setDialog(null)}/>}
  {iosHelp&&<div className="zn-modal-scrim" onClick={()=>setIosHelp(false)}><div className="zn-modal" role="dialog" aria-label="Install ZARN" onClick={e=>e.stopPropagation()}>
   <div className="zn-modal-head"><h2>Install ZARN on iPhone</h2><button type="button" aria-label="Close" onClick={()=>setIosHelp(false)}><X size={18}/></button></div>
   <ol className="zn-steps"><li>Open zaane.co/zarn in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (the square with an arrow).</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>
   <p className="zn-note">ZARN then opens full-screen from your home screen like any other app.</p>
  </div></div>}
 </div>;
}
