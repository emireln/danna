-- =============================================================================
-- danna database for Supabase (PostgreSQL), version 2.
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- It is safe to run again. Tables, columns, constraints, policies, functions and
-- grants are created or replaced to match this version, and existing rows are kept.
--
-- Security model
--  * Row-level security is on for every table. A person reads and changes only their
--    own rows. A result or set shared with a friend is readable by that friend, and
--    only while the two are still friends.
--  * Clients get only the privileges the app needs. Column-level grants stop anyone
--    from changing their own id, re-pointing a received share at other data, or
--    accepting a friend request on someone else's behalf.
--  * XP never goes down. Text, JSON and pictures have size and format limits, and each
--    person has a cap on how many rows they can create in the main tables.
--  * Functions use an empty search_path with fully qualified names, and only signed-in
--    users can run them. Profile pictures are private: friends can view them, nobody else.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables. The inline checks are the original version-1 rules.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '',
  avatar_color text not null default '#2f6bff' check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  target_score int not null default 100 check (target_score between 60 and 120),
  exam_date date,
  daily_minutes int not null default 15 check (daily_minutes between 5 and 180),
  level text not null default 'B1' check (level in ('A2', 'B1', 'B2', 'C1')),
  xp int not null default 0 check (xp >= 0),
  streak int not null default 0 check (streak >= 0),
  last_active date,
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('diagnostic', 'lesson', 'checkpoint', 'mock', 'practice', 'review')),
  ref_id text not null default '',
  title text not null,
  score_pct int not null check (score_pct between 0 and 100),
  predicted int check (predicted between 0 and 120),
  skills jsonb not null default '{}'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  duration_s int not null default 0 check (duration_s >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 300),
  kind text not null default 'ai' check (kind in ('ai', 'custom')),
  skill text not null default 'mixed' check (skill in ('reading', 'listening', 'speaking', 'writing', 'language', 'mixed')),
  level text not null default 'B1' check (level in ('A2', 'B1', 'B2', 'C1')),
  minutes int not null default 10 check (minutes between 1 and 240),
  content jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('result', 'test')),
  attempt_id uuid references public.attempts (id) on delete cascade,
  test_id uuid references public.tests (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 280),
  seen boolean not null default false,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  check (
    (kind = 'result' and attempt_id is not null and test_id is null)
    or (kind = 'test' and test_id is not null and attempt_id is null)
  )
);

create table if not exists public.skill_scores (
  user_id uuid not null references public.profiles (id) on delete cascade,
  skill text not null check (skill in ('reading', 'listening', 'speaking', 'writing', 'language')),
  score int not null check (score between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill)
);

create table if not exists public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) <= 40),
  stars int not null default 0 check (stars between 0 and 3),
  best_pct int not null default 0 check (best_pct between 0 and 100),
  attempts int not null default 0 check (attempts >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.review_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_key text not null check (char_length(item_key) <= 120),
  skill text not null check (skill in ('reading', 'listening', 'speaking', 'writing', 'language')),
  payload jsonb not null,
  ease numeric(4, 2) not null default 2.5,
  interval_days int not null default 0 check (interval_days >= 0),
  reps int not null default 0 check (reps >= 0),
  due_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

create table if not exists public.tutor_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text check (title is null or char_length(title) <= 120),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  chat_id uuid references public.tutor_chats (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array' and octet_length(attachments::text) <= 4000),
  created_at timestamptz not null default now()
);

-- Databases from before the coach chats gain the new columns, and their messages move into one chat per person.
alter table public.tutor_messages add column if not exists chat_id uuid references public.tutor_chats (id) on delete cascade;
alter table public.tutor_messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.tutor_messages drop constraint if exists tutor_messages_attachments_check;
alter table public.tutor_messages add constraint tutor_messages_attachments_check
  check (jsonb_typeof(attachments) = 'array' and octet_length(attachments::text) <= 4000);

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

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('banner', 'release_note', 'news')),
  title text not null,
  body text not null default '',
  version text,
  image_url text,
  cta_label text,
  cta_url text,
  accent text not null default 'blue' check (accent in ('blue', 'teal', 'amber', 'ink')),
  priority int not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

-- Columns added after version 1.
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists avatar_updated_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Limits and format rules. Added as NOT VALID: they apply to every new or
--    changed row, and do not block the upgrade if an old row would break them.
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_display_name_length,
  add constraint profiles_display_name_length check (char_length(display_name) <= 40) not valid,
  drop constraint if exists profiles_streak_range,
  add constraint profiles_streak_range check (streak between 0 and 36500) not valid,
  drop constraint if exists profiles_avatar_owner,
  add constraint profiles_avatar_owner check (avatar_path is null or avatar_path = (id::text || '/avatar.webp')) not valid,
  drop constraint if exists profiles_avatar_pair,
  add constraint profiles_avatar_pair check ((avatar_path is null) = (avatar_updated_at is null)) not valid;

alter table public.attempts
  drop constraint if exists attempts_title_length,
  add constraint attempts_title_length check (char_length(title) between 1 and 200) not valid,
  drop constraint if exists attempts_ref_length,
  add constraint attempts_ref_length check (char_length(ref_id) <= 120) not valid,
  drop constraint if exists attempts_skills_size,
  add constraint attempts_skills_size check (octet_length(skills::text) <= 4096) not valid,
  drop constraint if exists attempts_answers_size,
  add constraint attempts_answers_size check (octet_length(answers::text) <= 262144) not valid;

alter table public.tests
  drop constraint if exists tests_content_size,
  add constraint tests_content_size check (octet_length(content::text) <= 262144) not valid,
  drop constraint if exists tests_content_shape,
  add constraint tests_content_shape check (jsonb_typeof(content) = 'object') not valid;

alter table public.review_items
  drop constraint if exists review_items_payload_size,
  add constraint review_items_payload_size check (octet_length(payload::text) <= 65536) not valid;

alter table public.announcements
  drop constraint if exists announcements_title_length,
  add constraint announcements_title_length check (char_length(title) between 1 and 200) not valid,
  drop constraint if exists announcements_body_length,
  add constraint announcements_body_length check (char_length(body) <= 8000) not valid,
  drop constraint if exists announcements_cta_label_length,
  add constraint announcements_cta_label_length check (cta_label is null or char_length(cta_label) <= 60) not valid,
  drop constraint if exists announcements_cta_url_format,
  add constraint announcements_cta_url_format
    check (cta_url is null or cta_url ~ '^(/[^/[:space:]][^[:space:]]*|https://[^[:space:]]+)$') not valid,
  drop constraint if exists announcements_image_https,
  add constraint announcements_image_https check (image_url is null or image_url ~ '^https://[^[:space:]]+$') not valid;

-- ---------------------------------------------------------------------------
-- 3. Indexes for the lookups that row-level security and the app run often.
-- ---------------------------------------------------------------------------
create unique index if not exists friendships_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_requester on public.friendships (requester_id);
create index if not exists friendships_addressee on public.friendships (addressee_id);
create index if not exists attempts_user_recent on public.attempts (user_id, created_at desc);
create index if not exists tests_owner_recent on public.tests (owner_id, created_at desc);
create index if not exists shares_recipient_recent on public.shares (recipient_id, created_at desc);
create index if not exists shares_sender_recent on public.shares (sender_id, created_at desc);
create index if not exists shares_attempt on public.shares (attempt_id);
create index if not exists shares_test on public.shares (test_id);
create index if not exists review_items_due on public.review_items (user_id, due_at);
create index if not exists tutor_messages_user_time on public.tutor_messages (user_id, created_at);
create index if not exists tutor_messages_chat_time on public.tutor_messages (chat_id, created_at);
create index if not exists tutor_chats_user_time on public.tutor_chats (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- 4. Functions used by triggers, policies and the app.
-- ---------------------------------------------------------------------------

-- A new account gets a profile. The username is cleaned up, and a free one is chosen if needed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
begin
  -- Lower-case first, then drop everything else. The other order would delete capitals before they are lower-cased.
  base := left(regexp_replace(
    lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1), '')),
    '[^a-z0-9_]', '', 'g'), 14);
  if char_length(base) < 3 then
    base := 'learner';
  end if;

  candidate := base;
  while exists (select 1 from public.profiles p where p.username = candidate) loop
    candidate := base || '_' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), candidate), 40)
  );
  return new;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Identity and progress guard: id and created_at never change, and XP never goes down.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  if new.xp < old.xp then
    new.xp := old.xp;
  end if;
  return new;
end;
$$;

-- Caps how many rows one person can insert into a table. Argument 1 is the owner column,
-- argument 2 is the maximum. Runs as the owner so the count is complete.
create or replace function public.enforce_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_column text;
  max_rows bigint;
  owner_id uuid;
  total bigint;
begin
  owner_column := tg_argv[0];
  max_rows := tg_argv[1]::bigint;
  owner_id := (to_jsonb(new) ->> owner_column)::uuid;

  execute format('select count(*) from %I.%I where %I = $1', tg_table_schema, tg_table_name, owner_column)
    into total
    using owner_id;

  if total >= max_rows then
    raise exception 'This account has reached the limit for this.' using errcode = '54000';
  end if;
  return new;
end;
$$;

-- True when two people are accepted friends. Runs as the owner so policies can use it without recursion.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- Profile pictures are private: the owner, and friends of the owner, can download them.
create or replace function public.can_read_avatar(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.avatar_path = object_name
      and (p.id = auth.uid() or public.are_friends(p.id, auth.uid()))
  );
$$;

-- Ownership checks used when sharing. They run as the owner, so a share policy never has to
-- read attempts or tests under their own row-level rules (that would loop back into shares).
create or replace function public.owns_attempt(item uuid, person uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.attempts a where a.id = item and a.user_id = person);
$$;

create or replace function public.owns_test(item uuid, person uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tests t where t.id = item and t.owner_id = person);
$$;

-- ---------------------------------------------------------------------------
-- 5. Triggers.
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

drop trigger if exists attempts_quota on public.attempts;
create trigger attempts_quota before insert on public.attempts
  for each row execute function public.enforce_quota('user_id', '5000');

drop trigger if exists tests_quota on public.tests;
create trigger tests_quota before insert on public.tests
  for each row execute function public.enforce_quota('owner_id', '500');

drop trigger if exists tutor_messages_quota on public.tutor_messages;
create trigger tutor_messages_quota before insert on public.tutor_messages
  for each row execute function public.enforce_quota('user_id', '5000');

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

drop trigger if exists shares_quota on public.shares;
create trigger shares_quota before insert on public.shares
  for each row execute function public.enforce_quota('sender_id', '2000');

drop trigger if exists friendships_quota on public.friendships;
create trigger friendships_quota before insert on public.friendships
  for each row execute function public.enforce_quota('requester_id', '300');

-- ---------------------------------------------------------------------------
-- 6. Row-level security: every table is locked, then opened only to its owner.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.attempts enable row level security;
alter table public.tests enable row level security;
alter table public.shares enable row level security;
alter table public.skill_scores enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.review_items enable row level security;
alter table public.tutor_messages enable row level security;
alter table public.tutor_chats enable row level security;
alter table public.announcements enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "friendships: read own" on public.friendships;
create policy "friendships: read own" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

drop policy if exists "friendships: send request" on public.friendships;
create policy "friendships: send request" on public.friendships
  for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');

drop policy if exists "friendships: accept" on public.friendships;
create policy "friendships: accept" on public.friendships
  for update to authenticated
  using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (addressee_id = (select auth.uid()) and status = 'accepted');

drop policy if exists "friendships: remove" on public.friendships;
create policy "friendships: remove" on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- Version 1 had two sharing policies with other names. Remove them, or their old rule stays in force.
drop policy if exists "attempts: shared with me" on public.attempts;
drop policy if exists "tests: shared with me" on public.tests;

drop policy if exists "attempts: owner" on public.attempts;
create policy "attempts: owner" on public.attempts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "attempts: shared with friend" on public.attempts;
create policy "attempts: shared with friend" on public.attempts
  for select to authenticated
  using (exists (
    select 1
    from public.shares s
    where s.attempt_id = attempts.id
      and s.recipient_id = (select auth.uid())
      and public.are_friends(s.sender_id, s.recipient_id)
  ));

drop policy if exists "tests: owner" on public.tests;
create policy "tests: owner" on public.tests
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "tests: shared with friend" on public.tests;
create policy "tests: shared with friend" on public.tests
  for select to authenticated
  using (exists (
    select 1
    from public.shares s
    where s.test_id = tests.id
      and s.recipient_id = (select auth.uid())
      and public.are_friends(s.sender_id, s.recipient_id)
  ));

drop policy if exists "shares: read own" on public.shares;
create policy "shares: read own" on public.shares
  for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id) and public.are_friends(sender_id, recipient_id));

drop policy if exists "shares: send to friends" on public.shares;
create policy "shares: send to friends" on public.shares
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.are_friends(sender_id, recipient_id)
    and (attempt_id is null or public.owns_attempt(attempt_id, (select auth.uid())))
    and (test_id is null or public.owns_test(test_id, (select auth.uid())))
  );

drop policy if exists "shares: recipient marks seen" on public.shares;
create policy "shares: recipient marks seen" on public.shares
  for update to authenticated
  using (recipient_id = (select auth.uid()) and public.are_friends(sender_id, recipient_id))
  with check (recipient_id = (select auth.uid()));

drop policy if exists "shares: sender removes" on public.shares;
create policy "shares: sender removes" on public.shares
  for delete to authenticated
  using (sender_id = (select auth.uid()));

drop policy if exists "skill_scores: owner" on public.skill_scores;
create policy "skill_scores: owner" on public.skill_scores
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "lesson_progress: owner" on public.lesson_progress;
create policy "lesson_progress: owner" on public.lesson_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "review_items: owner" on public.review_items;
create policy "review_items: owner" on public.review_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "tutor_messages: owner" on public.tutor_messages;
create policy "tutor_messages: owner" on public.tutor_messages
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "tutor_chats: owner" on public.tutor_chats;
create policy "tutor_chats: owner" on public.tutor_chats
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Banners and release notes are written in the dashboard. Signed-in users read published rows only.
drop policy if exists "announcements: read published" on public.announcements;
create policy "announcements: read published" on public.announcements
  for select to authenticated
  using (published and starts_at <= now() and (ends_at is null or ends_at > now()));

-- ---------------------------------------------------------------------------
-- 7. Privileges. Start from nothing, then grant only what the app uses.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- Remove earlier column-level grants on the tables where columns are granted one by one.
do $$
declare
  target record;
begin
  for target in
    select c.relname as table_name, a.attname as column_name
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('profiles', 'friendships', 'shares')
      and a.attnum > 0
      and not a.attisdropped
  loop
    execute format('revoke all (%I) on public.%I from authenticated', target.column_name, target.table_name);
  end loop;
end
$$;

grant select on public.profiles to authenticated;
grant update (
  username, display_name, avatar_color, target_score, exam_date, daily_minutes, level,
  xp, streak, last_active, onboarding_done, avatar_path, avatar_updated_at
) on public.profiles to authenticated;

grant select, insert on public.friendships to authenticated;
grant update (status, responded_at) on public.friendships to authenticated;
grant delete on public.friendships to authenticated;

grant select, insert, update, delete on public.attempts, public.tests, public.skill_scores,
  public.lesson_progress, public.review_items to authenticated;

grant select, insert, delete on public.tutor_messages to authenticated;
grant select, insert, update, delete on public.tutor_chats to authenticated;
grant select, insert, delete on public.shares to authenticated;
grant update (seen) on public.shares to authenticated;

grant select on public.announcements to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.guard_profile_update() from public, anon, authenticated;
revoke all on function public.enforce_quota() from public, anon, authenticated;
revoke all on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
revoke all on function public.can_read_avatar(text) from public, anon;
grant execute on function public.can_read_avatar(text) to authenticated;
revoke all on function public.owns_attempt(uuid, uuid) from public, anon;
grant execute on function public.owns_attempt(uuid, uuid) to authenticated;
revoke all on function public.owns_test(uuid, uuid) from public, anon;
grant execute on function public.owns_test(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Functions the app calls. Each returns only the columns its screen needs.
-- ---------------------------------------------------------------------------

-- Find people by username (at least three letters). Signed-in users only; never returns the caller.
drop function if exists public.search_people(text);
create function public.search_people(q text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_color text,
  avatar_path text,
  avatar_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with term as (
    select regexp_replace(lower(coalesce(q, '')), '[^a-z0-9_]', '', 'g') as t
  )
  select p.id, p.username, p.display_name, p.avatar_color, p.avatar_path, p.avatar_updated_at
  from public.profiles p, term
  where auth.uid() is not null
    and p.id <> auth.uid()
    and char_length(term.t) >= 3
    and strpos(p.username, term.t) > 0
  order by p.username
  limit 10;
$$;

-- Requests and friends for the caller. XP and streak are shown only for accepted friends.
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
  created_at timestamptz
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
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() is not null
    and auth.uid() in (f.requester_id, f.addressee_id)
  order by f.created_at desc;
$$;

-- Shares sent or received. Shares end when the two people stop being friends.
create or replace function public.list_shares()
returns table (
  id uuid,
  direction text,
  kind text,
  note text,
  seen boolean,
  created_at timestamptz,
  other_id uuid,
  other_username text,
  other_display_name text,
  attempt_id uuid,
  test_id uuid,
  item_title text,
  item_score int,
  item_predicted int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    case when s.sender_id = auth.uid() then 'sent' else 'received' end,
    s.kind,
    s.note,
    s.seen,
    s.created_at,
    o.id,
    o.username,
    o.display_name,
    s.attempt_id,
    s.test_id,
    coalesce(t.title, a.title),
    a.score_pct,
    a.predicted
  from public.shares s
  join public.profiles o
    on o.id = case when s.sender_id = auth.uid() then s.recipient_id else s.sender_id end
  left join public.attempts a on a.id = s.attempt_id
  left join public.tests t on t.id = s.test_id
  where auth.uid() is not null
    and auth.uid() in (s.sender_id, s.recipient_id)
    and public.are_friends(s.sender_id, s.recipient_id)
  order by s.created_at desc
  limit 100;
$$;

revoke all on function public.search_people(text) from public, anon;
grant execute on function public.search_people(text) to authenticated;
revoke all on function public.list_friends() from public, anon;
grant execute on function public.list_friends() to authenticated;
revoke all on function public.list_shares() from public, anon;
grant execute on function public.list_shares() to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Storage. Banners are public (read by URL, uploaded in the dashboard).
--    Profile pictures are private and kept at <user id>/avatar.webp.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('banners', 'banners', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 307200, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: read own or friends" on storage.objects;
create policy "avatars: read own or friends" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (name = ((select auth.uid())::text || '/avatar.webp') or public.can_read_avatar(name))
  );

drop policy if exists "avatars: upload own" on storage.objects;
create policy "avatars: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name = ((select auth.uid())::text || '/avatar.webp'));

drop policy if exists "avatars: replace own" on storage.objects;
create policy "avatars: replace own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and name = ((select auth.uid())::text || '/avatar.webp'))
  with check (bucket_id = 'avatars' and name = ((select auth.uid())::text || '/avatar.webp'));

drop policy if exists "avatars: remove own" on storage.objects;
create policy "avatars: remove own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and name = ((select auth.uid())::text || '/avatar.webp'));

-- ---------------------------------------------------------------------------
-- 10. Seed content: release notes for the versions already shipped.
-- ---------------------------------------------------------------------------
insert into public.announcements (kind, title, body, version, accent, priority, published)
select
  'release_note',
  'danna 0.1.0',
  '- Roadmap with six units, lesson checkpoints and stars' || E'\n' ||
  '- Diagnostic test with an estimated TOEFL score and a skill report' || E'\n' ||
  '- Self study by section, mini mock tests and quick practice' || E'\n' ||
  '- Connect OpenAI, Anthropic, Gemini or OpenRouter to generate sets and get feedback',
  '0.1.0',
  'blue',
  0,
  true
where not exists (select 1 from public.announcements where version = '0.1.0');

insert into public.announcements (kind, title, body, version, accent, priority, published)
select
  'release_note',
  'danna 0.2.0',
  '- Keep everything on this device, or sign in to sync across devices' || E'\n' ||
  '- A new window bar and a tray icon, so practice stays one click away' || E'\n' ||
  '- A short welcome to choose how you want to learn' || E'\n' ||
  '- Friendlier messages and a new logo',
  '0.2.0',
  'blue',
  0,
  true
where not exists (select 1 from public.announcements where version = '0.2.0');

-- ---------------------------------------------------------------------------
-- 11. Migration 0002: My library (the same SQL as supabase/migrations/0002_library.sql).
-- ---------------------------------------------------------------------------
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

-- =============================================================================
-- danna migration 0003: general English. Each learner picks General English or the TOEFL
-- warm-up, the A1 level is added, and the 0.4.0 release note is published.
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again. The same section ends supabase/schema.sql for new projects.
--
-- Security
--  * The goal can only be one of two values, and each person can change only their own row.
--  * Existing rows keep their data. Every value they hold already fits the new rules.
--  * Learners from before 0.4.0 keep the TOEFL track: their goal is toefl. New profiles start as General English.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Learning goal and the A1 level
-- ---------------------------------------------------------------------------
-- Learners from before 0.4.0 were all practicing for the TOEFL, so every row that exists when the
-- column is added gets the TOEFL track. Profiles created afterwards start as General English.
alter table public.profiles
  add column if not exists goal text not null default 'toefl';

alter table public.profiles
  alter column goal set default 'english';

alter table public.profiles
  drop constraint if exists profiles_goal_check,
  add constraint profiles_goal_check check (goal in ('english', 'toefl'));

alter table public.profiles
  drop constraint if exists profiles_level_check,
  add constraint profiles_level_check check (level in ('A1', 'A2', 'B1', 'B2', 'C1'));

alter table public.tests
  drop constraint if exists tests_level_check,
  add constraint tests_level_check check (level in ('A1', 'A2', 'B1', 'B2', 'C1'));

grant update (goal) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Release note for 0.4.0
-- ---------------------------------------------------------------------------
insert into public.announcements (kind, title, body, version, accent, priority, published)
select
  'release_note',
  'danna 0.4.0',
  '- More than 70 lessons from A1 to C1: grammar, vocabulary, reading, listening, speaking and writing' || E'\n' ||
  '- A level test for each level, and a level check to find your starting point' || E'\n' ||
  '- A TOEFL warm-up track, optional, for practice in the style of the test' || E'\n' ||
  '- Setup asks for your goal: General English or the TOEFL warm-up' || E'\n' ||
  '- The coach works with DeepSeek again, and says why when a reply cannot be written' || E'\n' ||
  '- The coach message box and the Continue and Back buttons stay in place' || E'\n' ||
  '- Dropdowns, calendars and scrollbars in the app''s own style',
  '0.4.0',
  'blue',
  0,
  true
where not exists (select 1 from public.announcements where version = '0.4.0');

-- ---------------------------------------------------------------------------
-- 12. Migration 0004: the 0.5.0 release note (the same SQL as supabase/migrations/0004_release_0_5_0.sql).
-- ---------------------------------------------------------------------------
insert into public.announcements (kind, title, body, version, accent, priority, published)
select
  'release_note',
  'danna 0.5.0',
  '- Portuguese (PT-BR) for the whole app. Choose the language in Settings' || E'
' ||
  '- Your day streak shows beside your picture, with a flame that grows at 10 and 50 days' || E'
' ||
  '- A report a friend shares opens as their report, with their name on it' || E'
' ||
  '- Profile pictures of your friends show up as soon as you are friends' || E'
' ||
  '- danna checks for new versions and installs them in the background' || E'
' ||
  '- The In use label in AI keys sits beside the key name',
  '0.5.0',
  'blue',
  0,
  true
where not exists (select 1 from public.announcements where version = '0.5.0');

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
    '- The day streak sits beside your profile picture' || E'\n' ||
    '- Google Gemini keys in the new AQ. format are recognised' || E'\n' ||
    '- Search boxes have a clear button that matches the rest of the app';
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
