-- =============================================================================
-- danna migration 0008: the 0.8.0 release note (What's new).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a note that is already there is brought up to date with this text. The same
-- change ends supabase/schema.sql for new projects. Run migration 0007 first.
-- =============================================================================

-- [release note]
do $$
declare
  note text :=
    '- Your AI keys are saved to your account, sealed with your password. Add a key once, and every device you sign in to can use it' || E'\n' ||
    '- Chats and files open a page at a time, so hundreds of them stay quick and fit their screen' || E'\n' ||
    '- The topic badges in Self study take the colour of their card' || E'\n' ||
    '- The stars of each lesson on the roadmap sit beside it, clear of the path' || E'\n' ||
    '- The Close button is gone from the picture and banner windows. The X closes them' || E'\n' ||
    '- The picture and banner buttons have room between them';
begin
  if exists (select 1 from public.announcements where version = '0.8.0' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 0.8.0', body = note, accent = 'blue', published = true
    where version = '0.8.0' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 0.8.0', note, '0.8.0', 'blue', 0, true);
  end if;
end $$;
-- [/release note]
