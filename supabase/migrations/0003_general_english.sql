-- =============================================================================
-- danna migration 0003: general English. Each learner picks General English or the TOEFL
-- warm-up, the A1 level is added, and the 0.4.0 release note is published.
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again. The same section ends supabase/schema.sql for new projects.
--
-- Security
--  * The goal can only be one of two values, and each person can change only their own row.
--  * Existing rows keep their data. Every value they hold already fits the new rules.
--  * Learners from before 0.4.0 keep the TOEFL track: their goal is toefl. New profiles start as General English.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Learning goal and the A1 level
-- ---------------------------------------------------------------------------
-- Learners from before 0.4.0 were all practicing for the TOEFL, so every row that exists when the
-- column is added gets the TOEFL track. Profiles created afterwards start as General English.
alter table public.profiles
  add column if not exists goal text not null default 'toefl';

alter table public.profiles
  alter column goal set default 'english';

alter table public.profiles
  drop constraint if exists profiles_goal_check,
  add constraint profiles_goal_check check (goal in ('english', 'toefl'));

alter table public.profiles
  drop constraint if exists profiles_level_check,
  add constraint profiles_level_check check (level in ('A1', 'A2', 'B1', 'B2', 'C1'));

alter table public.tests
  drop constraint if exists tests_level_check,
  add constraint tests_level_check check (level in ('A1', 'A2', 'B1', 'B2', 'C1'));

grant update (goal) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Release note for 0.4.0
-- ---------------------------------------------------------------------------
insert into public.announcements (kind, title, body, version, accent, priority, published)
select
  'release_note',
  'danna 0.4.0',
  '- More than 70 lessons from A1 to C1: grammar, vocabulary, reading, listening, speaking and writing' || E'\n' ||
  '- A level test for each level, and a level check to find your starting point' || E'\n' ||
  '- A TOEFL warm-up track, optional, for practice in the style of the test' || E'\n' ||
  '- Setup asks for your goal: General English or the TOEFL warm-up' || E'\n' ||
  '- The coach works with DeepSeek again, and says why when a reply cannot be written' || E'\n' ||
  '- The coach message box and the Continue and Back buttons stay in place' || E'\n' ||
  '- Dropdowns, calendars and scrollbars in the app''s own style',
  '0.4.0',
  'blue',
  0,
  true
where not exists (select 1 from public.announcements where version = '0.4.0');
