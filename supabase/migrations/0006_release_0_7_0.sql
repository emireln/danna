-- =============================================================================
-- danna migration 0006: the 0.7.0 release note (What's new).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again. The same note ends supabase/schema.sql for new projects.
-- There are no table changes: editing a library file uses the policies and the bucket that are already there.
-- =============================================================================

-- The 0.7.0 release note (What's new). The same text is in the app, so the lines match in both languages.
insert into public.announcements (kind, title, body, version, accent, priority, published)
select
  'release_note',
  'danna 0.7.0',
  '- Edit your TXT and Markdown files in My library, and save the changes' || E'\n' ||
  '- A PDF keeps its pages: its text is saved as a new Markdown file, with the PDF as it was' || E'\n' ||
  '- Find text in a file, like Notepad: Ctrl+F, then Enter for the next match' || E'\n' ||
  '- The day streak sits beside your profile picture' || E'\n' ||
  '- The coach offers other starter questions each time you start a chat' || E'\n' ||
  '- Google Gemini keys in the new AQ. format are recognised' || E'\n' ||
  '- The files the coach reads take one line, so the chat has more room',
  '0.7.0',
  'blue',
  0,
  true
where not exists (select 1 from public.announcements where version = '0.7.0');
