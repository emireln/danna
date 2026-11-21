-- =============================================================================
-- danna migration 0025: the 2.2.0 release notes (What's new).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a note that is already there is brought up to date with this text. The same
-- change ends supabase/schema.sql for new projects. Run migrations 0020 to 0024 first, in that order.
-- The bullets are the same words as src/content/announcements.ts, so the app and the cloud show the same note.
-- =============================================================================

-- [release note 2.2.0]
do $$
declare
  note text :=
    '- Built-in voices: danna reads with seven voices made on your computer: Heart, Bella, Nicole, Sarah, Michael, Emma and George. They work offline, with no key and no internet.' || E'\n' ||
    '- Voices on this PC: danna finds the voices installed on your computer, the natural Windows voices too, and lists them in Settings. Listen to each one before you choose it.' || E'\n' ||
    '- Automatic: a cloud voice when you have an AI key, otherwise the built-in voice. The robotic Windows voice is no longer used to read aloud.' || E'\n' ||
    '- Faster start: a reading plays its first words while the rest is still being made.' || E'\n' ||
    '- The V2 BETA badge is gone from the title bar and from the website.' || E'\n' ||
    '- Sheets: each sheet opens between the title bar and the bottom tabs, so neither covers it on a small window.' || E'\n' ||
    '- Fixes: the send arrow of the coach shows in both looks, the streak takes the place of the XP badge in the title bar, the review says “In 10 min” for a question due soon, and a word saved to review says when it comes back.';
begin
  if exists (select 1 from public.announcements where version = '2.2.0' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 2.2.0', body = note, accent = 'blue', published = true
    where version = '2.2.0' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 2.2.0', note, '2.2.0', 'blue', 0, true);
  end if;
end $$;
-- [/release note]
