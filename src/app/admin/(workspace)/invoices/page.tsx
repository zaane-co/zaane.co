import InvoiceList from '@/components/admin/crm/InvoiceList';
import type {Invoice} from '@/lib/crm';
import {invoiceAccess} from '../leads/data';
export default async function Page(){
 const {db}=await invoiceAccess();
 const month=new Date();month.setDate(1);
 const [{data,error},{data:payments}]=await Promise.all([
  db.from('invoices').select('*,leads(name,company)').order('created_at',{ascending:false}).limit(1000),
  db.from('invoice_payments').select('amount,invoices(currency)').gte('paid_on',month.toISOString().slice(0,10)),
 ]);
 if(error)return <div className="za-page"><div className="za-page-head"><div><h1>Invoices</h1></div></div><div className="za-notice" role="alert">Could not load invoices. Check that the 202610140005 migration is applied.</div></div>;
 const rows=(data??[]).map(r=>{const l=r.leads as unknown as {name:string;company:string}|null;return {...(r as Invoice),client:l?.company||l?.name||''};});
 const collected=(payments??[]).map(p=>({currency:(p.invoices as unknown as {currency:string}|null)?.currency??'NGN',amount:Number(p.amount)}));
 return <InvoiceList invoices={rows} collected={collected}/>;
}
