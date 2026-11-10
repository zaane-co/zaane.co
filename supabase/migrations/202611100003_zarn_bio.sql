-- ZARN profiles: "About me" bio, up to two extra call numbers, and a WhatsApp number.
alter table public.zarn_members add column if not exists bio text not null default '' check (char_length(bio) <= 600);
alter table public.zarn_members add column if not exists phone2 text not null default '' check (char_length(phone2) <= 40);
alter table public.zarn_members add column if not exists phone3 text not null default '' check (char_length(phone3) <= 40);
alter table public.zarn_members add column if not exists whatsapp text not null default '' check (char_length(whatsapp) <= 40);
grant update(bio,phone2,phone3,whatsapp) on public.zarn_members to authenticated;
