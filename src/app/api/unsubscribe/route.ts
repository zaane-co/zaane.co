import {serviceClient} from '@/lib/supabase/server';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Handles both the confirm button on /unsubscribe and mail clients' one-click List-Unsubscribe POST.
export async function POST(request:Request){
 const url=new URL(request.url);let token=url.searchParams.get('t')||'';
 if(!token){const form=await request.formData().catch(()=>null);token=String(form?.get('t')||'');}
 if(!uuid.test(token))return Response.json({error:'Invalid link'},{status:400});
 const {error}=await serviceClient().from('subscribers').update({unsubscribed_at:new Date().toISOString()}).eq('unsubscribe_token',token).is('unsubscribed_at',null);
 if(error)return Response.json({error:'Could not unsubscribe. Please try again.'},{status:503});
 return Response.json({ok:true});
}
