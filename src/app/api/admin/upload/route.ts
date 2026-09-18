import {staff,sessionClient} from '@/lib/supabase/server';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 if(!await staff())return Response.json({error:'Access denied'},{status:403});
 const data=await request.formData();const file=data.get('file');
 const types:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'};
 if(!(file instanceof File)||!types[file.type]||file.size>5*1024*1024)return Response.json({error:'Choose a JPG, PNG, WebP or AVIF image under 5 MB.'},{status:400});
 const db=await sessionClient();const path=`${crypto.randomUUID()}.${types[file.type]}`;
 const {error}=await db.storage.from('media').upload(path,file,{contentType:file.type,upsert:false});
 if(error)return Response.json({error:'Upload failed. Check storage permissions.'},{status:400});
 return Response.json({url:db.storage.from('media').getPublicUrl(path).data.publicUrl});
}
