-- =============================================================================
-- danna migration 0002: My library (learning files and links) and the 0.3.0 release note.
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again. The same section ends supabase/schema.sql for new projects.
--
-- Security
--  * Each row belongs to one person, and only that person can read or change it.
--  * Library files are private. They live in the "library" bucket, in the owner's own folder,
--    and nobody else can download them (friends included).
--  * Links must be https. Text, names and counts are limited.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.library_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  kind text not null,
  mime_type text not null,
  size_bytes integer not null,
  storage_path text not null,
  extracted_text text not null default '',
  pages integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.library_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  url text not null,
  title text not null default '',
  platform text not null default 'other',
  category text not null default 'General',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists library_files_user_recent on public.library_files (user_id, created_at desc);
create index if not exists library_links_user_recent on public.library_links (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Limits and formats. NOT VALID: they apply to every new or changed row.
-- ---------------------------------------------------------------------------
alter table public.library_files
  drop constraint if exists library_files_name_length,
  add constraint library_files_name_length check (char_length(name) between 1 and 200) not valid,
  drop constraint if exists library_files_kind,
  add constraint library_files_kind check (kind in ('pdf', 'txt', 'md')) not valid,
  drop constraint if exists library_files_size,
  add constraint library_files_size check (size_bytes between 0 and 20971520) not valid,
  drop constraint if exists library_files_text_size,
  add constraint library_files_text_size check (char_length(extracted_text) <= 400000) not valid,
  drop constraint if exists library_files_pages,
  add constraint library_files_pages check (pages is null or pages between 0 and 5000) not valid,
  drop constraint if exists library_files_owner_folder,
  add constraint library_files_owner_folder check (split_part(storage_path, '/', 1) = user_id::text) not valid;

alter table public.library_links
  drop constraint if exists library_links_url_format,
  add constraint library_links_url_format check (url ~ '^https://[^[:space:]]+$' and char_length(url) <= 2000) not valid,
  drop constraint if exists library_links_title_length,
  add constraint library_links_title_length check (char_length(title) <= 200) not valid,
  drop constraint if exists library_links_platform_length,
  add constraint library_links_platform_length check (char_length(platform) between 1 and 40) not valid,
  drop constraint if exists library_links_category_length,
  add constraint library_links_category_length check (char_length(category) between 1 and 40) not valid,
  drop constraint if exists library_links_note_length,
  add constraint library_links_note_length check (char_length(note) <= 500) not valid;

-- ---------------------------------------------------------------------------
-- 3. Triggers: updated_at, and a cap per person (300 files, 2000 links)
-- ---------------------------------------------------------------------------
drop trigger if exists library_files_touch on public.library_files;
create trigger library_files_touch before update on public.library_files
  for each row execute function public.touch_updated_at();

drop trigger if exists library_files_quota on public.library_files;
create trigger library_files_quota before insert on public.library_files
  for each row execute function public.enforce_quota('user_id', '300');

drop trigger if exists library_links_touch on public.library_links;
create trigger library_links_touch before update on public.library_links
  for each row execute function public.touch_updated_at();

drop trigger if exists library_links_quota on public.library_links;
create trigger library_links_quota before insert on public.library_links
  for each row execute function public.enforce_quota('user_id', '2000');

-- ---------------------------------------------------------------------------
-- 4. Row-level security and privileges
-- ---------------------------------------------------------------------------
alter table public.library_files enable row level security;
alter table public.library_links enable row level security;

drop policy if exists "library_files: owner" on public.library_files;
create policy "library_files: owner" on public.library_files
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "library_links: owner" on public.library_links;
create policy "library_links: owner" on public.library_links
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.library_files, public.library_links from anon;
grant select, insert, update, delete on public.library_files, public.library_links to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Storage: a private bucket with one folder per person
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library', 'library', false, 20971520, array['application/pdf', 'text/plain', 'text/markdown'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "library: read own files" on storage.objects;
create policy "library: read own files" on storage.objects
  for select to authenticated
  using (bucket_id = 'library' and split_part(name, '/', 1) = (select auth.uid())::text);

drop policy if exists "library: upload own files" on storage.objects;
create policy "library: upload own files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'library' and split_part(name, '/', 1) = (select auth.uid())::text);

drop policy if exists "library: replace own files" on storage.objects;
create policy "library: replace own files" on storage.objects
  for update to authenticated
  using (bucket_id = 'library' and split_part(name, '/', 1) = (select auth.uid())::text)
  with check (bucket_id = 'library' and split_part(name, '/', 1) = (select auth.uid())::text);

drop policy if exists "library: remove own files" on storage.objects;
create policy "library: remove own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'library' and split_part(name, '/', 1) = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- 6. Release note for 0.3.0
-- ---------------------------------------------------------------------------
insert into public.announcements (kind, title, body, version, accent, priority, published)
select
  'release_note',
  'danna 0.3.0',
  '- My library: keep PDF, TXT and Markdown files, and read them in the app' || E'\n' ||
  '- Ask the tutor about the files you choose' || E'\n' ||
  '- Save learning links, with the platform logo and a category' || E'\n' ||
  '- DeepSeek joins OpenAI, Anthropic, Gemini and OpenRouter' || E'\n' ||
  '- A new installer look',
  '0.3.0',
  'blue',
  0,
  true
where not exists (select 1 from public.announcements where version = '0.3.0');
