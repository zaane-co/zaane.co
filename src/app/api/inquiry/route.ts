import {z} from 'zod';
import {createHash} from 'node:crypto';
import {serviceClient} from '@/lib/supabase/server';
import {after} from 'next/server';
const schema=z.object({kind:z.enum(['project','contact','partnership','application','subscribe']),name:z.string().trim().max(120).default(''),email:z.email().max(254),company:z.string().trim().max(200).default(''),service:z.string().trim().max(120).default(''),budget:z.string().max(100).default(''),message:z.string().trim().max(10000).default(''),subject:z.string().trim().max(200).default(''),website:z.string().max(500).default(''),consent:z.literal(true)});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const raw=await request.text();if(raw.length>16000)return Response.json({error:'Your message is too long.'},{status:413});
 let body;try{body=JSON.parse(raw);}catch{return Response.json({error:'Invalid request'},{status:400});}
 const parsed=schema.safeParse(body);if(!parsed.success)return Response.json({error:'Check your email and required fields, and accept the privacy notice.'},{status:400});
 const v=parsed.data;if(v.website)return Response.json({ok:true});
 if(v.kind!=='subscribe'&&(!v.name||v.message.length<10))return Response.json({error:'Enter your name and a message of at least 10 characters.'},{status:400});
 if(v.kind==='project'&&!v.service)return Response.json({error:'Choose a service.'},{status:400});
 try{
  const db=serviceClient();
  const ip=request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-real-ip')||'local';
  for(const token of [v.email.toLowerCase(),ip]){
   const key=createHash('sha256').update((process.env.RATE_LIMIT_SALT||process.env.SUPABASE_SERVICE_ROLE_KEY!)+token).digest('hex');
   const {data,error}=await db.rpc('consume_rate_limit',{bucket:key});
   if(error)throw error;if(!data)return Response.json({error:'Too many submissions. Please try again in an hour or email hello@zaane.co.'},{status:429});
  }
  const table=v.kind==='subscribe'?'subscribers':['project','partnership'].includes(v.kind)?'leads':'contact_submissions';
  const record:Record<string,unknown>=table==='subscribers'?{email:v.email.toLowerCase()}:table==='leads'?{name:v.name,email:v.email,company:v.company,service_interested:v.kind==='partnership'?'Brand Partnerships':v.service,budget_range:v.budget,message:v.message}:{name:v.name,email:v.email,subject:v.kind==='application'?`Application: ${v.subject}`:v.subject||'General inquiry',message:v.message};
  const {error}=await db.from(table).insert(record);
  if(error&&!(table==='subscribers'&&error.code==='23505'))throw error;
  if(v.kind!=='subscribe'&&process.env.RESEND_API_KEY)after(async()=>{
   try{const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM,to:[process.env.LEAD_NOTIFICATION_EMAIL||'hello@zaane.co'],reply_to:v.email,subject:`New Zaane ${v.kind} inquiry`,text:`${v.name} <${v.email}>\n${v.company}\n${v.service}\n${v.budget}\n\n${v.message}\n\nView this submission in /admin.`})});if(!result.ok)console.error('Lead saved; email notification failed:',result.status);}catch{console.error('Lead saved; notification service unavailable.');}
  });
  return Response.json({ok:true});
 }catch{return Response.json({error:'We could not save your message. Please try again or email hello@zaane.co.'},{status:503});}
}
