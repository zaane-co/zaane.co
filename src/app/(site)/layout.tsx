import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
export default function Layout({children}:{children:React.ReactNode}){return <><a className="skip-link" href="#main">Skip to content</a><SiteHeader/>{children}<Footer/></>;}
