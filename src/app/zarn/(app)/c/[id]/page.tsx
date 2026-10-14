import {notFound} from 'next/navigation';
import ChannelView from '@/components/zarn/ChannelView';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!uuid.test(id))notFound();return <ChannelView key={id} id={id}/>;}
