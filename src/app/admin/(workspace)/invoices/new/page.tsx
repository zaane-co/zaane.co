import NewInvoice from '@/components/admin/crm/NewInvoice';
import {bankColumns,type BankAccount} from '@/lib/bank';
import {invoiceAccess,loadStages} from '../../leads/data';
export default async function Page({searchParams}:{searchParams:Promise<{client?:string}>}){
 const {db}=await invoiceAccess();
 const [{data:clients},stages,{client},{data:accounts}]=await Promise.all([db.from('leads').select('id,name,company,email,currency,status').order('name'),loadStages(db),searchParams,db.from('bank_accounts').select(bankColumns).order('created_at')]);
 return <NewInvoice clients={clients??[]} stages={stages} accounts={(accounts??[]) as BankAccount[]} initialClient={clients?.some(c=>c.id===client)?client:undefined}/>;
}
