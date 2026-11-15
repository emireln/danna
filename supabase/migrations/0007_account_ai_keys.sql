-- =============================================================================
-- danna migration 0007: AI keys saved in the account, sealed on the device.
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: every change checks what is already there. The same changes end
-- supabase/schema.sql for new projects.
--
-- How the keys stay private
--  * The app seals each AI key with a key derived from the account password (PBKDF2 with 600,000
--    rounds, then AES-GCM). The database stores only the sealed text, so nobody who can read the
--    database can read the keys, the project owner included.
--  * The salt for that derivation is kept on the profile, so every device that signs in to the
--    account derives the same key. A password reset from the email link cannot open keys that were
--    sealed with the old password; those keys are added again once.
--  * Each row belongs to one person, and only that person can read, add, change or remove it.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The salt for the account's key, on the profile
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists ai_salt text;

alter table public.profiles
  drop constraint if exists profiles_ai_salt_format,
  add constraint profiles_ai_salt_format check (ai_salt is null or char_length(ai_salt) between 16 and 64) not valid;

grant update (ai_salt) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The sealed keys: one row per provider and person
-- ---------------------------------------------------------------------------
create table if not exists public.ai_keys (
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'gemini', 'openrouter', 'deepseek')),
  sealed text not null check (char_length(sealed) between 16 and 2048),
  masked text not null check (char_length(masked) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.ai_keys enable row level security;

drop policy if exists "ai_keys: owner" on public.ai_keys;
create policy "ai_keys: owner" on public.ai_keys
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.ai_keys to authenticated;

drop trigger if exists ai_keys_touch on public.ai_keys;
create trigger ai_keys_touch before update on public.ai_keys
  for each row execute function public.touch_updated_at();

-- There is one row per provider and five providers, so the primary key and the provider check already
-- limit each person to five keys. No row quota is needed, and a quota would also block replacing a key.
