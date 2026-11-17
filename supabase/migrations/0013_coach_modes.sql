-- =============================================================================
-- danna migration 0012: the coach's modes, and longer coach messages.
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: a column that is there is left as it is, and the limits are set again to the same values.
-- The same change ends supabase/schema.sql for new projects. Run migration 0011 first.
-- =============================================================================

-- [coach modes]
-- The mode a chat was started in, such as "writing". Chats from before modes have none, and keep working as free chats.
alter table public.tutor_chats add column if not exists mode text;

alter table public.tutor_chats
  drop constraint if exists tutor_chats_mode_format,
  add constraint tutor_chats_mode_format check (mode is null or mode ~ '^[a-z-]{1,40}$');
-- [/coach modes]

-- [longer messages]
-- A message of the coach may hold up to 24000 characters, so the feedback on a long text fits in one reply.
alter table public.tutor_messages
  drop constraint if exists tutor_messages_content_check,
  add constraint tutor_messages_content_check check (char_length(content) <= 24000);
-- [/longer messages]
