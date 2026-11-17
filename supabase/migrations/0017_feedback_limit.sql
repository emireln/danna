-- =============================================================================
-- danna migration 0017: one feedback message an hour for each account.
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: every change checks what is already there. The same change ends supabase/schema.sql for
-- new projects. Run migration 0016 first.
-- =============================================================================

-- [feedback limit]
-- The seconds an account must still wait before its next message: 0 when it can send now. The app cannot read its own
-- messages, so this function reads them for the account, and tells the app only the number of seconds.
create or replace function public.feedback_wait_seconds()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    greatest(0, ceil(extract(epoch from (max(f.created_at) + interval '1 hour' - now())))),
    0
  )::integer
  from public.feedback f
  where f.user_id = (select auth.uid());
$$;

revoke all on function public.feedback_wait_seconds() from public, anon;
grant execute on function public.feedback_wait_seconds() to authenticated;

-- An account can add a message only when it has not sent one in the last hour.
drop policy if exists "feedback: add own" on public.feedback;
create policy "feedback: add own" on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.feedback_wait_seconds() = 0);
-- [/feedback limit]
