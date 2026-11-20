-- =============================================================================
-- danna migration 0020: the v2 look, and the XP each run earned (for the weekly league).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a column is added only when it is missing, and the check is replaced by the same one.
-- The same change ends supabase/schema.sql for new projects. Run migration 0019 first.
-- =============================================================================

-- The look chosen in Settings: 'classic' (the current look) or 'playful' (the friendly look with 3D buttons).
alter table public.profiles
  add column if not exists ui_style text not null default 'classic';

alter table public.profiles
  drop constraint if exists profiles_ui_style_check,
  add constraint profiles_ui_style_check check (ui_style in ('classic', 'playful'));

-- The account owner changes their own look, like the other settings.
grant update (ui_style) on public.profiles to authenticated;

-- The XP each run earned. The weekly league adds these up. Runs saved before 2.0.0 keep 0.
alter table public.attempts
  add column if not exists xp int not null default 0;

alter table public.attempts
  drop constraint if exists attempts_xp_range,
  add constraint attempts_xp_range check (xp between 0 and 100000);
