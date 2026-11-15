-- =============================================================================
-- danna migration 0010: the 0.9.0 release note (What's new).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a note that is already there is brought up to date with this text. The same
-- change ends supabase/schema.sql for new projects. Run migration 0009 first.
-- =============================================================================

-- [release note]
do $$
declare
  note text :=
    '- The progress bar on the roadmap sits beside the level badge, in the space that was empty' || E'\n' ||
    '- Self study sections and pages open smoothly: no stutter, and every page starts at its top' || E'\n' ||
    '- Buy me a coffee: find it at the bottom of the profile menu, and under About in Settings' || E'\n' ||
    '- Rate danna from 1 to 5 stars, with an optional comment, in Settings. Online accounts send it to the developer';
begin
  if exists (select 1 from public.announcements where version = '0.9.0' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 0.9.0', body = note, accent = 'blue', published = true
    where version = '0.9.0' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 0.9.0', note, '0.9.0', 'blue', 0, true);
  end if;
end $$;
-- [/release note]
