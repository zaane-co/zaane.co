import {staff,sessionClient} from '@/lib/supabase/server';
import {allowed,isAdmin} from '@/lib/cms';
import {deleteFile,keyFromUrl,listFiles,MEDIA_PREFIX,r2Configured} from '@/lib/r2';
import {mediaUsage} from '@/lib/media-usage';
// Library listing for the "Choose from library" picker.
export async function GET(){
 {const u=await staff();if(!u||!allowed('media',u.role))return Response.json({error:'Access denied'},{status:403});}
 if(!r2Configured())return Response.json([]);
 try{return Response.json((await listFiles()).sort((a,b)=>b.modified.localeCompare(a.modified)),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Could not load media.'},{status:502});}
}
// Uploads go through /api/admin/upload; this route deletes from the library.
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const user=await staff();if(!user||!isAdmin(user.role))return Response.json({error:'An admin must delete media.'},{status:403});
 if(!r2Configured())return Response.json({error:'File storage is not configured.'},{status:503});
 const body=await request.json().catch(()=>null);const url=typeof body?.url==='string'?body.url:'';
 const key=keyFromUrl(url);if(body?.action!=='delete'||!key||!key.startsWith(MEDIA_PREFIX)||key.includes('..'))return Response.json({error:'Invalid request'},{status:400});
 if(!body.force){const used=(await mediaUsage(await sessionClient(),[url]))[url];if(used.length)return Response.json({error:'in_use',usage:used},{status:409});}
 try{await deleteFile(key);return Response.json({ok:true});}catch{return Response.json({error:'Could not delete the file.'},{status:502});}
}
