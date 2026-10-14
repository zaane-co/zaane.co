import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {putFile,r2Configured,imageTypes} from '@/lib/r2';
// Profile photo: stored on Cloudflare R2 (public, like other site images). The browser crops it square first.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const me=await zarnMember();if(!me)return Response.json({error:'Sign in first.'},{status:401});
 if(!r2Configured())return Response.json({error:'File storage isn’t configured.'},{status:503});
 const file=(await request.formData()).get('file');
 if(!(file instanceof File)||!imageTypes[file.type]||file.type==='image/svg+xml'||file.size>2*1024*1024)return Response.json({error:'Choose a JPG, PNG or WebP image.'},{status:400});
 try{
  const {url}=await putFile(file,`avatar-${me.user_id.slice(0,8)}`);
  const {error}=await serviceClient().from('zarn_members').update({avatar_url:url}).eq('user_id',me.user_id);
  if(error)throw error;
  return Response.json({ok:true,url});
 }catch{return Response.json({error:'Upload failed. Try again.'},{status:502});}
}
export async function DELETE(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const me=await zarnMember();if(!me)return Response.json({error:'Sign in first.'},{status:401});
 await serviceClient().from('zarn_members').update({avatar_url:null}).eq('user_id',me.user_id);
 return Response.json({ok:true});
}
