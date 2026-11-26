-- =============================================================================
-- danna migration 0028: security hardening, from the review of the database.
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again. Run migration 0027 first. The same changes end supabase/schema.sql for new projects.
--
-- What it changes. No data is deleted, and no account or setting changes.
--  * Profile pictures and banners: the read rule now also checks that the file is the owner's own file. The rows already
--    had to point at the owner's own file (a check on every new or changed row), and this makes the read rule rely on
--    the same fact. Rows made before that check are checked now. If one breaks the rule, a notice says so, and the rule
--    still holds for every new or changed row.
--  * AI keys: the anonymous role gets no rights on the table. It had none before; this states it.
--  * The chat trigger that touches a chat: a fixed search path, and no direct execute rights. It only runs as a trigger.
-- =============================================================================

-- 1. Check the owner rule on the picture rows that already exist.
do $$
begin
  alter table public.profiles validate constraint profiles_avatar_owner;
  alter table public.profiles validate constraint profiles_banner_owner;
exception
  when check_violation then
    raise notice 'Some profiles point at a picture that is not their own. The rule still applies to every new or changed row.';
end $$;

-- 2. The read rules for pictures: the owner's own file, read by the owner or by a friend.
create or replace function public.can_read_avatar(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.avatar_path = object_name
      and object_name = p.id::text || '/avatar.webp'
      and (p.id = auth.uid() or public.are_friends(p.id, auth.uid()))
  );
$$;

create or replace function public.can_read_banner(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.banner_path = object_name
      and object_name = p.id::text || '/banner.webp'
      and (p.id = auth.uid() or public.are_friends(p.id, auth.uid()))
  );
$$;

revoke all on function public.can_read_avatar(text) from public, anon;
grant execute on function public.can_read_avatar(text) to authenticated;
revoke all on function public.can_read_banner(text) from public, anon;
grant execute on function public.can_read_banner(text) to authenticated;

-- 3. AI keys: the anonymous role has no rights on the table.
revoke all on public.ai_keys from anon;

-- 4. The chat trigger function: a fixed search path, and no direct calls. It runs only as a trigger.
alter function public.touch_tutor_chat() set search_path = '';
revoke all on function public.touch_tutor_chat() from public, anon, authenticated;
