-- =============================================================================
-- danna migration 0023: the 2.0.0 release notes (What's new).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a note that is already there is brought up to date with this text. The same
-- change ends supabase/schema.sql for new projects. Run migrations 0020, 0021 and 0022 first, in that order.
-- The bullets are the same words as src/content/announcements.ts, so the app and the cloud show the same note.
-- =============================================================================

-- [release note 2.0.0]
do $$
declare
  note text :=
    '- Two looks: Classic, the one you know, and Playful, with chunky 3D buttons, bright colours and a friendlier feel. Choose one in Settings. The choice is saved to your account, or to this device without one.' || E'\n' ||
    '- Decks and flashcards: make decks, add cards or import a list, and study with spaced repetition. Again, Hard, Good and Easy set the next interval, and each button shows its interval first.' || E'\n' ||
    '- Writing check: write up to 1500 words and get a score, a tone and the fixes, each with its reason. With an AI key a model checks the text. Without one, the basics are checked on this device.' || E'\n' ||
    '- Tap to define: in a text or Markdown file, tap a word to see its meaning and the sentence it came from. Save it to Saved words.' || E'\n' ||
    '- Role-play scenes: twelve scenes in the coach, such as ordering at a café or a job interview. Finish and score gives your fluency, the main mistakes and the new words.' || E'\n' ||
    '- Today and your profile: a daily goal, quests, a weekly league with your friends, and ten achievements. The league with friends needs an online account.' || E'\n' ||
    '- XP: practice earns XP. It counts toward your league week from 2.0.0 on, and the XP you earned before stays in your total.' || E'\n' ||
    '- Beta: this release carries a Beta badge in the title bar while the new look and features settle. Tell us what you find.';
begin
  if exists (select 1 from public.announcements where version = '2.0.0' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 2.0.0', body = note, accent = 'blue', published = true
    where version = '2.0.0' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 2.0.0', note, '2.0.0', 'blue', 0, true);
  end if;
end $$;
-- [/release note]
