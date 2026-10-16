-- Video calls: remember whether a call was started as video, so the other person's ringing screen can say so.
alter table public.zarn_calls add column video boolean not null default false;
