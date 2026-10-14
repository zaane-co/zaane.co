import {notFound} from 'next/navigation';
import {staff,sessionClient} from '@/lib/supabase/server';
import {listFiles,r2Configured} from '@/lib/r2';
import {mediaUsage} from '@/lib/media-usage';
import MediaLibrary from '@/components/admin/MediaLibrary';
export default async function Page(){
 const user=await staff();if(!user)notFound();
 if(!r2Configured())return <div className="za-notice">File storage isn’t configured. Add the R2 environment variables.</div>;
 const files=(await listFiles()).sort((a,b)=>b.modified.localeCompare(a.modified));
 const usage=await mediaUsage(await sessionClient(),files.map(f=>f.url));
 return <MediaLibrary initial={files.map(f=>({...f,usage:usage[f.url]??[]}))} canDelete={user.role!=='editor'}/>;
}
