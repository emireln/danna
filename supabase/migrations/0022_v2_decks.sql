-- =============================================================================
-- danna migration 0022: decks and flashcards with spaced repetition (2.0.0).
--
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again: tables, triggers and policies are created only when missing, or replaced with the same ones.
-- The same change ends supabase/schema.sql for new projects. Run migration 0021 first.
-- =============================================================================

-- A deck groups cards. A card has its front and back, an optional note, and the review state that the
-- spaced repetition scheduler sets (state, ease, interval, reps, lapses and when it is due next).
create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  colour text not null default 'green',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  front text not null,
  back text not null,
  note text not null default '',
  state text not null default 'new',
  ease numeric(4, 2) not null default 2.50,
  interval_days int not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  due_at timestamptz not null default now(),
  last_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decks_owner_recent on public.decks (owner_id, created_at desc);
create index if not exists cards_owner_due on public.cards (owner_id, due_at);
create index if not exists cards_deck on public.cards (deck_id, created_at);

-- Limits and formats. NOT VALID: they apply to every new or changed row.
alter table public.decks
  drop constraint if exists decks_title_length,
  add constraint decks_title_length check (char_length(title) between 1 and 80) not valid,
  drop constraint if exists decks_description_length,
  add constraint decks_description_length check (char_length(description) <= 300) not valid,
  drop constraint if exists decks_colour,
  add constraint decks_colour check (colour in ('green', 'blue', 'violet', 'sun', 'red', 'slate')) not valid;

alter table public.cards
  drop constraint if exists cards_front_length,
  add constraint cards_front_length check (char_length(front) between 1 and 300) not valid,
  drop constraint if exists cards_back_length,
  add constraint cards_back_length check (char_length(back) between 1 and 600) not valid,
  drop constraint if exists cards_note_length,
  add constraint cards_note_length check (char_length(note) <= 300) not valid,
  drop constraint if exists cards_state,
  add constraint cards_state check (state in ('new', 'learning', 'review')) not valid,
  drop constraint if exists cards_ease_range,
  add constraint cards_ease_range check (ease between 1.30 and 4.00) not valid,
  drop constraint if exists cards_interval_range,
  add constraint cards_interval_range check (interval_days between 0 and 36500) not valid,
  drop constraint if exists cards_counts_range,
  add constraint cards_counts_range check (reps between 0 and 100000 and lapses between 0 and 100000) not valid;

-- A card can only go into a deck of the same owner.
create or replace function public.cards_same_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.decks d where d.id = new.deck_id and d.owner_id = new.owner_id) then
    raise exception 'A card must be in a deck of its owner.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.cards_same_owner() from public, anon, authenticated;

-- Triggers: updated_at, a cap per person (100 decks, 5000 cards), and the owner check.
drop trigger if exists decks_touch on public.decks;
create trigger decks_touch before update on public.decks
  for each row execute function public.touch_updated_at();

drop trigger if exists decks_quota on public.decks;
create trigger decks_quota before insert on public.decks
  for each row execute function public.enforce_quota('owner_id', '100');

drop trigger if exists cards_touch on public.cards;
create trigger cards_touch before update on public.cards
  for each row execute function public.touch_updated_at();

drop trigger if exists cards_quota on public.cards;
create trigger cards_quota before insert on public.cards
  for each row execute function public.enforce_quota('owner_id', '5000');

drop trigger if exists cards_same_owner on public.cards;
create trigger cards_same_owner before insert or update on public.cards
  for each row execute function public.cards_same_owner();

-- Row-level security: each person sees and changes only their own decks and cards.
alter table public.decks enable row level security;
alter table public.cards enable row level security;

drop policy if exists "decks: owner" on public.decks;
create policy "decks: owner" on public.decks
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "cards: owner" on public.cards;
create policy "cards: owner" on public.cards
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

revoke all on public.decks, public.cards from anon;
grant select, insert, update, delete on public.decks, public.cards to authenticated;
