-- =============================================================================
-- danna migration 0018: the 1.4.0 release note (What's new).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a note that is already there is brought up to date with this text. The same
-- change ends supabase/schema.sql for new projects. Run migration 0017 first.
-- =============================================================================

-- [release note]
do $$
declare
  note text :=
    '- Feedback: one message an hour. If you try again sooner, danna tells you how long to wait' || E'\n' ||
    '- Today: a finished learning setup leaves the screen, and the level report can be removed from Today for good' || E'\n' ||
    '- My report in the profile: your strengths, your weaknesses and your progress across the app. Save it as an image, with your name on it' || E'\n' ||
    '- Share: a search bar finds your friends, results and sets, and the friends you shared with most recently come first. Share with a friend names that friend, with no Send to list' || E'\n' ||
    '- The Buy me a coffee button is yellow, with dark text' || E'\n' ||
    '- Updates: danna tells you when a newer version is ready. Click the update button in the title bar to download it, then click Restart to update';
begin
  if exists (select 1 from public.announcements where version = '1.4.0' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 1.4.0', body = note, accent = 'blue', published = true
    where version = '1.4.0' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 1.4.0', note, '1.4.0', 'blue', 0, true);
  end if;
end $$;
-- [/release note]
