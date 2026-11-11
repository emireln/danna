-- danna database schema for Supabase (PostgreSQL).
-- Run the whole file once: Supabase dashboard -> SQL Editor -> New query -> Run.
-- It is safe to re-run: objects are created with IF NOT EXISTS and policies are replaced.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles: one row per account, created automatically at sign-up.
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
begin
  base := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1), ''),
    '[^a-z0-9_]', '', 'g'));
  base := left(base, 14);
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
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), candidate)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Friendships: a request is pending until the addressee accepts it.
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

create unique index if not exists friendships_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

alter table public.friendships enable row level security;

drop policy if exists "friendships: read own" on public.friendships;
create policy "friendships: read own" on public.friendships
  for select to authenticated using (auth.uid() in (requester_id, addressee_id));

drop policy if exists "friendships: send request" on public.friendships;
create policy "friendships: send request" on public.friendships
  for insert to authenticated with check (requester_id = auth.uid() and status = 'pending');

drop policy if exists "friendships: accept" on public.friendships;
create policy "friendships: accept" on public.friendships
  for update to authenticated
  using (addressee_id = auth.uid())
  with check (addressee_id = auth.uid() and status = 'accepted');

drop policy if exists "friendships: remove" on public.friendships;
create policy "friendships: remove" on public.friendships
  for delete to authenticated using (auth.uid() in (requester_id, addressee_id));

-- ---------------------------------------------------------------------------
-- Attempts: every finished diagnostic, lesson, checkpoint, mock or practice set.
-- ---------------------------------------------------------------------------
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

create index if not exists attempts_user_recent on public.attempts (user_id, created_at desc);

alter table public.attempts enable row level security;

drop policy if exists "attempts: owner" on public.attempts;
create policy "attempts: owner" on public.attempts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Tests: AI-generated or custom practice sets.
-- ---------------------------------------------------------------------------
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

create index if not exists tests_owner_recent on public.tests (owner_id, created_at desc);

alter table public.tests enable row level security;

drop policy if exists "tests: owner" on public.tests;
create policy "tests: owner" on public.tests
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Shares: a result or a test sent from one friend to another.
-- Sending requires an accepted friendship and ownership of the shared item.
-- ---------------------------------------------------------------------------
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

create index if not exists shares_recipient_recent on public.shares (recipient_id, created_at desc);
create index if not exists shares_sender_recent on public.shares (sender_id, created_at desc);

alter table public.shares enable row level security;

drop policy if exists "shares: read own" on public.shares;
create policy "shares: read own" on public.shares
  for select to authenticated using (auth.uid() in (sender_id, recipient_id));

drop policy if exists "shares: send to friends" on public.shares;
create policy "shares: send to friends" on public.shares
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = shares.recipient_id)
          or (f.addressee_id = auth.uid() and f.requester_id = shares.recipient_id)
        )
    )
    and (shares.attempt_id is null or exists (
      select 1 from public.attempts a where a.id = shares.attempt_id and a.user_id = auth.uid()
    ))
    and (shares.test_id is null or exists (
      select 1 from public.tests t where t.id = shares.test_id and t.owner_id = auth.uid()
    ))
  );

drop policy if exists "shares: recipient marks seen" on public.shares;
create policy "shares: recipient marks seen" on public.shares
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists "shares: sender removes" on public.shares;
create policy "shares: sender removes" on public.shares
  for delete to authenticated using (sender_id = auth.uid());

-- Shared items become readable to the recipient only (policies added after the shares table exists).
drop policy if exists "attempts: shared with me" on public.attempts;
create policy "attempts: shared with me" on public.attempts
  for select to authenticated
  using (exists (
    select 1 from public.shares s where s.attempt_id = attempts.id and s.recipient_id = auth.uid()
  ));

drop policy if exists "tests: shared with me" on public.tests;
create policy "tests: shared with me" on public.tests
  for select to authenticated
  using (exists (
    select 1 from public.shares s where s.test_id = tests.id and s.recipient_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Skill scores, lesson progress, review queue, tutor messages (owner only).
-- ---------------------------------------------------------------------------
create table if not exists public.skill_scores (
  user_id uuid not null references public.profiles (id) on delete cascade,
  skill text not null check (skill in ('reading', 'listening', 'speaking', 'writing', 'language')),
  score int not null check (score between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill)
);

alter table public.skill_scores enable row level security;

drop policy if exists "skill_scores: owner" on public.skill_scores;
create policy "skill_scores: owner" on public.skill_scores
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

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

alter table public.lesson_progress enable row level security;

drop policy if exists "lesson_progress: owner" on public.lesson_progress;
create policy "lesson_progress: owner" on public.lesson_progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

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

create index if not exists review_items_due on public.review_items (user_id, due_at);

alter table public.review_items enable row level security;

drop policy if exists "review_items: owner" on public.review_items;
create policy "review_items: owner" on public.review_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  created_at timestamptz not null default now()
);

create index if not exists tutor_messages_user_time on public.tutor_messages (user_id, created_at);

alter table public.tutor_messages enable row level security;

drop policy if exists "tutor_messages: owner" on public.tutor_messages;
create policy "tutor_messages: owner" on public.tutor_messages
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Announcements: banners and release notes, written from the Supabase dashboard
-- (or any service-role client). Signed-in users can only read published rows.
-- ---------------------------------------------------------------------------
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

alter table public.announcements enable row level security;

drop policy if exists "announcements: read published" on public.announcements;
create policy "announcements: read published" on public.announcements
  for select to authenticated
  using (published and starts_at <= now() and (ends_at is null or ends_at > now()));

insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Functions the app calls. They return only the columns each screen needs.
-- ---------------------------------------------------------------------------
create or replace function public.search_people(q text)
returns table (id uuid, username text, display_name text, avatar_color text, xp int, streak int)
language sql
stable
security definer
set search_path = public
as $$
  with term as (
    select regexp_replace(lower(coalesce(q, '')), '[^a-z0-9_]', '', 'g') as t
  )
  select p.id, p.username, p.display_name, p.avatar_color, p.xp, p.streak
  from public.profiles p, term
  where p.id <> auth.uid()
    and char_length(term.t) >= 2
    and strpos(p.username, term.t) > 0
  order by p.username
  limit 20;
$$;

create or replace function public.list_friends()
returns table (
  friendship_id uuid,
  status text,
  direction text,
  id uuid,
  username text,
  display_name text,
  avatar_color text,
  xp int,
  streak int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.id,
    f.status,
    case when f.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
    p.id,
    p.username,
    p.display_name,
    p.avatar_color,
    p.xp,
    p.streak,
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id, f.addressee_id)
  order by f.created_at desc;
$$;

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
set search_path = public
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
  where auth.uid() in (s.sender_id, s.recipient_id)
  order by s.created_at desc
  limit 100;
$$;

revoke all on function public.search_people(text) from public;
revoke all on function public.list_friends() from public;
revoke all on function public.list_shares() from public;
grant execute on function public.search_people(text) to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.list_shares() to authenticated;

-- ---------------------------------------------------------------------------
-- Seed content: the first release note. Add banners and more notes in the dashboard.
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
