-- =============================================================================
-- danna migration 0024: the 2.1.0 release notes (What's new).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a note that is already there is brought up to date with this text. The same
-- change ends supabase/schema.sql for new projects. Run migrations 0020 to 0023 first, in that order.
-- The bullets are the same words as src/content/announcements.ts, so the app and the cloud show the same note.
-- =============================================================================

-- [release note 2.1.0]
do $$
declare
  note text :=
    '- Reminders: switch them on in Settings. danna can remind you about your streak, today’s goal, cards due for review, an exam that is close, or a longer break. They arrive only while danna is in the background, from the time you choose, and at most one a day.' || E'\n' ||
    '- Sounds: a right and a wrong answer, a finished lesson, a coach reply and a reminder each have a short, soft tone. Switch each one off in Settings, set the volume, or listen to it first.' || E'\n' ||
    '- Smoother sections: a section fades in without a blank moment, and going back to one shows what it showed before. The roadmap nodes fade in instead of jumping in one by one.' || E'\n' ||
    '- Buttons: every button has the same soft hover and press. The roadmap nodes no longer flicker when the pointer moves over them.' || E'\n' ||
    '- A new accent colour: purple, in both looks, on the buttons and tabs, the progress bars, the focus rings and the installer’s side banner.' || E'\n' ||
    '- A new app icon: the window, the taskbar, the installer and the tray now show it.' || E'\n' ||
    '- Fixes: the badges on the Self study cards no longer cover the progress bars, the eye in the key field is centred, the About rows have room between them, and the picture side of the banners blends into the colour.';
begin
  if exists (select 1 from public.announcements where version = '2.1.0' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 2.1.0', body = note, accent = 'blue', published = true
    where version = '2.1.0' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 2.1.0', note, '2.1.0', 'blue', 0, true);
  end if;
end $$;
-- [/release note]
