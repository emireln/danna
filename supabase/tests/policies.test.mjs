// Database tests. The real schema runs on PostgreSQL (PGlite, in-process), and each test checks
// what one kind of person can and cannot do. Supabase's auth schema, storage, roles and default
// grants are recreated below, because the schema depends on them. Run with: npm run test:db
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const schemaSql = await readFile(join(here, '..', 'schema.sql'), 'utf8');
// PGlite does not ship the pgcrypto extension. Version 1 uses only built-in functions, so that line is skipped.
const legacySql = (await readFile(join(here, 'legacy', 'schema-v1.sql'), 'utf8')).replace(
  'create extension if not exists pgcrypto;',
  '',
);

// The migration that the app's current version needs, run on top of the schema, as the dashboard would run it.
const migrationSql = await readFile(join(here, '..', 'migrations', '0006_release_0_7_0.sql'), 'utf8');

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';
const DAVE = '44444444-4444-4444-8444-444444444444';
const EVE = '55555555-5555-4555-8555-555555555555';
const FRANK = '66666666-6666-4666-8666-666666666666';
const GRACE = '77777777-7777-4777-8777-777777777777';

// What a new Supabase project provides before any of our SQL runs.
const SUPABASE_BASE = `
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create or replace function auth.uid() returns uuid language sql stable as $$
    select (nullif(nullif(current_setting('request.jwt.claims', true), ''), '')::jsonb ->> 'sub')::uuid
  $$;

  create schema if not exists storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text not null references storage.buckets (id),
    name text not null,
    owner uuid,
    created_at timestamptz not null default now(),
    unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;

  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  end $$;

  grant usage on schema public, auth, storage to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant select on storage.buckets to anon, authenticated;

  -- A new project grants everything on the public schema to these roles by default.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

const PERMISSION_DENIED = '42501'; // no privilege, or row-level security refused the write
const CHECK_FAILED = '23514';
const QUOTA_REACHED = '54000';

async function newDatabase() {
  const db = new PGlite();
  await db.exec(SUPABASE_BASE);
  return db;
}

// Runs one statement the way the API does: as a signed-in person, or as an anonymous visitor (who = null).
async function as(db, who, sql, params = []) {
  const claims = who ? JSON.stringify({ sub: who, role: 'authenticated' }) : '';
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims]);
  await db.exec(who ? 'set role authenticated' : 'set role anon');
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

// Returns the error a statement raised, and fails the test if the statement was allowed.
async function refused(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('The statement was allowed, but it should have been refused.');
}

async function addUser(db, id, email, meta) {
  await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [id, email, JSON.stringify(meta)]);
}

let db;

before(async () => {
  db = await newDatabase();
  await db.exec(schemaSql);
  await addUser(db, ALICE, 'alice@example.test', { username: 'alice', display_name: 'Alice' });
  await addUser(db, BOB, 'bob@example.test', { username: 'bob', display_name: 'Bob' });
  await addUser(db, CAROL, 'carol@example.test', { username: 'carol', display_name: 'Carol' });
});

test('row-level security is on for every table in the public schema', async () => {
  const { rows } = await db.query(`
    select c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'`);
  const open = rows.filter((row) => !row.relrowsecurity).map((row) => row.relname);
  assert.deepEqual(open, [], `tables without row-level security: ${open.join(', ')}`);
  assert.ok(rows.length >= 10);
});

test('signed-out visitors cannot read any table or call any function', async () => {
  const tables = ['profiles', 'friendships', 'attempts', 'tests', 'shares', 'skill_scores', 'lesson_progress', 'review_items', 'tutor_messages', 'announcements'];
  for (const table of tables) {
    const error = await refused(as(db, null, `select 1 from public.${table} limit 1`));
    assert.equal(error.code, PERMISSION_DENIED, table);
  }
  const search = await refused(as(db, null, `select * from public.search_people('alice')`));
  assert.equal(search.code, PERMISSION_DENIED);
});

test('a profile is created at sign-up with a safe username', async () => {
  const profile = async (id) =>
    (await db.query('select username, display_name from public.profiles where id = $1', [id])).rows[0];
  assert.equal((await profile(ALICE)).username, 'alice');

  await addUser(db, DAVE, 'dave@example.test', { username: 'Dave Smith!' });
  assert.equal((await profile(DAVE)).username, 'davesmith');

  await addUser(db, EVE, 'eve@example.test', { username: 'alice' });
  assert.match((await profile(EVE)).username, /^alice_[0-9a-f]{4}$/);

  await addUser(db, FRANK, 'frank@example.test', { username: 'x' });
  assert.equal((await profile(FRANK)).username, 'learner');

  await addUser(db, GRACE, 'grace@example.test', { username: 'grace', display_name: 'G'.repeat(60) });
  assert.equal((await profile(GRACE)).display_name.length, 40);
});

test('people see and change only their own profile', async () => {
  const seen = await as(db, BOB, 'select id from public.profiles where id = $1', [ALICE]);
  assert.equal(seen.rows.length, 0);

  const edited = await as(db, BOB, "update public.profiles set display_name = 'hacked' where id = $1", [ALICE]);
  assert.equal(edited.affectedRows, 0);
  const own = await as(db, ALICE, 'select display_name from public.profiles where id = $1', [ALICE]);
  assert.equal(own.rows[0].display_name, 'Alice');

  const inserted = await refused(as(db, BOB, "insert into public.profiles (id, username) values ($1, 'mallory')", [CAROL]));
  assert.equal(inserted.code, PERMISSION_DENIED);

  const reassigned = await refused(as(db, ALICE, 'update public.profiles set id = $1 where id = $2', [BOB, ALICE]));
  assert.equal(reassigned.code, PERMISSION_DENIED);
});

test('XP never goes down, and streak stays in range', async () => {
  await as(db, ALICE, 'update public.profiles set xp = 50 where id = $1', [ALICE]);
  await as(db, ALICE, 'update public.profiles set xp = 10 where id = $1', [ALICE]);
  const xp = await as(db, ALICE, 'select xp from public.profiles where id = $1', [ALICE]);
  assert.equal(xp.rows[0].xp, 50);

  const streak = await refused(as(db, ALICE, 'update public.profiles set streak = 40000 where id = $1', [ALICE]));
  assert.equal(streak.code, CHECK_FAILED);
});

test('a profile picture can only point at your own file, with its time', async () => {
  const someoneElse = await refused(
    as(db, ALICE, 'update public.profiles set avatar_path = $1, avatar_updated_at = now() where id = $2', [`${BOB}/avatar.webp`, ALICE]),
  );
  assert.equal(someoneElse.code, CHECK_FAILED);

  const withoutTime = await refused(
    as(db, ALICE, 'update public.profiles set avatar_path = $1 where id = $2', [`${ALICE}/avatar.webp`, ALICE]),
  );
  assert.equal(withoutTime.code, CHECK_FAILED);

  await as(db, ALICE, 'update public.profiles set avatar_path = $1, avatar_updated_at = now() where id = $2', [`${ALICE}/avatar.webp`, ALICE]);
});

test('friend requests cannot be forged, self-addressed, or accepted by others', async () => {
  await as(db, BOB, 'insert into public.friendships (requester_id, addressee_id) values ($1, $2)', [BOB, ALICE]);

  const forged = await refused(as(db, CAROL, 'insert into public.friendships (requester_id, addressee_id) values ($1, $2)', [BOB, ALICE]));
  assert.equal(forged.code, PERMISSION_DENIED);

  const self = await refused(as(db, BOB, 'insert into public.friendships (requester_id, addressee_id) values ($1, $1)', [BOB]));
  assert.equal(self.code, CHECK_FAILED);

  const stranger = await as(db, CAROL, "update public.friendships set status = 'accepted' where requester_id = $1", [BOB]);
  assert.equal(stranger.affectedRows, 0);

  const hijack = await refused(as(db, ALICE, 'update public.friendships set requester_id = $1 where requester_id = $2', [CAROL, BOB]));
  assert.equal(hijack.code, PERMISSION_DENIED);

  await as(
    db,
    ALICE,
    "update public.friendships set status = 'accepted', responded_at = now() where requester_id = $1 and addressee_id = $2",
    [BOB, ALICE],
  );
  const carolSees = await as(db, CAROL, 'select id from public.friendships');
  assert.equal(carolSees.rows.length, 0);
});

test('search finds people by username, needs three letters, and never returns the caller or XP', async () => {
  const short = await as(db, CAROL, "select * from public.search_people('bo')");
  assert.equal(short.rows.length, 0);

  const found = await as(db, CAROL, "select * from public.search_people('bob')");
  assert.ok(found.rows.some((row) => row.username === 'bob'));
  assert.equal('xp' in found.rows[0], false);

  const own = await as(db, BOB, "select * from public.search_people('bob')");
  assert.equal(own.rows.filter((row) => row.username === 'bob').length, 0);
});

test('list_friends shows XP only for accepted friends', async () => {
  await as(db, BOB, 'insert into public.friendships (requester_id, addressee_id) values ($1, $2)', [BOB, CAROL]);
  const rows = (await as(db, BOB, 'select status, xp from public.list_friends()')).rows;
  const accepted = rows.find((row) => row.status === 'accepted');
  const pending = rows.find((row) => row.status === 'pending');
  assert.equal(typeof accepted.xp, 'number');
  assert.equal(pending.xp, null);
});

test('shares reach only friends, and only items the sender owns', async () => {
  const mine = await as(
    db,
    ALICE,
    `insert into public.attempts (user_id, kind, ref_id, title, score_pct, predicted, skills, answers, duration_s)
     values ($1, 'diagnostic', 'd1', 'Diagnostic', 70, 84, '{"reading": 70}', '[]', 900) returning id`,
    [ALICE],
  );
  const attemptId = mine.rows[0].id;
  const theirs = await as(
    db,
    BOB,
    `insert into public.attempts (user_id, kind, title, score_pct) values ($1, 'practice', 'Bob practice', 40) returning id`,
    [BOB],
  );
  const bobAttemptId = theirs.rows[0].id;

  const toStranger = await refused(
    as(db, ALICE, "insert into public.shares (sender_id, recipient_id, kind, attempt_id, note) values ($1, $2, 'result', $3, 'hi')", [ALICE, CAROL, attemptId]),
  );
  assert.equal(toStranger.code, PERMISSION_DENIED);

  const notMine = await refused(
    as(db, ALICE, "insert into public.shares (sender_id, recipient_id, kind, attempt_id) values ($1, $2, 'result', $3)", [ALICE, BOB, bobAttemptId]),
  );
  assert.equal(notMine.code, PERMISSION_DENIED);

  await as(
    db,
    ALICE,
    "insert into public.shares (sender_id, recipient_id, kind, attempt_id, note) values ($1, $2, 'result', $3, 'Check this')",
    [ALICE, BOB, attemptId],
  );

  assert.equal((await as(db, BOB, 'select id from public.attempts where id = $1', [attemptId])).rows.length, 1);
  assert.equal((await as(db, CAROL, 'select id from public.attempts where id = $1', [attemptId])).rows.length, 0);

  const inbox = await as(db, BOB, 'select kind, note, direction from public.list_shares()');
  assert.equal(inbox.rows.length, 1);
  assert.equal(inbox.rows[0].note, 'Check this');
  assert.equal(inbox.rows[0].direction, 'received');
});

test('a recipient can mark a share seen, but cannot re-point it or edit the note', async () => {
  const seen = await as(db, BOB, 'update public.shares set seen = true where recipient_id = $1', [BOB]);
  assert.equal(seen.affectedRows, 1);

  const attempts = await as(db, ALICE, 'select id from public.attempts where user_id = $1 limit 1', [ALICE]);
  const otherAttempt = await as(
    db,
    ALICE,
    "insert into public.attempts (user_id, kind, title, score_pct) values ($1, 'practice', 'Second', 60) returning id",
    [ALICE],
  );
  assert.ok(attempts.rows.length > 0 && otherAttempt.rows.length === 1);

  const repoint = await refused(as(db, BOB, 'update public.shares set attempt_id = $1 where recipient_id = $2', [otherAttempt.rows[0].id, BOB]));
  assert.equal(repoint.code, PERMISSION_DENIED);

  const editNote = await refused(as(db, BOB, "update public.shares set note = 'changed' where recipient_id = $1", [BOB]));
  assert.equal(editNote.code, PERMISSION_DENIED);
});

test('private study data stays private to its owner', async () => {
  await as(db, ALICE, "insert into public.tests (owner_id, title, content) values ($1, 'Set', '{\"passages\": [], \"questions\": []}')", [ALICE]);
  await as(db, ALICE, "insert into public.lesson_progress (user_id, lesson_id, stars) values ($1, 'u1-l1', 2)", [ALICE]);
  await as(db, ALICE, "insert into public.review_items (user_id, item_key, skill, payload, due_at) values ($1, 'k1', 'reading', '{\"question\": {}}', now())", [ALICE]);
  await as(db, ALICE, "insert into public.tutor_messages (user_id, role, content) values ($1, 'user', 'hello')", [ALICE]);
  await as(db, ALICE, "insert into public.skill_scores (user_id, skill, score) values ($1, 'reading', 60)", [ALICE]);

  for (const table of ['tests', 'lesson_progress', 'review_items', 'tutor_messages', 'skill_scores']) {
    const rows = await as(db, BOB, `select 1 from public.${table}`);
    assert.equal(rows.rows.length, 0, table);
  }
  const edited = await as(db, BOB, "update public.lesson_progress set stars = 0 where user_id = $1", [ALICE]);
  assert.equal(edited.affectedRows, 0);
});

test('sizes and formats are limited', async () => {
  const longTitle = await refused(
    as(db, ALICE, "insert into public.attempts (user_id, kind, title, score_pct, answers) values ($1, 'practice', $2, 50, '[]')", [ALICE, 'x'.repeat(201)]),
  );
  assert.equal(longTitle.code, CHECK_FAILED);

  const bigAnswers = await refused(
    as(db, ALICE, "insert into public.attempts (user_id, kind, title, score_pct, answers) values ($1, 'practice', 'T', 50, $2)", [ALICE, JSON.stringify(['x'.repeat(270000)])]),
  );
  assert.equal(bigAnswers.code, CHECK_FAILED);

  const longTutor = await refused(as(db, ALICE, "insert into public.tutor_messages (user_id, role, content) values ($1, 'user', $2)", [ALICE, 'x'.repeat(8001)]));
  assert.equal(longTutor.code, CHECK_FAILED);

  const notAnObject = await refused(as(db, ALICE, "insert into public.tests (owner_id, title, content) values ($1, 'T', '[]')", [ALICE]));
  assert.equal(notAnObject.code, CHECK_FAILED);

  const bigReview = await refused(
    as(db, ALICE, "insert into public.review_items (user_id, item_key, skill, payload, due_at) values ($1, 'big', 'reading', $2, now())", [ALICE, JSON.stringify({ text: 'x'.repeat(70000) })]),
  );
  assert.equal(bigReview.code, CHECK_FAILED);

  const unsafeLink = await refused(db.query("insert into public.announcements (kind, title, cta_url) values ('news', 'Hi', 'javascript:alert(1)')"));
  assert.equal(unsafeLink.code, CHECK_FAILED);
  const plainHttp = await refused(db.query("insert into public.announcements (kind, title, image_url) values ('banner', 'Hi', 'http://example.test/a.png')"));
  assert.equal(plainHttp.code, CHECK_FAILED);
});

test('announcements: signed-in people read published rows only, and cannot write', async () => {
  await db.query("insert into public.announcements (kind, title, body, published) values ('banner', 'Draft banner', 'Not yet', false)");
  const visible = await as(db, ALICE, 'select title from public.announcements');
  assert.equal(visible.rows.some((row) => row.title === 'Draft banner'), false);
  assert.equal(visible.rows.some((row) => row.title === 'danna 0.2.0'), true);

  const write = await refused(as(db, ALICE, "insert into public.announcements (kind, title) values ('news', 'Mine')"));
  assert.equal(write.code, PERMISSION_DENIED);
});

test('functions: only signed-in people can run the app functions', async () => {
  const check = async (role, signature) =>
    (await db.query('select has_function_privilege($1, $2, $3) as ok', [role, signature, 'execute'])).rows[0].ok;

  assert.equal(await check('anon', 'public.search_people(text)'), false);
  assert.equal(await check('authenticated', 'public.search_people(text)'), true);
  assert.equal(await check('anon', 'public.list_friends()'), false);
  assert.equal(await check('authenticated', 'public.list_shares()'), true);
  assert.equal(await check('anon', 'public.are_friends(uuid,uuid)'), false);
  assert.equal(await check('authenticated', 'public.are_friends(uuid,uuid)'), true);
  assert.equal(await check('authenticated', 'public.handle_new_user()'), false);
  assert.equal(await check('authenticated', 'public.enforce_quota()'), false);
});

test('table and column privileges match what the app does', async () => {
  const table = async (role, name, privilege) =>
    (await db.query('select has_table_privilege($1, $2, $3) as ok', [role, name, privilege])).rows[0].ok;
  const column = async (role, name, col, privilege) =>
    (await db.query('select has_column_privilege($1, $2, $3, $4) as ok', [role, name, col, privilege])).rows[0].ok;

  assert.equal(await table('anon', 'public.profiles', 'SELECT'), false);
  assert.equal(await table('authenticated', 'public.profiles', 'DELETE'), false);
  assert.equal(await column('authenticated', 'public.profiles', 'id', 'UPDATE'), false);
  assert.equal(await column('authenticated', 'public.profiles', 'xp', 'UPDATE'), true);
  assert.equal(await column('authenticated', 'public.shares', 'attempt_id', 'UPDATE'), false);
  assert.equal(await column('authenticated', 'public.shares', 'seen', 'UPDATE'), true);
  assert.equal(await column('authenticated', 'public.friendships', 'requester_id', 'UPDATE'), false);
  assert.equal(await table('authenticated', 'public.announcements', 'INSERT'), false);
});

test('row quotas are enforced, also for people who cannot run the counting function', async () => {
  // The same trigger the real tables use, with a limit of two rows.
  await db.exec(`
    create table public.quota_probe (owner_id uuid not null);
    create trigger quota_probe_limit before insert on public.quota_probe
      for each row execute function public.enforce_quota('owner_id', '2');
    grant insert on public.quota_probe to authenticated;`);
  await as(db, ALICE, 'insert into public.quota_probe (owner_id) values ($1)', [ALICE]);
  await as(db, ALICE, 'insert into public.quota_probe (owner_id) values ($1)', [ALICE]);
  const over = await refused(as(db, ALICE, 'insert into public.quota_probe (owner_id) values ($1)', [ALICE]));
  assert.equal(over.code, QUOTA_REACHED);
});

test('profile pictures are private: the owner writes, friends look, everyone else is refused', async () => {
  const bucket = (await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'")).rows[0];
  assert.equal(bucket.public, false);
  assert.equal(bucket.file_size_limit, 307200);
  assert.deepEqual(bucket.allowed_mime_types, ['image/webp']);

  await as(db, ALICE, "insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)", [`${ALICE}/avatar.webp`, ALICE]);

  const onBehalf = await refused(as(db, ALICE, "insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)", [`${BOB}/avatar.webp`, ALICE]));
  assert.equal(onBehalf.code, PERMISSION_DENIED);
  const extraFile = await refused(as(db, ALICE, "insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)", [`${ALICE}/other.webp`, ALICE]));
  assert.equal(extraFile.code, PERMISSION_DENIED);

  const friendSees = await as(db, BOB, "select name from storage.objects where bucket_id = 'avatars'");
  assert.equal(friendSees.rows.length, 1);
  const strangerSees = await as(db, CAROL, "select name from storage.objects where bucket_id = 'avatars'");
  assert.equal(strangerSees.rows.length, 0);
  const anonymousSees = await refused(as(db, null, "select name from storage.objects where bucket_id = 'avatars'"));
  assert.equal(anonymousSees.code, PERMISSION_DENIED);

  const replaced = await as(db, ALICE, "update storage.objects set owner = $1 where bucket_id = 'avatars' and name = $2", [ALICE, `${ALICE}/avatar.webp`]);
  assert.equal(replaced.affectedRows, 1);
  const friendReplace = await as(db, BOB, "update storage.objects set owner = $1 where bucket_id = 'avatars' and name = $2", [BOB, `${ALICE}/avatar.webp`]);
  assert.equal(friendReplace.affectedRows, 0);
});

test('profile banners are private too: the owner writes, friends look once the profile points at it, everyone else is refused', async () => {
  const bucket = (await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'profile-banners'")).rows[0];
  assert.equal(bucket.public, false);
  assert.equal(bucket.file_size_limit, 491520);
  assert.deepEqual(bucket.allowed_mime_types, ['image/webp']);

  await as(db, ALICE, "insert into storage.objects (bucket_id, name, owner) values ('profile-banners', $1, $2)", [`${ALICE}/banner.webp`, ALICE]);
  const onBehalf = await refused(as(db, ALICE, "insert into storage.objects (bucket_id, name, owner) values ('profile-banners', $1, $2)", [`${BOB}/banner.webp`, ALICE]));
  assert.equal(onBehalf.code, PERMISSION_DENIED);
  const extraFile = await refused(as(db, ALICE, "insert into storage.objects (bucket_id, name, owner) values ('profile-banners', $1, $2)", [`${ALICE}/other.webp`, ALICE]));
  assert.equal(extraFile.code, PERMISSION_DENIED);

  // A banner is shown to others only once the profile points at it, and only at the owner's own file.
  assert.equal((await as(db, BOB, "select name from storage.objects where bucket_id = 'profile-banners'")).rows.length, 0);
  const borrowed = await refused(as(db, ALICE, 'update public.profiles set banner_path = $1, banner_updated_at = now() where id = $2', [`${BOB}/banner.webp`, ALICE]));
  assert.equal(borrowed.code, CHECK_FAILED);
  await as(db, ALICE, 'update public.profiles set banner_path = $1, banner_updated_at = now() where id = $2', [`${ALICE}/banner.webp`, ALICE]);

  const friendSees = await as(db, BOB, "select name from storage.objects where bucket_id = 'profile-banners'");
  assert.equal(friendSees.rows.length, 1, 'a friend sees the banner');
  const friendBanner = (await as(db, BOB, 'select banner_path, banner_updated_at from public.list_friends() where id = $1', [ALICE])).rows[0];
  assert.equal(friendBanner.banner_path, `${ALICE}/banner.webp`, 'the friends list gives the banner path');
  assert.equal((await as(db, CAROL, "select name from storage.objects where bucket_id = 'profile-banners'")).rows.length, 0, 'a stranger does not');
  const anonymousSees = await refused(as(db, null, "select name from storage.objects where bucket_id = 'profile-banners'"));
  assert.equal(anonymousSees.code, PERMISSION_DENIED);

  const friendReplace = await as(db, BOB, "update storage.objects set owner = $1 where bucket_id = 'profile-banners' and name = $2", [BOB, `${ALICE}/banner.webp`]);
  assert.equal(friendReplace.affectedRows, 0, 'a friend cannot change the banner');
});

test('migration 0006 runs on a current database, and again, without changing what is there', async () => {
  await db.exec(migrationSql);
  await db.exec(migrationSql);
  assert.equal((await db.query("select count(*)::int as n from public.announcements where version = '0.7.0'")).rows[0].n, 1, 'one note for 0.7.0');
  assert.equal((await db.query("select id from storage.buckets where id = 'profile-banners'")).rows.length, 1, 'the banner bucket is there');
  assert.equal((await as(db, ALICE, 'select banner_path from public.profiles where id = $1', [ALICE])).rows.length, 1, 'the profile still has its banner columns');
});

test('unfriending ends access to shared results and to profile pictures', async () => {
  const visible = (await as(db, BOB, "select name from storage.objects where bucket_id = 'avatars'")).rows.length;
  assert.equal(visible, 1, 'friends can see the picture before unfriending');
  assert.equal((await as(db, BOB, "select name from storage.objects where bucket_id = 'profile-banners'")).rows.length, 1, 'and the banner');

  await as(db, ALICE, 'delete from public.friendships where requester_id = $1 and addressee_id = $2 or requester_id = $2 and addressee_id = $1', [ALICE, BOB]);

  const sharedAttempt = (await as(db, BOB, 'select id from public.attempts where user_id = $1', [ALICE])).rows;
  assert.equal(sharedAttempt.length, 0);
  assert.equal((await as(db, BOB, 'select id from public.list_shares()')).rows.length, 0);
  assert.equal((await as(db, BOB, "select name from storage.objects where bucket_id = 'avatars'")).rows.length, 0);
  assert.equal((await as(db, BOB, "select name from storage.objects where bucket_id = 'profile-banners'")).rows.length, 0, 'and the banner');
});

test('an existing version 1 database upgrades in place, keeps its data, and can be upgraded twice', async () => {
  const upgrade = await newDatabase();
  await upgrade.exec(legacySql);
  await addUser(upgrade, ALICE, 'alice@example.test', { username: 'alice', display_name: 'Alice' });
  await addUser(upgrade, BOB, 'bob@example.test', { username: 'bob', display_name: 'Bob' });
  await upgrade.query("insert into public.attempts (user_id, kind, title, score_pct) values ($1, 'diagnostic', 'Diagnostic', 70)", [ALICE]);
  await upgrade.query("insert into public.friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')", [ALICE, BOB]);

  await upgrade.exec(schemaSql);
  const kept = (await upgrade.query('select count(*)::int as n from public.attempts')).rows[0].n;
  assert.equal(kept, 1);
  const friends = (await upgrade.query("select count(*)::int as n from public.friendships where status = 'accepted'")).rows[0].n;
  assert.equal(friends, 1);

  const oldSharing = (
    await upgrade.query(
      "select policyname from pg_policies where schemaname = 'public' and policyname in ('attempts: shared with me', 'tests: shared with me')",
    )
  ).rows;
  assert.deepEqual(oldSharing, [], 'version 1 sharing rules must be gone');

  const newColumns = (
    await upgrade.query(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name in ('avatar_path', 'avatar_updated_at')",
    )
  ).rows;
  assert.equal(newColumns.length, 2);

  // Learners from the TOEFL-only app keep the TOEFL track. Profiles created from now on start as General English.
  const oldGoals = (await upgrade.query('select goal from public.profiles where id in ($1, $2) order by id', [ALICE, BOB])).rows;
  assert.deepEqual(
    oldGoals.map((row) => row.goal),
    ['toefl', 'toefl'],
  );
  await addUser(upgrade, CAROL, 'carol@example.test', { username: 'carol', display_name: 'Carol' });
  const newGoal = (await upgrade.query('select goal from public.profiles where id = $1', [CAROL])).rows[0].goal;
  assert.equal(newGoal, 'english');
  await upgrade.query("update public.profiles set level = 'A1' where id = $1", [ALICE]);
  await assert.rejects(upgrade.query("update public.profiles set goal = 'other' where id = $1", [ALICE]));

  await upgrade.exec(schemaSql);
  const again = (await upgrade.query('select count(*)::int as n from public.attempts')).rows[0].n;
  assert.equal(again, 1);
  const stillToefl = (await upgrade.query('select goal from public.profiles where id in ($1, $2) order by id', [ALICE, BOB])).rows;
  assert.deepEqual(
    stillToefl.map((row) => row.goal),
    ['toefl', 'toefl'],
  );
  await upgrade.close();
});

test('my library is private: only its owner can read or change it', async () => {
  await as(db, ALICE, "insert into public.library_links (user_id, url, title, platform, category) values ($1, 'https://youtu.be/abc', 'Listening', 'youtube', 'Listening')", [ALICE]);
  await as(db, ALICE, "insert into public.library_files (user_id, name, kind, mime_type, size_bytes, storage_path, extracted_text) values ($1, 'Unit.md', 'md', 'text/markdown', 10, $2, 'Hello')", [ALICE, `${ALICE}/doc.md`]);

  assert.equal((await as(db, BOB, 'select id from public.library_links')).rows.length, 0);
  assert.equal((await as(db, BOB, 'select id from public.library_files')).rows.length, 0);
  const changed = await as(db, BOB, "update public.library_files set name = 'x' where user_id = $1", [ALICE]);
  assert.equal(changed.affectedRows, 0);
  const anonymous = await refused(as(db, null, 'select id from public.library_files'));
  assert.equal(anonymous.code, PERMISSION_DENIED);
});

test('a library row belongs to the caller, uses https, and points into the owner folder', async () => {
  const otherOwner = await refused(as(db, BOB, "insert into public.library_links (user_id, url) values ($1, 'https://example.org/a')", [ALICE]));
  assert.equal(otherOwner.code, PERMISSION_DENIED);

  const plainHttp = await refused(as(db, BOB, "insert into public.library_links (user_id, url) values ($1, 'http://example.org/a')", [BOB]));
  assert.equal(plainHttp.code, CHECK_FAILED);

  const wrongFolder = await refused(
    as(db, BOB, "insert into public.library_files (user_id, name, kind, mime_type, size_bytes, storage_path) values ($1, 'x.md', 'md', 'text/markdown', 1, $2)", [BOB, `${ALICE}/x.md`]),
  );
  assert.equal(wrongFolder.code, CHECK_FAILED);
});

test('library bucket: private, 20 MB limit, three file types, and each person writes only to their own folder', async () => {
  const bucket = (await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'library'")).rows[0];
  assert.equal(bucket.public, false);
  assert.equal(bucket.file_size_limit, 20971520);
  assert.deepEqual([...bucket.allowed_mime_types].sort(), ['application/pdf', 'text/markdown', 'text/plain']);

  await as(db, ALICE, "insert into storage.objects (bucket_id, name, owner) values ('library', $1, $2)", [`${ALICE}/doc.md`, ALICE]);
  const intrude = await refused(as(db, BOB, "insert into storage.objects (bucket_id, name, owner) values ('library', $1, $2)", [`${ALICE}/other.md`, BOB]));
  assert.equal(intrude.code, PERMISSION_DENIED);
  assert.equal((await as(db, BOB, "select name from storage.objects where bucket_id = 'library'")).rows.length, 0);
});

test('coach chats belong to their owner, their names and file lists are limited, and deleting a chat deletes its messages', async () => {
  const chat = (await as(db, ALICE, "insert into public.tutor_chats (user_id, title) values ($1, 'Verb tenses') returning id", [ALICE])).rows[0];
  await as(
    db,
    ALICE,
    "insert into public.tutor_messages (user_id, chat_id, role, content, attachments) values ($1, $2, 'user', 'hello', '[{\"name\": \"notes.pdf\", \"kind\": \"document\", \"size\": 42}]')",
    [ALICE, chat.id],
  );

  assert.equal((await as(db, BOB, 'select 1 from public.tutor_chats')).rows.length, 0, 'other people cannot see a chat');
  assert.equal((await as(db, BOB, 'select 1 from public.tutor_messages where chat_id = $1', [chat.id])).rows.length, 0);
  const renamed = await as(db, BOB, 'update public.tutor_chats set title = $2 where id = $1', [chat.id, 'Mine now']);
  assert.equal(renamed.affectedRows, 0, 'nor rename it');

  const longName = await refused(as(db, ALICE, 'insert into public.tutor_chats (user_id, title) values ($1, $2)', [ALICE, 'x'.repeat(121)]));
  assert.equal(longName.code, CHECK_FAILED, 'a name is at most 120 characters');
  const manyFiles = Array.from({ length: 200 }, (_, index) => ({ name: `file-${index}-${'n'.repeat(40)}.pdf`, kind: 'document', size: 1 }));
  const bigList = await refused(
    as(db, ALICE, "insert into public.tutor_messages (user_id, chat_id, role, content, attachments) values ($1, $2, 'user', 'x', $3)", [
      ALICE,
      chat.id,
      JSON.stringify(manyFiles),
    ]),
  );
  assert.equal(bigList.code, CHECK_FAILED, 'the list of file names has a size limit');

  await as(db, ALICE, 'delete from public.tutor_chats where id = $1', [chat.id]);
  assert.equal((await as(db, ALICE, 'select 1 from public.tutor_messages where chat_id = $1', [chat.id])).rows.length, 0, 'its messages go with it');
});
