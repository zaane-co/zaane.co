import {fireDue} from '@/lib/zarn-care-server';
// Daily job (vercel.json, 07:00 UTC = 08:00 Lagos): sends the day's client reminders and due deliverables.
// Vercel signs the call with CRON_SECRET; without that setting the job stays off and reminders still fire when someone opens ZARN.
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return new Response('Unauthorized',{status:401});
 return Response.json({fired:await fireDue()});
}
