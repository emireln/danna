-- =============================================================================
-- danna migration 0005: coach chats, files in the coach, and the 0.6.0 release note.
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again. The same changes end supabase/schema.sql for new projects.
-- =============================================================================

-- Chats: each conversation with the coach has a name, can be archived, and belongs to one person.
create table if not exists public.tutor_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text check (title is null or char_length(title) <= 120),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tutor_chats_user_time on public.tutor_chats (user_id, updated_at);

-- Messages belong to a chat, and keep the names of the files that went with them (not the files).
alter table public.tutor_messages add column if not exists chat_id uuid references public.tutor_chats (id) on delete cascade;
alter table public.tutor_messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.tutor_messages drop constraint if exists tutor_messages_attachments_check;
alter table public.tutor_messages add constraint tutor_messages_attachments_check
  check (jsonb_typeof(attachments) = 'array' and octet_length(attachments::text) <= 4000);

create index if not exists tutor_messages_chat_time on public.tutor_messages (chat_id, created_at);

-- Messages from before chats move into one chat per person, so no conversation is lost.
with legacy as (
  select user_id, gen_random_uuid() as chat_id, min(created_at) as first_at, max(created_at) as last_at
  from public.tutor_messages
  where chat_id is null
  group by user_id
),
made as (
  insert into public.tutor_chats (id, user_id, title, created_at, updated_at)
  select chat_id, user_id, null, first_at, last_at from legacy
)
update public.tutor_messages m
set chat_id = legacy.chat_id
from legacy
where m.chat_id is null and m.user_id = legacy.user_id;

alter table public.tutor_chats enable row level security;

drop policy if exists "tutor_chats: owner" on public.tutor_chats;
create policy "tutor_chats: owner" on public.tutor_chats
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.tutor_chats to authenticated;

drop trigger if exists tutor_chats_quota on public.tutor_chats;
create trigger tutor_chats_quota before insert on public.tutor_chats
  for each row execute function public.enforce_quota('user_id', '500');

-- A new message moves its chat to the top of the chat list.
create or replace function public.touch_tutor_chat() returns trigger
language plpgsql as $$
begin
  update public.tutor_chats set updated_at = now() where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists tutor_messages_touch_chat on public.tutor_messages;
create trigger tutor_messages_touch_chat after insert on public.tutor_messages
  for each row when (new.chat_id is not null) execute function public.touch_tutor_chat();

-- The 0.6.0 release note (What's new). The same text is in the app, so the lines match in both languages.
insert into public.announcements (kind, title, body, version, accent, priority, published)
select
  'release_note',
  'danna 0.6.0',
  '- Coach chats: each conversation keeps its own history. Rename, archive or delete any chat' || E'\n' ||
  '- A new chat gets a short name, of four or five words, from your first question' || E'\n' ||
  '- Send up to 10 files to the coach at once: pictures, PDF, TXT and Markdown' || E'\n' ||
  '- Mention files from My library in a chat, and pick them by name' || E'\n' ||
  '- Search your chat history and your library' || E'\n' ||
  '- More reading, listening, writing and speaking practice in every unit, on both tracks' || E'\n' ||
  '- New mock tests: reading with listening, and writing with speaking, for each level and the TOEFL track' || E'\n' ||
  '- Practice sets you make with AI stay saved, on this device or in your account' || E'\n' ||
  '- The danna logo sits beside its name on the first screen',
  '0.6.0',
  'blue',
  0,
  true
where not exists (select 1 from public.announcements where version = '0.6.0');
