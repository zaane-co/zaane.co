import WorkspaceSettings from '@/components/admin/zarn/WorkspaceSettings';
import {zarnAdmin} from '../data';
export default async function Page(){
 const {db}=await zarnAdmin();
 const {data}=await db.from('settings').select('value').eq('key','zarn_workspace_name').maybeSingle();
 return <WorkspaceSettings initial={data?.value||'ZARN'}/>;
}
