-- =============================================================================
-- danna migration 0006: profile banners, a friend's profile, and the 0.7.0 release note (What's new).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: every change checks what is already there, and a note that is already
-- there is brought up to date with this text. The same changes end supabase/schema.sql for new projects.
-- =============================================================================

-- [banner columns]
-- A profile banner is a wide WebP picture, kept at <user id>/banner.webp, like the profile picture.
alter table public.profiles add column if not exists banner_path text;
alter table public.profiles add column if not exists banner_updated_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_banner_owner,
  add constraint profiles_banner_owner check (banner_path is null or banner_path = (id::text || '/banner.webp')) not valid,
  drop constraint if exists profiles_banner_pair,
  add constraint profiles_banner_pair check ((banner_path is null) = (banner_updated_at is null)) not valid;

grant update (banner_path, banner_updated_at) on public.profiles to authenticated;
-- [/banner columns]

-- [banner function]
-- Banners are private: the owner, and the owner's friends, can download them.
create or replace function public.can_read_banner(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.banner_path = object_name
      and (p.id = auth.uid() or public.are_friends(p.id, auth.uid()))
  );
$$;

revoke all on function public.can_read_banner(text) from public, anon;
grant execute on function public.can_read_banner(text) to authenticated;
-- [/banner function]

-- [list-friends]
-- Requests and friends for the caller. XP and streak are shown only for accepted friends.
-- The banner's path and version let a friend's profile show the banner, as the picture is shown.
drop function if exists public.list_friends();
create function public.list_friends()
returns table (
  friendship_id uuid,
  status text,
  direction text,
  id uuid,
  username text,
  display_name text,
  avatar_color text,
  avatar_path text,
  avatar_updated_at timestamptz,
  xp int,
  streak int,
  created_at timestamptz,
  banner_path text,
  banner_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    f.id,
    f.status,
    case when f.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
    p.id,
    p.username,
    p.display_name,
    p.avatar_color,
    p.avatar_path,
    p.avatar_updated_at,
    case when f.status = 'accepted' then p.xp end,
    case when f.status = 'accepted' then p.streak end,
    f.created_at,
    p.banner_path,
    p.banner_updated_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() is not null
    and auth.uid() in (f.requester_id, f.addressee_id)
  order by f.created_at desc;
$$;

revoke all on function public.list_friends() from public, anon;
grant execute on function public.list_friends() to authenticated;
-- [/list-friends]

-- [banner storage]
-- A private bucket for banners: the owner uploads, replaces and removes their own, and the owner and friends download.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-banners', 'profile-banners', false, 491520, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile-banners: read own or friends" on storage.objects;
create policy "profile-banners: read own or friends" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-banners'
    and (name = ((select auth.uid())::text || '/banner.webp') or public.can_read_banner(name))
  );

drop policy if exists "profile-banners: upload own" on storage.objects;
create policy "profile-banners: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-banners' and name = ((select auth.uid())::text || '/banner.webp'));

drop policy if exists "profile-banners: replace own" on storage.objects;
create policy "profile-banners: replace own" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-banners' and name = ((select auth.uid())::text || '/banner.webp'))
  with check (bucket_id = 'profile-banners' and name = ((select auth.uid())::text || '/banner.webp'));

drop policy if exists "profile-banners: remove own" on storage.objects;
create policy "profile-banners: remove own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-banners' and name = ((select auth.uid())::text || '/banner.webp'));
-- [/banner storage]

-- [release note]
-- The 0.7.0 release note (What's new). The same lines are in the app, so they match in both languages.
do $$
declare
  note text := '- Search the whole app from the title bar, or with Ctrl+K: lessons, tests, chats, files, results and pages' || E'\n' ||
    '- Listening passages are read in a natural voice from your OpenAI or Google Gemini key. Choose the voice in Settings' || E'\n' ||
    '- Check for updates from Settings. The notifications button is gone from the title bar' || E'\n' ||
    '- Edit your TXT and Markdown files in My library, and save the changes' || E'\n' ||
    '- A PDF keeps its pages: its text is saved as a new Markdown file, with the PDF as it was' || E'\n' ||
    '- Find text in a file, like Notepad: Ctrl+F, then Enter for the next match' || E'\n' ||
    '- The coach offers other starter questions each time you start a chat, and its files take one line' || E'\n' ||
    '- The day streak sits beside your profile picture. It turns red above 200 days, blue above 500 and purple from 1000' || E'\n' ||
    '- Google Gemini keys in the new AQ. format are recognised' || E'\n' ||
    '- Search boxes have a clear button that matches the rest of the app' || E'\n' ||
    '- Your profile has a banner that covers the profile and the stat cards. The picture moves to the right, with an edit button' || E'\n' ||
    '- Friends can be opened to see their banner, picture, day streak and what they shared with you' || E'\n' ||
    '- The Listening, Writing and Speaking cards in Self study have new colours';
begin
  if exists (select 1 from public.announcements where version = '0.7.0' and kind = 'release_note') then
    update public.announcements
    set title = 'danna 0.7.0', body = note, accent = 'blue', published = true
    where version = '0.7.0' and kind = 'release_note';
  else
    insert into public.announcements (kind, title, body, version, accent, priority, published)
    values ('release_note', 'danna 0.7.0', note, '0.7.0', 'blue', 0, true);
  end if;
end $$;
-- [/release note]
