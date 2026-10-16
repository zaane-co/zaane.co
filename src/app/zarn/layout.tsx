import type {Metadata,Viewport} from 'next';
import ZarnPwa from '@/components/zarn/ZarnPwa';
import './zarn.css';
// Installable app (PWA): manifest scoped to /zarn, home-screen icons, full-screen on iPhone.
export const metadata:Metadata={title:'ZARN',robots:{index:false,follow:false},manifest:'/zarn.webmanifest',
 icons:{icon:[{url:'/zarn-icons/icon-192.png',sizes:'192x192'},{url:'/zarnlogo.png'}],apple:'/zarn-icons/icon-180.png'},
 // 'black' (not translucent): iOS home-screen apps shorten the page by the status bar when it's translucent,
 // which leaves a gap under anything pinned to the bottom (the tab bar).
 appleWebApp:{capable:true,title:'ZARN',statusBarStyle:'black'}};
export const viewport:Viewport={themeColor:'#0a0a0c',viewportFit:'cover',width:'device-width',initialScale:1,maximumScale:1,interactiveWidget:'resizes-content'};
export default function Layout({children}:{children:React.ReactNode}){return <>{children}<ZarnPwa/></>;}
