import {after} from 'next/server';
import {serviceClient} from '@/lib/supabase/server';
import {livePost,sameOrigin,clientIp,allow,uuid} from '@/lib/blog-public';
// Public: approved comments for a post.
export async function GET(request:Request){
 const postId=new URL(request.url).searchParams.get('post_id');
 if(!postId||!uuid.test(postId))return Response.json([]);
 const {data}=await serviceClient().from('blog_comments').select('id,author_name,content,admin_reply,replied_at,created_at').eq('post_id',postId).eq('approved',true).order('created_at',{ascending:true});
 return Response.json(data??[]);
}
// Public: submit a comment. It stays hidden until an admin approves it.
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Invalid origin'},{status:403});
 const body=await request.json().catch(()=>null);if(!body)return Response.json({error:'Invalid request'},{status:400});
 if(body.website)return Response.json({ok:true},{status:201});
 const name=typeof body.author_name==='string'?body.author_name.trim():'',content=typeof body.content==='string'?body.content.trim():'',email=typeof body.author_email==='string'?body.author_email.trim():'';
 if(!name||name.length>80||!content||content.length>3000)return Response.json({error:'Add your name and a comment (up to 3,000 characters).'},{status:400});
 if(email&&(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return Response.json({error:'That email address doesn’t look right.'},{status:400});
 const post=await livePost(body.post_id);if(!post)return Response.json({error:'This article is not accepting comments.'},{status:400});
 if(!await allow('comment',clientIp(request)))return Response.json({error:'Too many comments. Please try again in an hour.'},{status:429});
 const {error}=await serviceClient().from('blog_comments').insert({post_id:post.id,author_name:name,author_email:email||null,content});
 if(error)return Response.json({error:'Could not post your comment. Try again shortly.'},{status:500});
 if(process.env.RESEND_API_KEY&&process.env.RESEND_FROM&&process.env.LEAD_NOTIFICATION_EMAIL)after(async()=>{
  const site=process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin;
  await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM,to:[process.env.LEAD_NOTIFICATION_EMAIL],subject:`New comment on "${post.title}"`,text:`${name}${email?` <${email}>`:''} commented on "${post.title}":\n\n${content}\n\nApprove or reply: ${site}/admin/blog/comments`})}).catch(()=>{});
 });
 return Response.json({ok:true},{status:201});
}
