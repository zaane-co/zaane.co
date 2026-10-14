import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import {putFile,r2Configured,imageTypes} from '@/lib/r2';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 {const u=await staff();if(!u||!allowed('media',u.role))return Response.json({error:'Access denied'},{status:403});}
 const data=await request.formData();const file=data.get('file');
 // SVG is excluded here: it can carry scripts, and these files are served from a public URL.
 if(!(file instanceof File)||!imageTypes[file.type]||file.type==='image/svg+xml'||file.size>10*1024*1024)return Response.json({error:'Choose a JPG, PNG, WebP, AVIF or GIF image under 10 MB.'},{status:400});
 // Fallback until the R2 env vars are set in this environment: the original Supabase bucket.
 if(!r2Configured()){const db=await sessionClient(),path=`${crypto.randomUUID()}.${imageTypes[file.type]}`;const {error}=await db.storage.from('media').upload(path,file,{contentType:file.type,upsert:false});if(error)return Response.json({error:'Upload failed. Check storage permissions.'},{status:400});return Response.json({url:db.storage.from('media').getPublicUrl(path).data.publicUrl});}
 try{return Response.json(await putFile(file));}catch{return Response.json({error:'Upload failed. Try again.'},{status:502});}
}
