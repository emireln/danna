// Checks the online backend (src/lib/data/supabaseBackend.ts) against the database schema, without the network.
// A recording stand-in for the Supabase client notes every table, function, bucket and column the backend
// uses. The schema file decides what exists, so a renamed column or a missing table fails here, not in the app.
// Who may read or write each table is tested against a real Postgres engine in supabase/tests.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const schema = readFileSync(join(root, 'supabase', 'schema.sql'), 'utf8');
const USER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';

// Tables and their columns, read from the schema, plus columns added later with "add column".
function schemaTables() {
  const tables = new Map();
  for (const match of schema.matchAll(/create table if not exists public\.(\w+) \(([\s\S]*?)\r?\n\);/g)) {
    const columns = new Set();
    for (const line of match[2].split(/\r?\n/)) {
      const word = line.trim().match(/^([a-z_][a-z0-9_]*)\s/i);
      if (word && !/^(primary|unique|constraint|check|foreign|exclude)$/i.test(word[1])) columns.add(word[1]);
    }
    tables.set(match[1], columns);
  }
  for (const match of schema.matchAll(/alter table public\.(\w+)\s+add column if not exists (\w+)/gi)) {
    tables.get(match[1])?.add(match[2]);
  }
  return tables;
}

function schemaFunctions() {
  return new Set([...schema.matchAll(/create (?:or replace )?function public\.(\w+)/g)].map((match) => match[1]));
}

// A stand-in for the Supabase client. Every query is recorded; awaiting it gives an empty result, or the
// error that was set for the next call.
function recordingClient() {
  const calls = [];
  const singles = new Map();
  let nextError = null;
  let session = { user: { id: USER, email: 'ana@example.com' } };

  const query = (target) => {
    const record = { target, ops: [] };
    calls.push(record);
    const proxy = new Proxy(() => {}, {
      get(_target, property) {
        if (property === 'then') {
          return (resolve) => {
            const single = record.ops.some((op) => op.op === 'maybeSingle' || op.op === 'single');
            const error = nextError;
            nextError = null;
            const counted = record.ops.some((op) => op.op === 'select' && op.args[1] && op.args[1].count === 'exact');
            const found = single && record.target.kind === 'table' ? (singles.get(record.target.name) ?? null) : null;
            resolve({ data: error ? null : single ? found : [], error, count: counted ? 3 : null });
          };
        }
        return (...args) => {
          record.ops.push({ op: String(property), args });
          return proxy;
        };
      },
      apply() {
        return proxy;
      },
    });
    return proxy;
  };

  return {
    calls,
    failNext(error) {
      nextError = error;
    },
    // What a single-row read of a table returns, for the next such reads.
    setSingle(table, row) {
      singles.set(table, row);
    },
    setSession(next) {
      session = next;
    },
    client: {
      from: (name) => query({ kind: 'table', name }),
      rpc: (name, args) => query({ kind: 'rpc', name, args }),
      storage: { from: (name) => query({ kind: 'bucket', name }) },
      auth: { getSession: async () => ({ data: { session } }) },
    },
  };
}

let server;
let backendFor;
let errorText;
let userErrorFn;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  ({ createSupabaseBackend: backendFor } = await server.ssrLoadModule('/src/lib/data/supabaseBackend.ts'));
  ({ errorText, userError: userErrorFn } = await server.ssrLoadModule('/src/lib/bridge.ts'));
});

after(async () => {
  await server?.close();
});

const blob = (type = 'image/webp') => new Blob([new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])], { type });
const opsOf = (record) => record.ops.map((op) => op.op);

test('every table, function, bucket and column the online backend uses exists in the schema', async () => {
  const tables = schemaTables();
  const functions = schemaFunctions();
  const stand = recordingClient();
  const backend = backendFor(stand.client);

  await backend.getProfile();
  await backend.updateProfile({ display_name: 'Ana', goal: 'toefl', target_score: 90, xp: 5 });
  await backend.getAvatar();
  await backend.setAvatar(blob());
  await backend.setAvatar(null);
  await backend.listAttempts(5, 'lesson');
  await backend.countAttempts('mock');
  await backend.getAttempt('a1');
  await backend.insertAttempt({
    kind: 'lesson',
    ref_id: 'a1-u1-l1',
    title: 'T',
    score_pct: 80,
    predicted: null,
    skills: { reading: 80 },
    answers: [],
    duration_s: 60,
  });
  await backend.getSkillScores();
  await backend.setSkillScores({ reading: 80 });
  await backend.listLessonProgress();
  await backend.upsertLessonProgress({ lesson_id: 'a1-u1-l1', stars: 2, best_pct: 80, attempts: 1, completed_at: null });
  await backend.listReviewItems();
  await backend.upsertReviewItems([
    { item_key: 'k', skill: 'reading', payload: { question: { id: 'q' } }, ease: 2.5, interval_days: 1, reps: 1, due_at: '2026-01-01T00:00:00.000Z' },
  ]);
  await backend.listMyTests();
  await backend.getTest('t1');
  await backend.insertTest({ title: 'T', description: '', kind: 'ai', skill: 'mixed', level: 'B1', minutes: 5, content: { passages: [], questions: [] } });
  await backend.listFriends();
  await backend.searchPeople('ana');
  await backend.requestFriend(OTHER);
  await backend.answerFriend('f1', true);
  await backend.answerFriend('f1', false);
  await backend.listShares();
  await backend.sendShare({ recipientId: OTHER, kind: 'result', attemptId: 'a1', note: 'hi' });
  await backend.markSharesSeen();
  await backend.listAnnouncements();
  await backend.listLibraryFiles();
  await backend.addLibraryFile({
    id: 'f1',
    name: 'a.pdf',
    kind: 'pdf',
    mime_type: 'text/html',
    blob: blob('application/pdf'),
    extracted_text: 'x',
    pages: 2,
  });
  await backend.getLibraryBlob('f1');
  await backend.getLibraryText('f1');
  await backend.deleteLibraryFile('f1');
  await backend.listLibraryLinks();
  await backend.addLibraryLink({ url: 'https://example.com', title: 't', platform: 'other', category: 'General', note: '' });
  await backend.updateLibraryLink('l1', { title: 'x' });
  await backend.deleteLibraryLink('l1');
  await backend.listTutor(10);
  await backend.addTutor('user', 'hello');
  await backend.clearTutor();

  const problems = [];
  for (const record of stand.calls) {
    if (record.target.kind === 'table' && !tables.has(record.target.name)) problems.push(`table ${record.target.name}`);
    if (record.target.kind === 'rpc' && !functions.has(record.target.name)) problems.push(`function ${record.target.name}`);
    for (const op of record.ops) {
      const payload = op.args[0];
      if (record.target.kind === 'table' && (op.op === 'insert' || op.op === 'update' || op.op === 'upsert')) {
        const rows = Array.isArray(payload) ? payload : [payload];
        const columns = tables.get(record.target.name) ?? new Set();
        for (const row of rows) {
          for (const key of Object.keys(row ?? {})) if (!columns.has(key)) problems.push(`${record.target.name}.${key}`);
        }
      }
      if (record.target.kind === 'table' && op.op === 'select' && typeof payload === 'string' && payload !== '*') {
        const columns = tables.get(record.target.name) ?? new Set();
        for (const column of payload.split(',').map((item) => item.trim())) {
          if (!columns.has(column)) problems.push(`${record.target.name} select ${column}`);
        }
      }
      if (record.target.kind === 'table' && (op.op === 'eq' || op.op === 'order') && !(tables.get(record.target.name) ?? new Set()).has(payload)) {
        problems.push(`${record.target.name} filter ${payload}`);
      }
    }
  }
  assert.deepEqual(problems, [], 'every name the backend uses is in the schema');
  assert.ok(stand.calls.length > 40, 'the battery reached the database calls');
  // The schema reader itself: if it stops finding these, the check above would pass for the wrong reasons.
  assert.ok(tables.size >= 10 && tables.get('profiles').has('avatar_updated_at') && tables.get('attempts').has('answers'));
  assert.ok(functions.has('list_friends') && functions.has('search_people'));
});

test('attempts are listed and counted for the signed-in person only, optionally by kind', async () => {
  const stand = recordingClient();
  const backend = backendFor(stand.client);
  await backend.listAttempts(10, 'diagnostic');
  const listed = stand.calls.at(-1);
  assert.deepEqual(listed.target, { kind: 'table', name: 'attempts' });
  assert.ok(listed.ops.some((op) => op.op === 'eq' && op.args[0] === 'user_id' && op.args[1] === USER), 'filtered by the signed-in person');
  assert.ok(listed.ops.some((op) => op.op === 'eq' && op.args[0] === 'kind' && op.args[1] === 'diagnostic'), 'filtered by kind');
  assert.ok(listed.ops.some((op) => op.op === 'limit' && op.args[0] === 10));

  await backend.listAttempts(10);
  assert.ok(!stand.calls.at(-1).ops.some((op) => op.op === 'eq' && op.args[0] === 'kind'), 'no kind filter when none is given');

  assert.equal(await backend.countAttempts('diagnostic'), 3);
  const counted = stand.calls.at(-1);
  assert.ok(counted.ops.some((op) => op.op === 'select' && op.args[1].count === 'exact' && op.args[1].head === true), 'counts on the server');
});

test('a taken username and a repeated friend request are explained in words the person can read', async () => {
  const stand = recordingClient();
  const backend = backendFor(stand.client);
  stand.failNext({ code: '23505', message: 'duplicate key value violates unique constraint' });
  const taken = await backend.updateProfile({ username: 'ana' }).catch((error) => error);
  assert.equal(errorText(taken), 'That username is taken. Try another one.');

  stand.failNext({ code: '23505', message: 'duplicate key' });
  const repeated = await backend.requestFriend(OTHER).catch((error) => error);
  assert.equal(errorText(repeated), 'You already have a request or friendship with this person.');

  stand.setSession(null);
  const expired = await backend.getProfile().catch((error) => error);
  assert.equal(errorText(expired), 'Your session has expired. Sign in again to continue.');
});

test('a message from the database that is not written for the person is not shown as it is', () => {
  assert.equal(errorText(new Error('permission denied for table attempts')), 'Something went wrong. Please try again.');
  assert.equal(errorText(userErrorFn('Saved.')), 'Saved.');
});

test('a picture and a library file are stored in the signed-in person\'s folder, with their own type', async () => {
  const stand = recordingClient();
  const backend = backendFor(stand.client);
  await backend.setAvatar(blob('image/webp'));
  const upload = stand.calls.find((record) => record.target.name === 'avatars');
  const avatarUpload = upload.ops.find((op) => op.op === 'upload');
  assert.equal(avatarUpload.args[0], `${USER}/avatar.webp`);
  assert.equal(avatarUpload.args[2].contentType, 'image/webp');

  const more = recordingClient();
  const other = backendFor(more.client);
  await other.addLibraryFile({ id: 'f9', name: 'notes.md', kind: 'md', mime_type: 'text/html', blob: blob('text/markdown'), extracted_text: '# A', pages: null });
  const libraryUpload = more.calls.find((record) => record.target.name === 'library').ops.find((op) => op.op === 'upload');
  assert.equal(libraryUpload.args[0], `${USER}/f9.md`);
  assert.equal(libraryUpload.args[2].contentType, 'text/markdown', 'the type comes from the kind, not from the caller');
  const row = more.calls.find((record) => record.target.name === 'library_files').ops.find((op) => op.op === 'insert');
  assert.equal(row.args[0].mime_type, 'text/markdown');
  assert.equal(row.args[0].user_id, USER);
});

test('shared notes are at most 280 characters, and coach messages at most 8000', async () => {
  const stand = recordingClient();
  const backend = backendFor(stand.client);
  await backend.sendShare({ recipientId: OTHER, kind: 'result', attemptId: 'a1', note: 'x'.repeat(400) });
  const share = stand.calls.find((record) => record.target.name === 'shares').ops.find((op) => op.op === 'insert');
  assert.equal(share.args[0].note.length, 280);
  await backend.addTutor('user', 'y'.repeat(9000));
  const message = stand.calls.findLast((record) => record.target.name === 'tutor_messages').ops.find((op) => op.op === 'insert');
  assert.equal(message.args[0].content.length, 8000);
});

test('deleting a library file also removes its bytes from storage', async () => {
  const stand = recordingClient();
  const backend = backendFor(stand.client);
  stand.setSingle('library_files', { storage_path: `${USER}/f1.pdf` });
  await backend.deleteLibraryFile('f1');
  assert.deepEqual(
    stand.calls.map((record) => record.target.kind),
    ['table', 'table', 'bucket'],
    'read the path, delete the row, then remove the bytes',
  );
  assert.ok(opsOf(stand.calls[1]).includes('delete'));
  assert.ok(opsOf(stand.calls[2]).includes('remove'));
});

test('accepting a request marks it accepted, and declining removes it', async () => {
  const stand = recordingClient();
  const backend = backendFor(stand.client);
  await backend.answerFriend('f1', true);
  const accepted = stand.calls.at(-1).ops.find((op) => op.op === 'update');
  assert.equal(accepted.args[0].status, 'accepted');
  await backend.answerFriend('f1', false);
  assert.ok(stand.calls.at(-1).ops.some((op) => op.op === 'delete'));
});

test('progress is saved per person and lesson, and skill scores are whole numbers', async () => {
  const stand = recordingClient();
  const backend = backendFor(stand.client);
  await backend.upsertLessonProgress({ lesson_id: 'a1-u1-l1', stars: 2, best_pct: 80, attempts: 1, completed_at: null });
  const lesson = stand.calls.at(-1);
  assert.equal(lesson.target.name, 'lesson_progress');
  assert.equal(lesson.ops.find((op) => op.op === 'upsert').args[0].user_id, USER);
  assert.equal(lesson.ops.find((op) => op.op === 'upsert').args[1].onConflict, 'user_id,lesson_id');

  await backend.setSkillScores({ reading: 70.4 });
  const skill = stand.calls.at(-1).ops.find((op) => op.op === 'upsert').args[0][0];
  assert.equal(skill.score, 70);
  assert.equal(skill.user_id, USER);
});
