import 'server-only';
import {serviceClient} from '@/lib/supabase/server';
import {deleteFile} from '@/lib/r2';
const DAYS=30;
// Drive trash empties itself: anything in the trash for 30 days is deleted for good, with its stored file copies.
export async function purgeTrash(){
 const db=serviceClient(),cutoff=new Date(Date.now()-DAYS*864e5).toISOString();
 const [{data:folders},{data:files},{data:docs}]=await Promise.all([
  db.from('zarn_drive_folders').select('id').lt('trashed_at',cutoff).limit(200),
  db.from('zarn_files').select('id,key').lt('trashed_at',cutoff).limit(500),
  db.from('zarn_docs').select('id').lt('trashed_at',cutoff).limit(500),
 ]);
 // Files inside old trashed folders, at any depth.
 let level=(folders??[]).map(f=>f.id as string);const all=new Set(level);
 while(level.length){const {data}=await db.from('zarn_drive_folders').select('id').in('parent_id',level);level=(data??[]).map(f=>f.id as string).filter(id=>!all.has(id));level.forEach(id=>all.add(id));}
 const inside=all.size?(await db.from('zarn_files').select('id,key').in('folder_id',[...all])).data??[]:[];
 const gone=[...(files??[]),...inside] as {id:string;key:string}[];
 const ids=gone.map(f=>f.id);
 if(ids.length)await db.from('zarn_files').delete().in('id',ids);
 for(const key of new Set(gone.map(f=>f.key))){
  const [{count:left},{count:msgs}]=await Promise.all([
   db.from('zarn_files').select('id',{count:'exact',head:true}).eq('key',key),
   db.from('zarn_messages').select('id',{count:'exact',head:true}).contains('attachments',[{key}]),
  ]);
  if(!left&&!msgs)await deleteFile(key).catch(()=>{});
 }
 if(docs?.length)await db.from('zarn_docs').delete().in('id',docs.map(d=>d.id));
 if(folders?.length)await db.from('zarn_drive_folders').delete().in('id',folders.map(f=>f.id));
 return {files:ids.length,docs:docs?.length??0,folders:folders?.length??0};
}
