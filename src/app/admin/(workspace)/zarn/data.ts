import 'server-only';
import {notFound} from 'next/navigation';
import {staff,serviceClient} from '@/lib/supabase/server';
import {isAdmin} from '@/lib/cms';
// ZARN admin is for staff admins and super admins only.
export async function zarnAdmin(){const me=await staff();if(!me||!isAdmin(me.role))notFound();return {me,db:serviceClient()};}
