-- =============================================================================
-- danna migration 0016: the 1.3.0 release note (What's new).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a note that is already there is brought up to date with this text. The same
-- change ends supabase/schema.sql for new projects. Run migration 0015 first.
-- =============================================================================

-- [release note]
do $$
declare
  note text :=
    '- Word-order lessons: drag the words into the right order, or tap them. A wrong order stays open, so you can move the words and check again' || E'\n' ||
    '- Links from Instagram, TikTok, X, Facebook, Threads, Reddit, Pinterest, Twitch, Dailymotion, Wikipedia, Medium, Quora and Deezer are recognised, with their logos' || E'\n' ||
    '- The coach names a new chat from your own first question, in your language. Chats keep the names they have' || E'\n' ||
    '- Coach messages can be selected and copied with the mouse or Ctrl+C. The Copy button works even when the clipboard refuses' || E'\n' ||
    '- Read aloud in the coach has the same look as Copy' || E'\n' ||
    '- Your exam can be paused while you are not planning to take it. Your name and date are kept, and you can plan it again any time' || E'\n' ||
    '- Friend requests and shares show on the friend icon while the app is open, and the count updates every minute' || E'\n' ||
    '- In My library, the drop area and the add-link form step aside while you search, and Ask the coach no longer moves the tabs';
begin
  if exists (select 1 from public.announcements where version = '1.3.0' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 1.3.0', body = note, accent = 'blue', published = true
    where version = '1.3.0' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 1.3.0', note, '1.3.0', 'blue', 0, true);
  end if;
end $$;
-- [/release note]
