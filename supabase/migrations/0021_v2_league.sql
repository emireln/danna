-- =============================================================================
-- danna migration 0021: the weekly league (2.0.0). The XP of the last days, for the caller and their accepted friends.
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: the function is replaced with the same one. The same change ends supabase/schema.sql
-- for new projects. Run migration 0020 first.
-- =============================================================================

-- One row per person: the caller, and each accepted friend. Only the totals leave the database, never the runs.
drop function if exists public.friends_week_xp(int);
create function public.friends_week_xp(days int default 7)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_color text,
  avatar_path text,
  avatar_updated_at timestamptz,
  week_xp int
)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select auth.uid() as id
    union
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
    from public.friendships f
    where f.status = 'accepted'
      and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  ),
  window_days as (
    select greatest(1, least(coalesce(days, 7), 31)) as n
  )
  select
    p.id,
    pr.username,
    pr.display_name,
    pr.avatar_color,
    pr.avatar_path,
    pr.avatar_updated_at,
    coalesce(sum(a.xp), 0)::int
  from people p
  join public.profiles pr on pr.id = p.id
  left join public.attempts a
    on a.user_id = p.id
   and a.created_at >= now() - make_interval(days => (select n from window_days))
  where auth.uid() is not null
  group by p.id, pr.username, pr.display_name, pr.avatar_color, pr.avatar_path, pr.avatar_updated_at;
$$;

revoke all on function public.friends_week_xp(int) from public, anon;
grant execute on function public.friends_week_xp(int) to authenticated;
