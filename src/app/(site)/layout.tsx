import type {Metadata} from 'next';
import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
import {settings} from '@/lib/content';
// Site title and description from Settings, when set; pages with their own metadata still win.
export async function generateMetadata():Promise<Metadata>{const s=await settings().catch(()=>({} as Record<string,string>));return {...(s.site_title&&{title:s.site_title}),...(s.site_description&&{description:s.site_description})};}
export default function Layout({children}:{children:React.ReactNode}){return <><a className="skip-link" href="#main">Skip to content</a><SiteHeader/>{children}<Footer/></>;}
