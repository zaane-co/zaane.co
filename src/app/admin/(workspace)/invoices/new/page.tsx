import NewInvoice from '@/components/admin/crm/NewInvoice';
import {invoiceAccess,loadStages} from '../../leads/data';
export default async function Page({searchParams}:{searchParams:Promise<{client?:string}>}){
 const {db}=await invoiceAccess();
 const [{data:clients},stages,{client}]=await Promise.all([db.from('leads').select('id,name,company,email,currency,status').order('name'),loadStages(db),searchParams]);
 return <NewInvoice clients={clients??[]} stages={stages} initialClient={clients?.some(c=>c.id===client)?client:undefined}/>;
}
