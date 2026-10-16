import {serviceClient} from '@/lib/supabase/server';
import {zarnMember} from '@/lib/zarn-server';
import {fetchPreview} from '@/lib/link-preview';
export const maxDuration=15;
// A preview card for a link someone shared. Results are cached for a week, including "nothing to show".
export async function GET(request:Request){
 const me=await zarnMember();if(!me)return Response.json({error:'Sign in first.'},{status:401});
 const raw=new URL(request.url).searchParams.get('url')??'';
 if(raw.length>2000||!/^https?:\/\//i.test(raw))return Response.json({preview:null});
 const db=serviceClient();
 const {data:cached}=await db.from('zarn_link_previews').select('*').eq('url',raw).maybeSingle();
 if(cached&&Date.now()-new Date(cached.fetched_at).getTime()<7*86400_000){
  return Response.json({preview:cached.title||cached.description||cached.image?{url:cached.url,title:cached.title,description:cached.description,image:cached.image,site:cached.site}:null},{headers:{'Cache-Control':'private, max-age=3600'}});
 }
 // Sites that block link bots (or are unreachable) still get a simple card with the site's name.
 let host='';try{host=new URL(raw).hostname.replace(/^www\./,'');}catch{return Response.json({preview:null});}
 const p=(await fetchPreview(raw))??{url:raw,title:host,description:'',image:'',site:host};
 await db.from('zarn_link_previews').upsert({url:raw,title:p.title,description:p.description,image:p.image,site:p.site,fetched_at:new Date().toISOString()});
 return Response.json({preview:{url:raw,title:p.title,description:p.description,image:p.image,site:p.site}},{headers:{'Cache-Control':'private, max-age=3600'}});
}
