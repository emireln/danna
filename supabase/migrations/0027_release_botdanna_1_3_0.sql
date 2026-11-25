-- =============================================================================
-- danna migration 0027: the Botdanna 1.3.0 release note (What's new), and the title of the Botdanna 1.2.0 note.
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a note that is already there is brought up to date with this text. The same
-- change ends supabase/schema.sql for new projects. Run migration 0026 first.
-- The notes are matched by their title, because Danna's own notes use the same version numbers.
-- =============================================================================

-- The 1.2.0 note of Botdanna was saved with the Danna name in its title (migrations 0014 and 0026).
update public.announcements
set title = 'Botdanna 1.2.0'
where version = '1.2.0' and kind = 'release_note' and title = 'Danna 1.2.0';

-- [release note]
do $$
declare
  note text :=
    '- The Classic look has the pill design: the cards, buttons, tabs and tags have the same rounded corners as the Playful look.' || E'\n' ||
    '- The field of the coach has no square outline when you click in it. The rounded box around it shows that the field has focus.' || E'\n' ||
    '- While the coach writes a reply, the send button turns red, as a stop button.' || E'\n' ||
    '- The small labels above the page titles and the section headings are gone, so the screens read more quietly.';
begin
  if exists (select 1 from public.announcements where title = 'Botdanna 1.3.0' and kind = 'release_note') then
    update public.announcements
    set body = note, accent = 'blue', published = true
    where title = 'Botdanna 1.3.0' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'Botdanna 1.3.0', note, '1.3.0-botdanna', 'blue', 0, true);
  end if;
end $$;
-- [/release note]
