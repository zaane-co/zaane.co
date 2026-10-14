import {staff,sessionClient} from '@/lib/supabase/server';
import {deleteFile,keyFromUrl,MEDIA_PREFIX,r2Configured} from '@/lib/r2';
import {mediaUsage} from '@/lib/media-usage';
// Uploads go through /api/admin/upload; this route deletes from the library.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const user=await staff();if(!user||user.role==='editor')return Response.json({error:'An admin must delete media.'},{status:403});
 if(!r2Configured())return Response.json({error:'File storage is not configured.'},{status:503});
 const body=await request.json().catch(()=>null);const url=typeof body?.url==='string'?body.url:'';
 const key=keyFromUrl(url);if(body?.action!=='delete'||!key||!key.startsWith(MEDIA_PREFIX)||key.includes('..'))return Response.json({error:'Invalid request'},{status:400});
 if(!body.force){const used=(await mediaUsage(await sessionClient(),[url]))[url];if(used.length)return Response.json({error:'in_use',usage:used},{status:409});}
 try{await deleteFile(key);return Response.json({ok:true});}catch{return Response.json({error:'Could not delete the file.'},{status:502});}
}
