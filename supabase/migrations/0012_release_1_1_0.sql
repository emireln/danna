-- =============================================================================
-- danna migration 0012: the 1.1.0 release note (What's new).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a note that is already there is brought up to date with this text. The same
-- change ends supabase/schema.sql for new projects. Run migration 0011 first.
-- =============================================================================

-- [release note]
do $$
declare
  note text :=
    '- Pictures and banners show the new one at once, even when the old one was shown a moment ago' || E'\n' ||
    '- The send button of the coach stays blue when the message box is empty' || E'\n' ||
    '- Your AI keys reach your account: enter your password once on a device that has not opened it yet, and a sync problem is shown in Settings' || E'\n' ||
    '- New grammar lessons with explanations, from A2 to C1: pronouns, gerunds, infinitives, conditionals, participle clauses, question tags and more';
begin
  if exists (select 1 from public.announcements where version = '1.1.0' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 1.1.0', body = note, accent = 'blue', published = true
    where version = '1.1.0' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 1.1.0', note, '1.1.0', 'blue', 0, true);
  end if;
end $$;
-- [/release note]
