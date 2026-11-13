-- =============================================================================
-- danna migration 0004: the 0.5.0 release note (What's new).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again. The same section ends supabase/schema.sql for new projects.
-- =============================================================================

insert into public.announcements (kind, title, body, version, accent, priority, published)
select
  'release_note',
  'danna 0.5.0',
  '- Portuguese (PT-BR) for the whole app. Choose the language in Settings' || E'\n' ||
  '- Your day streak shows beside your picture, with a flame that grows at 10 and 50 days' || E'\n' ||
  '- A report a friend shares opens as their report, with their name on it' || E'\n' ||
  '- Profile pictures of your friends show up as soon as you are friends' || E'\n' ||
  '- danna checks for new versions and installs them in the background' || E'\n' ||
  '- The In use label in AI keys sits beside the key name',
  '0.5.0',
  'blue',
  0,
  true
where not exists (select 1 from public.announcements where version = '0.5.0');
