import {notFound} from 'next/navigation';
import {staff,serviceClient} from '@/lib/supabase/server';
import EditorsPage,{type Editor} from '@/components/admin/blog/EditorsPage';
export default async function Page(){
 const me=await staff();if(me?.role!=='super_admin')notFound();
 const db=serviceClient();
 const [{data:rows},{data:auth},{data:posts}]=await Promise.all([
  db.from('users').select('id,email,name,bio,created_at').eq('role','editor').order('created_at',{ascending:false}),
  db.auth.admin.listUsers({perPage:1000}),
  db.from('blog_posts').select('author_id').not('author_id','is',null),
 ]);
 const users=new Map((auth?.users??[]).map(u=>[u.id,u]));
 const counts=(posts??[]).reduce<Record<string,number>>((m,p)=>{m[p.author_id]=(m[p.author_id]??0)+1;return m;},{});
 const editors:Editor[]=(rows??[]).map(r=>{const [first,...rest]=(r.name||r.email.split('@')[0]).split(' ');const last=users.get(r.id)?.last_sign_in_at??null;return {...r,name:r.name||first,first_name:first,last_name:rest.join(' ')||null,verified:!!last,last_sign_in_at:last,post_count:counts[r.id]??0};});
 // eslint-disable-next-line react-hooks/purity -- server render; "last seen" is relative to request time
 return <EditorsPage initialEditors={editors} now={Date.now()}/>;
}
