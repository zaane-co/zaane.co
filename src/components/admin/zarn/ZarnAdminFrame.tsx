'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {ArrowLeft,Hash,Moon,Sun,Users} from 'lucide-react';
import {useAdminTheme,writeTheme} from '@/lib/admin-theme';
const tabs=[{href:'/zarn/admin',label:'Members',icon:Users},{href:'/zarn/admin/channels',label:'Channels',icon:Hash}];
export default function ZarnAdminFrame({children}:{children:React.ReactNode}){
 const {light}=useAdminTheme(),path=usePathname();
 return <div className={`za-admin zaf${light?' is-light':''}`}>
  <header className="zaf-top">
   {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ZARN app shell */}
   <a className="zaf-back" href="/zarn"><ArrowLeft size={16}/>Back to ZARN</a>
   <span className="zaf-brand"><img src="/zarn%20logo2.png" alt=""/>ZARN admin</span>
   <nav className="zaf-tabs">{tabs.map(t=><Link key={t.href} href={t.href} className={path===t.href?'is-on':''}><t.icon size={15}/>{t.label}</Link>)}</nav>
   <button type="button" className="za-icon-btn" aria-label={light?'Switch to dark mode':'Switch to light mode'} onClick={()=>writeTheme(!light)}>{light?<Moon size={16}/>:<Sun size={16}/>}</button>
  </header>
  <main className="zaf-main">{children}</main>
 </div>;
}
