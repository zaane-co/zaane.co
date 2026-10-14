import {staff} from '@/lib/supabase/server';
import {allowed} from '@/lib/cms';
import {putFile,r2Configured,imageTypes} from '@/lib/r2';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 {const u=await staff();if(!u||!allowed('media',u.role))return Response.json({error:'Access denied'},{status:403});}
 const data=await request.formData();const file=data.get('file');
 // SVG is excluded here: it can carry scripts, and these files are served from a public URL.
 if(!(file instanceof File)||!imageTypes[file.type]||file.type==='image/svg+xml'||file.size>10*1024*1024)return Response.json({error:'Choose a JPG, PNG, WebP, AVIF or GIF image under 10 MB.'},{status:400});
 // All uploads go to Cloudflare R2; there is deliberately no Supabase Storage fallback.
 if(!r2Configured())return Response.json({error:'File storage isn’t configured. Add the R2 environment variables.'},{status:503});
 try{return Response.json(await putFile(file));}catch{return Response.json({error:'Upload failed. Try again.'},{status:502});}
}
