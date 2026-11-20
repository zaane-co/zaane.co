import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({request});
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return response;
  const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>request.cookies.getAll(),setAll(items){items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
  // Refreshes an expired session and rewrites cookies; the JWT itself is verified locally (ES256), no Auth round trip.
  const {data:claims}=await db.auth.getClaims();
  // A form's editor link opened by someone not signed in: show them the form to answer instead of the ZARN login.
  const form=request.nextUrl.pathname.match(/^\/zarn\/forms\/([0-9a-f-]{36})\/?$/i);
  if(form&&!claims?.claims?.sub)return NextResponse.redirect(new URL(`/f/${form[1]}`,request.url));
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const config = {matcher:['/admin/:path*','/api/admin/:path*','/api/auth/:path*','/zarn/:path*','/zarn','/api/zarn/:path*','/invoice/print/:path*','/invoice/b/print/:path*','/f/:path*']};
