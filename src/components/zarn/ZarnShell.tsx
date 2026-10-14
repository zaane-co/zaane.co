'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {AtSign,Bell,Briefcase,ChevronDown,Hash,LayoutDashboard,Lock,LogOut,Menu,MessageSquarePlus,Moon,Plus,Search,Settings2,Star,Sun,UserPlus,UserRound,X} from 'lucide-react';
import {useAdminTheme,writeTheme} from '@/lib/admin-theme';
import type {ZChannel} from '@/lib/zarn';
import {useZarn} from './ZarnProvider';
import {Avatar} from './format';
import {Browse,Invite,NewChannel,NewDm,Profile,SearchDialog} from './Dialogs';

type Dialog='channel'|'dm'|'browse'|'search'|'profile'|'invite'|null;
export default function ZarnShell({children}:{children:React.ReactNode}){
 const z=useZarn(),{me,channels,membership,unread,online,people,title}=z,pathname=usePathname(),{light}=useAdminTheme();
 const [menu,setMenu]=useState(false),[dialog,setDialog]=useState<Dialog>(null),[open,setOpen]=useState(false),[collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 const staffAdmin=me.staffRole==='super_admin'||me.staffRole==='admin';
 const guest=me.account_type==='guest',canCreate=!guest&&me.can_create_channels;
 // Close the mobile drawer whenever the route changes.
 const [seenPath,setSeenPath]=useState(pathname);
 if(seenPath!==pathname){setSeenPath(pathname);setOpen(false);}
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setDialog('search');}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[]);
 const mine=channels.filter(c=>membership[c.id]&&!c.archived_at);
 const starred=mine.filter(c=>membership[c.id]?.starred);
 const rooms=mine.filter(c=>c.kind!=='dm'&&!membership[c.id]?.starred).sort((a,b)=>(a.name??'').localeCompare(b.name??''));
 const dms=mine.filter(c=>c.kind==='dm'&&!membership[c.id]?.starred);
 const mentions=Object.values(unread).reduce((t,u)=>t+u.mentions,0);
 const row=(c:ZChannel)=>{
  const u=unread[c.id],muted=membership[c.id]?.muted,isActive=pathname===`/zarn/c/${c.id}`;
  const other=c.kind==='dm'?(c.dm_key??'').split(',').find(id=>id!==me.user_id):undefined;
  return <Link key={c.id} href={`/zarn/c/${c.id}`} className={`zn-nav-item${isActive?' is-active':''}${u?.unread&&!muted?' is-unread':''}${muted?' is-muted':''}`}>
   {c.kind==='dm'?<Avatar m={people[other??me.user_id]} size={20} online={online.has(other??me.user_id)}/>:c.kind==='private'?<Lock size={15}/>:<Hash size={15}/>}
   <span>{title(c)}</span>{u?.mentions?<em className="zn-badge">{u.mentions}</em>:c.kind==='dm'&&u?.unread?<em className="zn-badge">{u.unread}</em>:null}
  </Link>;
 };
 const section=(id:string,label:string,children:React.ReactNode,add?:()=>void)=><div className="zn-section">
  <div className="zn-section-head"><button type="button" onClick={()=>setCollapsed(c=>({...c,[id]:!c[id]}))}><ChevronDown size={14} className={collapsed[id]?'is-closed':''}/>{label}</button>{add&&<button type="button" aria-label={`Add ${label.toLowerCase()}`} data-tip={`Add ${label.toLowerCase()}`} onClick={add}><Plus size={15}/></button>}</div>
  {!collapsed[id]&&children}
 </div>;

 return <div className={`zarn${light?' is-light':''}`}>
  {open&&<button type="button" className="zn-scrim zn-mobile-scrim" aria-label="Close menu" onClick={()=>setOpen(false)}/>}
  <aside className={`zn-sidebar${open?' is-open':''}`}>
   <div className="zn-workspace">
    <button type="button" className="zn-ws-btn" onClick={()=>setMenu(v=>!v)} aria-expanded={menu}><span className="zn-logo">Z</span><b>ZARN</b>{guest&&<span className="zn-guest-tag">Guest</span>}<ChevronDown size={14}/></button>
    <button type="button" className="zn-icon" aria-label="New message" data-tip="New message" onClick={()=>setDialog('dm')}><MessageSquarePlus size={17}/></button>
    <button type="button" className="zn-icon zn-only-mobile" aria-label="Close menu" onClick={()=>setOpen(false)}><X size={17}/></button>
    {menu&&<><button type="button" className="zn-scrim" aria-label="Close" onClick={()=>setMenu(false)}/><div className="zn-menu">
     <div className="zn-menu-me"><Avatar m={me} size={36} online/><span><b>{me.display_name}</b><small>{me.status_text||me.title||me.email}</small></span></div>
     <button type="button" onClick={()=>{setMenu(false);setDialog('profile');}}><UserRound size={15}/>Profile and status</button>
     <button type="button" onClick={()=>writeTheme(!light)}>{light?<Moon size={15}/>:<Sun size={15}/>}{light?'Dark mode':'Light mode'}</button>
     {!z.notifyOn&&<button type="button" onClick={()=>{z.enableNotify();setMenu(false);}}><Bell size={15}/>Turn on desktop notifications</button>}
     {staffAdmin&&<><div className="zn-menu-sep"/><p className="zn-menu-label">Switch to</p>
      <button type="button" onClick={()=>{setMenu(false);setDialog('invite');}}><UserPlus size={15}/>Invite people</button>
      <Link href="/admin/zarn"><Settings2 size={15}/>ZARN admin</Link>
      <Link href="/admin"><LayoutDashboard size={15}/>Studio admin</Link></>}
     {!staffAdmin&&me.staffRole&&<><div className="zn-menu-sep"/><Link href="/admin"><LayoutDashboard size={15}/>Studio admin</Link></>}
     <div className="zn-menu-sep"/>
     <button type="button" className="is-danger" onClick={async()=>{await fetch('/api/zarn/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});window.location.assign('/zarn/login');}}><LogOut size={15}/>Sign out</button>
    </div></>}
   </div>
   <nav className="zn-nav" data-lenis-prevent>
    <button type="button" className="zn-nav-item zn-search-btn" onClick={()=>setDialog('search')}><Search size={15}/><span>Search</span><kbd>⌘K</kbd></button>
    <Link href="/zarn/activity" className={`zn-nav-item${pathname==='/zarn/activity'?' is-active':''}${mentions?' is-unread':''}`}><AtSign size={15}/><span>Mentions</span>{mentions>0&&<em className="zn-badge">{mentions}</em>}</Link>
    {me.can_view_crm&&<Link href="/zarn/crm" className={`zn-nav-item${pathname.startsWith('/zarn/crm')?' is-active':''}`}><Briefcase size={15}/><span>CRM</span></Link>}
    {staffAdmin&&<Link href="/admin/zarn" className="zn-nav-item"><Settings2 size={15}/><span>ZARN admin</span></Link>}
    {starred.length>0&&section('starred','Starred',starred.map(row))}
    {section('channels','Channels',<>{rooms.map(row)}{!guest&&<button type="button" className="zn-nav-item is-muted" onClick={()=>setDialog('browse')}><Plus size={15}/><span>Browse channels</span></button>}</>,canCreate?()=>setDialog('channel'):undefined)}
    {section('dms','Direct messages',<>{dms.map(row)}{staffAdmin&&<button type="button" className="zn-nav-item is-muted" onClick={()=>setDialog('invite')}><UserPlus size={15}/><span>Invite people</span></button>}</>,()=>setDialog('dm'))}
   </nav>
   <button type="button" className="zn-me" onClick={()=>setDialog('profile')}><Avatar m={me} size={30} online/><span><b>{me.display_name}</b><small>{me.status_text||'Active'}</small></span></button>
  </aside>
  <main className="zn-main">
   <button type="button" className="zn-icon zn-menu-toggle" aria-label="Open menu" onClick={()=>setOpen(true)}><Menu size={18}/>{Object.values(unread).some(u=>u.mentions)&&<i className="zn-ping"/>}</button>
   {children}
  </main>
  {dialog==='channel'&&<NewChannel onClose={()=>setDialog(null)}/>}
  {dialog==='dm'&&<NewDm onClose={()=>setDialog(null)}/>}
  {dialog==='browse'&&<Browse onClose={()=>setDialog(null)}/>}
  {dialog==='search'&&<SearchDialog onClose={()=>setDialog(null)}/>}
  {dialog==='profile'&&<Profile onClose={()=>setDialog(null)}/>}
  {dialog==='invite'&&<Invite onClose={()=>setDialog(null)}/>}
 </div>;
}
