import {redirect} from 'next/navigation';
// /zarn/clients on its own shows the full client list.
export default function Page(){redirect('/zarn/business/clients');}
