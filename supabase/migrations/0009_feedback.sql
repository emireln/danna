-- =============================================================================
-- danna migration 0009: feedback from the account (a rating and a comment).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: every change checks what is already there. The same changes end
-- supabase/schema.sql for new projects.
--
-- What it adds
--  * A feedback table: a rating from 1 to 5 stars, an optional comment of up to 1000 characters, and the
--    app version. Each row belongs to the account that sent it.
--  * An account can only add its own messages. The app cannot read the table back, so the project owner
--    reads the messages in the Table Editor or the SQL Editor.
--  * A limit of 50 messages for each account, counted by the same trigger the other tables use.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The table: one row per message
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  app_version text not null default '' check (char_length(app_version) <= 20),
  created_at timestamptz not null default now()
);

create index if not exists feedback_user_idx on public.feedback (user_id);

alter table public.feedback enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Who can write: the signed-in account, for its own messages only. Nobody reads the table through the app.
-- ---------------------------------------------------------------------------
drop policy if exists "feedback: add own" on public.feedback;
create policy "feedback: add own" on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The limit for each account, counted by the same trigger the other tables use
-- ---------------------------------------------------------------------------
drop trigger if exists feedback_quota on public.feedback;
create trigger feedback_quota before insert on public.feedback
  for each row execute function public.enforce_quota('user_id', '50');
