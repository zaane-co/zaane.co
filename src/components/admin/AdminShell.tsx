'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Bell,BookOpen,Briefcase,ChevronDown,ChevronsLeft,ChevronsRight,ExternalLink,FileText,FolderDown,Inbox,LayoutDashboard,LogOut,Mail,Menu,Moon,PanelsTopLeft,Quote,Search,Settings,ShieldCheck,Sun,UserRound,Users,X,type LucideIcon} from 'lucide-react';

type User={name:string;email:string;role:string};
type Item={label:string;href:string;icon:LucideIcon;key?:string;children?:{label:string;href:string;key:string}[]};

const groups:{label:string;items:Item[]}[]=[
 {label:'Overview',items:[{label:'Dashboard',href:'/admin',icon:LayoutDashboard}]},
 {label:'Inbox',items:[
  {label:'Leads',href:'/admin/leads',key:'leads',icon:Inbox},
  {label:'Contacts',href:'/admin/contact_submissions',key:'contact_submissions',icon:Mail},
  {label:'Subscribers',href:'/admin/subscribers',key:'subscribers',icon:Users},
 ]},
 {label:'Content',items:[
  {label:'Projects',href:'/admin/projects',icon:Briefcase,children:[{label:'All projects',href:'/admin/projects',key:'projects'},{label:'Gallery',href:'/admin/project_images',key:'project_images'}]},
  {label:'Blog',href:'/admin/blog_posts',icon:BookOpen,children:[{label:'All posts',href:'/admin/blog_posts',key:'blog_posts'},{label:'Categories',href:'/admin/blog_categories',key:'blog_categories'}]},
  {label:'Testimonials',href:'/admin/testimonials',key:'testimonials',icon:Quote},
  {label:'Team',href:'/admin/team_members',key:'team_members',icon:UserRound},
  {label:'Resources',href:'/admin/resources',key:'resources',icon:FolderDown},
  {label:'Careers',href:'/admin/jobs',key:'jobs',icon:FileText},
  {label:'Page content',href:'/admin/pages_content',key:'pages_content',icon:PanelsTopLeft},
 ]},
 {label:'Admin',items:[
  {label:'Users & roles',href:'/admin/users',key:'users',icon:ShieldCheck},
  {label:'Settings',href:'/admin/settings',key:'settings',icon:Settings},
 ]},
];

const THEME_KEY='zaane_admin_theme';
const themeListeners=new Set<()=>void>();
const readTheme=()=>{try{return localStorage.getItem(THEME_KEY)==='light';}catch{return false;}};
const subscribeTheme=(fn:()=>void)=>{themeListeners.add(fn);return()=>{themeListeners.delete(fn);};};
const writeTheme=(light:boolean)=>{try{localStorage.setItem(THEME_KEY,light?'light':'dark');}catch{}themeListeners.forEach(fn=>fn());};

async function signOut(){try{await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});}finally{window.location.assign('/admin/login');}}

function useOutside<T extends HTMLElement>(open:boolean,close:()=>void){
 const ref=useRef<T>(null);
 useEffect(()=>{if(!open)return;const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))close();};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[open,close]);
 return ref;
}

export default function AdminShell({user,allowedKeys,newLeads,children}:{user:User;allowedKeys:string[];newLeads:number;children:React.ReactNode}){
 const pathname=usePathname();
 const light=useSyncExternalStore(subscribeTheme,readTheme,()=>false);
 const [collapsed,setCollapsed]=useState(false);
 const [mobileOpen,setMobileOpen]=useState(false);
 const [search,setSearch]=useState('');
 const [profileOpen,setProfileOpen]=useState(false);
 const [userOpen,setUserOpen]=useState(false);
 const profileRef=useOutside<HTMLDivElement>(profileOpen,()=>setProfileOpen(false));
 const userRef=useOutside<HTMLDivElement>(userOpen,()=>setUserOpen(false));
 const searchRef=useRef<HTMLInputElement>(null);

 useEffect(()=>{const h=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setCollapsed(false);setTimeout(()=>searchRef.current?.focus(),0);}};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);},[]);
 const toggleTheme=()=>writeTheme(!light);

 const can=(key?:string)=>!key||allowedKeys.includes(key);
 const visible=groups.map(g=>({...g,items:g.items.map(i=>({...i,children:i.children?.filter(c=>can(c.key))})).filter(i=>i.children?i.children.length>0:can(i.key))})).filter(g=>g.items.length);
 const isActive=(href:string)=>href==='/admin'?pathname==='/admin':pathname===href||pathname.startsWith(href+'/');
 const groupActive=(i:Item)=>i.children?i.children.some(c=>isActive(c.href)):isActive(i.href);
 const [expanded,setExpanded]=useState<string|null>(()=>visible.flatMap(g=>g.items).find(i=>i.children&&groupActive(i))?.label??null);

 const flat=visible.flatMap(g=>g.items.flatMap(i=>i.children?i.children.map(c=>({label:c.label==='All posts'?'Blog posts':c.label==='All projects'?'Projects':c.label==='Categories'?'Blog categories':c.label==='Gallery'?'Project gallery':c.label,href:c.href,icon:i.icon})):[{label:i.label,href:i.href,icon:i.icon}]));
 const results=search?flat.filter(i=>i.label.toLowerCase().includes(search.toLowerCase())):null;

 const first=(user.name||user.email).split(/[\s@]/)[0];
 const initial=(user.name||user.email).charAt(0).toUpperCase();
 const role=user.role.replace('_',' ');

 return <div className={`za-admin${light?' is-light':''}${collapsed?' is-collapsed':''}`}>
  {mobileOpen&&<button className="za-scrim" aria-label="Close menu" onClick={()=>setMobileOpen(false)}/>}
  <aside className={`za-sidebar${mobileOpen?' is-open':''}`} onClick={e=>{if((e.target as HTMLElement).closest('a'))setMobileOpen(false);}}>
   <div className="za-sidebar-top">
    <Link href="/admin" className="za-brand" title="Zaane admin">
     <img src="/zaane-mark.svg" alt="" className="za-brand-mark"/>
     <span className="za-brand-text">Zaane <small>Studio</small></span>
    </Link>
    <button className="za-icon-btn za-collapse" onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'}>{collapsed?<ChevronsRight size={16}/>:<ChevronsLeft size={16}/>}</button>
    <button className="za-icon-btn za-mobile-close" onClick={()=>setMobileOpen(false)} aria-label="Close menu"><X size={16}/></button>
   </div>
   <nav className="za-nav" aria-label="Admin navigation" data-lenis-prevent>
    <div className="za-search">
     <Search size={14}/>
     <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search menu…" aria-label="Search menu"/>
     <kbd>⌘K</kbd>
    </div>
    {results?(results.length?results.map(i=><NavLink key={i.href+i.label} href={i.href} label={i.label} Icon={i.icon} active={isActive(i.href)}/>):<p className="za-nav-empty">No results</p>):
    visible.map((g,gi)=><div key={g.label} className="za-nav-group">
     {gi>0&&<p className="za-nav-label">{g.label}</p>}
     {g.items.map(i=>i.children?<div key={i.label}>
      <button className={`za-nav-item${groupActive(i)?' is-active':''}`} title={i.label} onClick={()=>{if(collapsed){setCollapsed(false);setExpanded(i.label);}else setExpanded(e=>e===i.label?null:i.label);}}>
       <i.icon size={17} strokeWidth={1.8}/><span className="za-nav-text">{i.label}</span>
       <ChevronDown size={13} className={`za-nav-chev${expanded===i.label?' is-open':''}`}/>
       {i.key==='leads'&&newLeads>0&&<span className="za-count">{newLeads}</span>}
      </button>
      {expanded===i.label&&!collapsed&&<div className="za-subnav">{i.children.map(c=><Link key={c.href} href={c.href} className={`za-subnav-item${isActive(c.href)?' is-active':''}`}><span className="za-dot"/>{c.label}</Link>)}</div>}
     </div>:<NavLink key={i.href} href={i.href} label={i.label} Icon={i.icon} active={isActive(i.href)} badge={i.key==='leads'?newLeads:0}/>)}
    </div>)}
   </nav>
   <div className="za-sidebar-foot" ref={userRef}>
    <Link href="/" target="_blank" className="za-nav-item za-nav-muted" title="View website"><ExternalLink size={16} strokeWidth={1.8}/><span className="za-nav-text">View website</span></Link>
    <button className="za-user" onClick={()=>setUserOpen(v=>!v)}>
     <span className="za-avatar">{initial}</span>
     <span className="za-user-text"><strong>{user.name||'Zaane Studio'}</strong><small>{user.email}</small></span>
     <ChevronDown size={13} className={`za-nav-chev${userOpen?' is-open':''}`}/>
    </button>
    {userOpen&&<div className="za-menu za-menu-up"><MenuBody user={user} initial={initial} role={role} canSettings={can('settings')} close={()=>setUserOpen(false)}/></div>}
   </div>
  </aside>

  <div className="za-body">
   <header className="za-header">
    <div className="za-header-left">
     <button className="za-icon-btn za-menu-btn" onClick={()=>setMobileOpen(true)} aria-label="Open menu"><Menu size={18}/></button>
     <p>Welcome back, <span>{first}</span></p>
    </div>
    <div className="za-header-right">
     <button className="za-icon-btn" onClick={toggleTheme} aria-label={light?'Switch to dark mode':'Switch to light mode'} title={light?'Dark mode':'Light mode'}>{light?<Moon size={17}/>:<Sun size={17}/>}</button>
     {can('leads')&&<Link href="/admin/leads" className="za-icon-btn" aria-label={newLeads?`${newLeads} new leads`:'Leads'} title={newLeads?`${newLeads} new lead${newLeads>1?'s':''}`:'No new leads'}><Bell size={17}/>{newLeads>0&&<span className="za-ping"/>}</Link>}
     <span className="za-header-divider"/>
     <div className="za-profile" ref={profileRef}>
      <button className="za-profile-btn" onClick={()=>setProfileOpen(v=>!v)} aria-label="Account menu"><span className="za-avatar">{initial}</span><ChevronDown size={13} className={`za-nav-chev${profileOpen?' is-open':''}`}/></button>
      {profileOpen&&<div className="za-menu za-menu-down"><MenuBody user={user} initial={initial} role={role} canSettings={can('settings')} close={()=>setProfileOpen(false)}/></div>}
     </div>
    </div>
   </header>
   <main className="za-main" data-lenis-prevent>{children}</main>
  </div>
 </div>;
}

function NavLink({href,label,Icon,active,badge=0}:{href:string;label:string;Icon:LucideIcon;active:boolean;badge?:number}){
 return <Link href={href} title={label} className={`za-nav-item${active?' is-active':''}`}><Icon size={17} strokeWidth={1.8}/><span className="za-nav-text">{label}</span>{badge>0&&<span className="za-count">{badge}</span>}</Link>;
}

function MenuBody({user,initial,role,canSettings,close}:{user:User;initial:string;role:string;canSettings:boolean;close:()=>void}){
 return <>
  <div className="za-menu-head"><span className="za-avatar za-avatar-lg">{initial}</span><div><strong>{user.name||'Zaane Studio'}</strong><small>{user.email}</small><em>{role}</em></div></div>
  <Link href="/" target="_blank" onClick={close} className="za-menu-item"><ExternalLink size={16}/>View website</Link>
  {canSettings&&<Link href="/admin/settings" onClick={close} className="za-menu-item"><Settings size={16}/>Settings</Link>}
  <div className="za-menu-sep"/>
  <button onClick={()=>void signOut()} className="za-menu-item za-menu-danger"><LogOut size={16}/>Sign out</button>
 </>;
}
