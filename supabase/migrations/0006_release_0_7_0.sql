-- =============================================================================
-- danna migration 0006: the 0.7.0 release note (What's new).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a note that is already there is brought up to date with this text.
-- The same note ends supabase/schema.sql for new projects. There are no table changes.
-- =============================================================================

-- The 0.7.0 release note (What's new). The same lines are in the app, so they match in both languages.
do $$
declare
  note text := '- Search the whole app from the title bar, or with Ctrl+K: lessons, tests, chats, files, results and pages' || E'\n' ||
    '- Listening passages are read in a natural voice from your OpenAI or Google Gemini key. Choose the voice in Settings' || E'\n' ||
    '- Check for updates from Settings. The notifications button is gone from the title bar' || E'\n' ||
    '- Edit your TXT and Markdown files in My library, and save the changes' || E'\n' ||
    '- A PDF keeps its pages: its text is saved as a new Markdown file, with the PDF as it was' || E'\n' ||
    '- Find text in a file, like Notepad: Ctrl+F, then Enter for the next match' || E'\n' ||
    '- The coach offers other starter questions each time you start a chat, and its files take one line' || E'\n' ||
    '- The day streak sits beside your profile picture' || E'\n' ||
    '- Google Gemini keys in the new AQ. format are recognised' || E'\n' ||
    '- Search boxes have a clear button that matches the rest of the app';
begin
  if exists (select 1 from public.announcements where version = '0.7.0' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 0.7.0', body = note, accent = 'blue', published = true
    where version = '0.7.0' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 0.7.0', note, '0.7.0', 'blue', 0, true);
  end if;
end $$;
