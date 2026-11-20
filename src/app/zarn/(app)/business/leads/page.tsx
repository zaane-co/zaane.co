import {redirect} from 'next/navigation';
// Leads now live under Contacts, Companies and Deals. Old links (and lead notifications) land on Contacts.
export default async function Page({searchParams}:{searchParams:Promise<{c?:string}>}){
 const {c}=await searchParams;redirect(c?`/zarn/business/contacts?c=${encodeURIComponent(c)}`:'/zarn/business/contacts');
}
