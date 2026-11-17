-- =============================================================================
-- danna migration 0014: the 1.2.0 release note (What's new).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a note that is already there is brought up to date with this text. The same
-- change ends supabase/schema.sql for new projects. Run migration 0013 first.
-- =============================================================================

-- [release note]
do $$
declare
  note text :=
    '- Replies stream in as the coach writes them. Stop one with its button or Esc, write it again, edit your last question, or continue a reply that ran out of room' || E'\n' ||
    '- Nine modes on the start screen of the coach, such as Conversation practice, Fix my writing, Speaking practice, Exam practice and Vocabulary builder. A chat keeps the mode it started in' || E'\n' ||
    '- The coach knows your level, goal, exam date, skill scores and recent mistakes. No name or account details are sent' || E'\n' ||
    '- Cards in the replies: feedback on your text with scores, corrections and a model version of it, vocabulary cards that save to your review, and buttons that open practice in the app' || E'\n' ||
    '- Speak to the coach with the microphone (needs an OpenAI key). Read replies aloud, and save a chat as a Markdown file' || E'\n' ||
    '- A wider coach for laptops: a slimmer header, larger text and a bigger message box' || E'\n' ||
    '- Longer coach replies, up to 24,000 characters, so the feedback on a long text fits in one reply';
begin
  if exists (select 1 from public.announcements where version = '1.2.0' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 1.2.0', body = note, accent = 'blue', published = true
    where version = '1.2.0' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 1.2.0', note, '1.2.0', 'blue', 0, true);
  end if;
end $$;
-- [/release note]
