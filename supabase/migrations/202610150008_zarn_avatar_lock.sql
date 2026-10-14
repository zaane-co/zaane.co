-- Profile photos are only set through /api/zarn/avatar (R2 upload), never as an arbitrary URL from the browser.
revoke update(avatar_url) on public.zarn_members from authenticated;
