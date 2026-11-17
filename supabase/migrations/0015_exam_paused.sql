-- =============================================================================
-- danna migration 0015: pausing the exam.
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a column that is there is left as it is. The same change ends supabase/schema.sql for new
-- projects. Run migration 0014 first.
-- =============================================================================

-- [exam paused]
-- The learner is not planning an exam for now. The exam's name and date are kept, and the app hides the exam until it is
-- planned again. Each person can change only their own profile, as before.
alter table public.profiles add column if not exists exam_paused boolean not null default false;

grant update (exam_paused) on public.profiles to authenticated;
-- [/exam paused]
