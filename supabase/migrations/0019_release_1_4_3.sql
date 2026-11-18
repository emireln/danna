-- =============================================================================
-- danna migration 0019: the 1.4.1, 1.4.2 and 1.4.3 release notes (What's new).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a note that is already there is brought up to date with this text. The same
-- change ends supabase/schema.sql for new projects. Run migration 0018 first.
-- =============================================================================

-- [release note 1.4.1]
do $$
declare
  note text :=
    '- Profile: no blue line round your picture, in the profile and the title bar';
begin
  if exists (select 1 from public.announcements where version = '1.4.1' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 1.4.1', body = note, accent = 'blue', published = true
    where version = '1.4.1' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 1.4.1', note, '1.4.1', 'blue', 0, true);
  end if;
end $$;
-- [/release note]

-- [release note 1.4.2]
do $$
declare
  note text :=
    '- Today: the Roadmap button takes the place of Your next step';
begin
  if exists (select 1 from public.announcements where version = '1.4.2' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 1.4.2', body = note, accent = 'blue', published = true
    where version = '1.4.2' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 1.4.2', note, '1.4.2', 'blue', 0, true);
  end if;
end $$;
-- [/release note]

-- [release note 1.4.3]
do $$
declare
  note text :=
    '- My report: the same score report as the level check, with your advice, skill profile, skills to improve and study plan' || E'\n' ||
    '- Today: the level report sits beside your exam card, and its arrow is gone. The X still removes it from Today for good';
begin
  if exists (select 1 from public.announcements where version = '1.4.3' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 1.4.3', body = note, accent = 'blue', published = true
    where version = '1.4.3' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 1.4.3', note, '1.4.3', 'blue', 0, true);
  end if;
end $$;
-- [/release note]
