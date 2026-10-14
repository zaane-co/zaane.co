import type {Metadata} from 'next';
import './zarn.css';
export const metadata:Metadata={title:'ZARN',robots:{index:false,follow:false},icons:{icon:'/zarnlogo.png',apple:'/zarnlogo.png'}};
export default function Layout({children}:{children:React.ReactNode}){return children;}
