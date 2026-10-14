import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
// Where each uploaded file is referenced, so the library can show it and warn before deleting.
const sources:{table:string;fields:string[];label:(r:Record<string,unknown>)=>string;href:(r:Record<string,unknown>)=>string}[]=[
 {table:'blog_posts',fields:['cover_image','content'],label:r=>`Post: ${r.title}`,href:r=>`/admin/blog/${r.id}`},
 {table:'projects',fields:['cover_image','what_was_achieved'],label:r=>`Project: ${r.title}`,href:()=>'/admin/projects'},
 {table:'project_images',fields:['image_url'],label:()=>'Project gallery',href:()=>'/admin/projects'},
 {table:'testimonials',fields:['photo_url'],label:r=>`Testimonial: ${r.client_name}`,href:()=>'/admin/testimonials'},
 {table:'team_members',fields:['photo_url'],label:r=>`Team: ${r.name}`,href:()=>'/admin/team_members'},
 {table:'pages_content',fields:['content'],label:r=>`Page: ${r.page_key}`,href:()=>'/admin/pages_content'},
];
export type Usage={label:string;href:string};
export async function mediaUsage(db:SupabaseClient,urls:string[]){
 const map:Record<string,Usage[]>=Object.fromEntries(urls.map(u=>[u,[]]));
 const results=await Promise.all(sources.map(s=>db.from(s.table).select('*').then(r=>({s,rows:(r.data??[]) as Record<string,unknown>[]}))));
 for(const {s,rows} of results)for(const row of rows){
  const text=s.fields.map(f=>String(row[f]??'')).join('\n');
  for(const u of urls)if(text.includes(u))map[u].push({label:s.label(row),href:s.href(row)});
 }
 return map;
}
