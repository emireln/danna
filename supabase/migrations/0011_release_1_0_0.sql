-- =============================================================================
-- danna migration 0011: the 1.0.0 release note (What's new), and the name of the exam.
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: the column is added only when it is missing, and a note that is already there is
-- brought up to date with this text. The same change ends supabase/schema.sql for new projects. Run migration 0010 first.
-- =============================================================================

-- [exam name]
-- The exam's name, as the learner writes it on the Exam page: up to 80 characters. Empty means no name yet.
alter table public.profiles add column if not exists exam_name text;

alter table public.profiles
  drop constraint if exists profiles_exam_name_length,
  add constraint profiles_exam_name_length check (exam_name is null or char_length(exam_name) <= 80);

grant update (exam_name) on public.profiles to authenticated;
-- [/exam name]

-- [release note]
do $$
declare
  note text :=
    '- Listening voices have a volume control in Settings, from silent to full' || E'\n' ||
    '- Your exam has its own page: its name, date and target score, the days left, and a test for each skill' || E'\n' ||
    '- Today links to your exam, in place of the countdown' || E'\n' ||
    '- Lessons and tests keep your answers when you leave them. Come back and carry on from the same question' || E'\n' ||
    '- The coach gives exercises with buttons and blanks to fill in. Check your answers and see your score' || E'\n' ||
    '- Under each coach answer: quick replies, a read-aloud button, and an explanation of your mistakes';
begin
  if exists (select 1 from public.announcements where version = '1.0.0' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 1.0.0', body = note, accent = 'blue', published = true
    where version = '1.0.0' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 1.0.0', note, '1.0.0', 'blue', 0, true);
  end if;
end $$;
-- [/release note]
