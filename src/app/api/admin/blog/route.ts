import {staff,sessionClient} from '@/lib/supabase/server';
import {safeUrl} from '@/lib/cms';
import {cleanHtml} from '@/lib/blog-html';
import {revalidatePath} from 'next/cache';
import {fetchMeta} from '@/lib/link-meta';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugify=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const str=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
type Mode='draft'|'scheduled'|'published';
// draft -> status draft; published -> live now; scheduled -> published with a future published_at (the site hides it until then).
async function publishing(db:Awaited<ReturnType<typeof sessionClient>>,id:string|undefined,mode:Mode,at:unknown){
 if(mode==='draft')return {status:'draft',published_at:null};
 if(mode==='scheduled'){const d=new Date(String(at));if(Number.isNaN(d.getTime())||d<=new Date())throw new Error('Pick a future date and time to schedule.');return {status:'published',published_at:d.toISOString()};}
 const {data:old}=id?await db.from('blog_posts').select('status,published_at').eq('id',id).single():{data:null};
 const keep=old?.status==='published'&&old.published_at&&new Date(old.published_at)<=new Date();
 return {status:'published',published_at:keep?old.published_at:new Date().toISOString()};
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const user=await staff();if(!user)return Response.json({error:'Access denied'},{status:403});
 const body=await request.json().catch(()=>null);if(!body||typeof body.action!=='string')return Response.json({error:'Invalid request'},{status:400});
 if(body.id!=null&&!uuid.test(String(body.id)))return Response.json({error:'Invalid request'},{status:400});
 const db=await sessionClient(),admin=user.role!=='editor',done=(data:object={ok:true})=>{revalidatePath('/','layout');return Response.json(data);};
 try{
  switch(body.action){
   case 'save':{
    const v=body.values||{},mode=(['draft','scheduled','published'].includes(v.mode)?v.mode:'draft') as Mode;
    if(!admin&&mode!=='draft')return Response.json({error:'An admin must publish or schedule this post.'},{status:403});
    const title=str(v.title,200);if(!title)return Response.json({error:'Title is required.'},{status:400});
    const slug=slugify(str(v.slug,120)||title);if(!slug)return Response.json({error:'Add a URL slug.'},{status:400});
    const content=cleanHtml(typeof v.content==='string'?v.content.slice(0,200000):'');
    const cover=str(v.cover_image,2000);if(cover&&!safeUrl(cover))return Response.json({error:'Cover image URL is invalid.'},{status:400});
    const cats:string[]=Array.isArray(v.category_ids)?v.category_ids.filter((c:unknown)=>typeof c==='string'&&uuid.test(c)).slice(0,20):[];
    const row={title,slug,excerpt:str(v.excerpt,500),content,cover_image:cover||null,meta_title:str(v.meta_title,200),meta_description:str(v.meta_description,400),focus_keyword:str(v.focus_keyword,100),category_id:cats[0]||null,...await publishing(db,body.id,mode,v.published_at)};
    const res=body.id?await db.from('blog_posts').update(row).eq('id',body.id).select('id'):await db.from('blog_posts').insert({...row,author_id:user.id,author_name:user.name||'Zaane Studio'}).select('id');
    if(res.error||!res.data?.length)return Response.json({error:res.error?.code==='23505'?'Another post already uses that slug.':'Could not save this post.'},{status:400});
    const id=res.data[0].id;
    await db.from('blog_post_categories').delete().eq('post_id',id);
    if(cats.length){const {error}=await db.from('blog_post_categories').insert(cats.map(category_id=>({post_id:id,category_id})));if(error)throw error;}
    return done({ok:true,id});
   }
   case 'status':{
    const mode=body.mode as Mode;if(!['draft','scheduled','published'].includes(mode)||!body.id)return Response.json({error:'Invalid request'},{status:400});
    if(!admin)return Response.json({error:'An admin must change publishing status.'},{status:403});
    const {error}=await db.from('blog_posts').update(await publishing(db,body.id,mode,body.published_at)).eq('id',body.id);if(error)throw error;return done();
   }
   case 'delete':{
    if(!admin||!body.id)return Response.json({error:'Deletion is not permitted.'},{status:403});
    const {error}=await db.from('blog_posts').delete().eq('id',body.id);if(error)throw error;return done();
   }
   case 'feature':{
    if(!admin)return Response.json({error:'An admin must choose the featured post.'},{status:403});
    const {error}=await db.from('blog_posts').update({featured:false}).eq('featured',true);if(error)throw error;
    if(body.id){const {error:e}=await db.from('blog_posts').update({featured:true}).eq('id',body.id);if(e)throw e;}
    return done();
   }
   case 'category':{
    if(!admin)return Response.json({error:'An admin must manage categories.'},{status:403});
    const name=str(body.name,80);if(!name)return Response.json({error:'Enter a category name.'},{status:400});
    const parent=body.parent_id&&uuid.test(String(body.parent_id))?body.parent_id:null;
    const {data,error}=await db.from('blog_categories').insert({name,slug:slugify(name)+(parent?'-'+crypto.randomUUID().slice(0,4):''),parent_id:parent}).select('*').single();
    if(error)return Response.json({error:error.code==='23505'?'A category with that name already exists.':'Could not add this category.'},{status:400});
    return done(data);
   }
   case 'delete_category':{
    if(!admin||!body.id)return Response.json({error:'An admin must manage categories.'},{status:403});
    const {error}=await db.from('blog_categories').delete().eq('id',body.id);if(error)throw error;return done();
   }
   // Comments (admins moderate; editors can only read)
   case 'comment_approve':case 'comment_reply':case 'comment_delete':{
    if(!admin||!body.id)return Response.json({error:'An admin must moderate comments.'},{status:403});
    if(body.action==='comment_delete'){const {error}=await db.from('blog_comments').delete().eq('id',body.id);if(error)throw error;return done();}
    const patch=body.action==='comment_approve'?{approved:!!body.approved}:(()=>{const reply=str(body.reply,3000);return {admin_reply:reply||null,replied_at:reply?new Date().toISOString():null};})();
    const {data,error}=await db.from('blog_comments').update(patch).eq('id',body.id).select('approved,admin_reply,replied_at').single();if(error)throw error;return done(data);
   }
   // Curated links
   case 'curated_fetch':{
    if(!admin)return Response.json({error:'An admin must manage curated links.'},{status:403});
    const url=str(body.url,2000);if(!safeUrl(url)||!/^https?:/.test(url))return Response.json({error:'Enter a full http(s) link.'},{status:400});
    return Response.json(await fetchMeta(url));
   }
   case 'curated_save':{
    if(!admin)return Response.json({error:'An admin must manage curated links.'},{status:403});
    const url=str(body.url,2000),title=str(body.title,300),cover=str(body.cover_image,2000);
    if(!/^https?:/.test(url)||!safeUrl(url))return Response.json({error:'Enter a full http(s) link.'},{status:400});
    if(!title)return Response.json({error:'Add a title.'},{status:400});
    if(cover&&(!/^https?:/.test(cover)||!safeUrl(cover)))return Response.json({error:'Cover image must be an http(s) URL.'},{status:400});
    const {data,error}=await db.from('blog_curated').insert({url,title,source_name:str(body.source_name,120)||new URL(url).hostname.replace(/^www\./,''),excerpt:str(body.excerpt,600)||null,cover_image:cover||null}).select('*').single();
    if(error)throw error;return done(data);
   }
   case 'curated_toggle':{
    if(!admin||!body.id)return Response.json({error:'An admin must manage curated links.'},{status:403});
    const {error}=await db.from('blog_curated').update({published:!!body.published}).eq('id',body.id);if(error)throw error;return done();
   }
   case 'curated_delete':{
    if(!admin||!body.id)return Response.json({error:'An admin must manage curated links.'},{status:403});
    const {error}=await db.from('blog_curated').delete().eq('id',body.id);if(error)throw error;return done();
   }
  }
  return Response.json({error:'Invalid request'},{status:400});
 }catch(e){return Response.json({error:e instanceof Error&&e.message.startsWith('Pick')?e.message:'Something went wrong. Try again.'},{status:400});}
}
