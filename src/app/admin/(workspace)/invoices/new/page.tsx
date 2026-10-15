import NewInvoice from '@/components/admin/crm/NewInvoice';
import {invoiceAccess} from '../../leads/data';
export default async function Page({searchParams}:{searchParams:Promise<{client?:string}>}){
 const {db}=await invoiceAccess();
 const [{data:clients},{client}]=await Promise.all([db.from('leads').select('id,name,company,email,currency').order('name'),searchParams]);
 return <NewInvoice clients={clients??[]} initialClient={clients?.some(c=>c.id===client)?client:undefined}/>;
}
