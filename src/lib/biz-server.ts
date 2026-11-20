import 'server-only';
import {serviceClient} from '@/lib/supabase/server';
import {pushTo} from '@/lib/zarn-push';
import {lagosToday,fmtDay} from '@/lib/zarn-care';
import {money} from '@/lib/crm';
// Daily: tells ZARN admins about bills due within two days (or already late), once per due date.
export async function fireBills(){
 const db=serviceClient(),today=lagosToday(),t=new Date(`${today}T12:00:00Z`);t.setUTCDate(t.getUTCDate()+2);
 const {data:bills}=await db.from('zarn_bills').select('id,title,amount,currency,due_on,reminded_for').not('due_on','is',null).lte('due_on',t.toISOString().slice(0,10));
 const due=(bills??[]).filter(b=>b.reminded_for!==b.due_on);if(!due.length)return 0;
 const [{data:admins},{data:supers}]=await Promise.all([db.from('zarn_members').select('user_id').eq('is_admin',true),db.from('users').select('id').eq('role','super_admin')]);
 const to=[...new Set([...(admins??[]).map(a=>a.user_id),...(supers??[]).map(s=>s.id)])];
 for(const b of due){
  const when=b.due_on<today?`was due ${fmtDay(b.due_on)}`:b.due_on===today?'is due today':`is due ${fmtDay(b.due_on)}`;
  await pushTo(to,{title:`${b.title} ${when}`,body:`${money(Number(b.amount),b.currency)}. Tap to pay and log it.`,tag:`bill-${b.id}`,url:'/zarn/business/bills'}).catch(()=>0);
  await db.from('zarn_bills').update({reminded_for:b.due_on}).eq('id',b.id);
 }
 return due.length;
}
