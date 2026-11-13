// Runs the same scenario through the two offline backends and checks that they give the same answers:
// the desktop backend (sqliteBackend, calling the real electron/localdb.cjs the way the app does) and the
// browser preview (localBackend). Ids and the stored owner are left out of the comparison, and anything
// that depends on the current moment is written as a placeholder. A difference in a rule shows up here.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const localdbPath = join(root, 'electron', 'localdb.cjs');
const electronPath = require.resolve('electron');

let server;
let createSqliteBackend;
let createLocalBackend;
const folders = [];

// A fresh desktop database in its own folder, loaded the way the app loads it.
function freshDesktopDatabase() {
  const folder = mkdtempSync(join(tmpdir(), 'danna-parity-'));
  folders.push(folder);
  require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { app: { getPath: () => folder } },
  };
  delete require.cache[localdbPath];
  return require(localdbPath);
}

// A stand-in for the browser's storage, one per run.
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  ({ createSqliteBackend } = await server.ssrLoadModule('/src/lib/data/sqliteBackend.ts'));
  ({ createLocalBackend } = await server.ssrLoadModule('/src/lib/data/localBackend.ts'));
});

after(async () => {
  delete globalThis.window;
  await server?.close();
  for (const folder of folders) {
    try {
      rmSync(folder, { recursive: true, force: true });
    } catch {
      // The system cleans up the temporary folder later.
    }
  }
});

const desktopBackend = () => {
  const localdb = freshDesktopDatabase();
  return createSqliteBackend({ local: { call: async (method, args = []) => localdb.call(method, args) } });
};

const previewBackend = () => {
  globalThis.window = { localStorage: memoryStorage() };
  return createLocalBackend();
};

const ANSWERS = Array.from({ length: 320 }, (_, index) => ({
  id: `q${index}`,
  skill: index === 0 ? 'mixed' : 'reading',
  fraction: index === 0 ? 7 : 1,
  response: index === 1 ? 'x'.repeat(5000) : index === 2 ? ['a', 'b'] : 3,
}));

const webp = (length) => {
  const head = Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ', 'latin1');
  return new Blob([Buffer.concat([head, Buffer.alloc(length - head.length)])], { type: 'image/webp' });
};

// Makes two runs comparable: ids and the owner are dropped, the random learner name and the moment of
// creation are replaced, and everything else must match exactly.
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === 'id' || key === 'user_id' || key === 'owner_id') continue;
      if (key === 'updated_at') out[key] = '<now>';
      else if (key === 'avatar_updated_at') out[key] = item ? '<now>' : null;
      else if (key === 'created_at' && 'avatar_color' in value) out[key] = '<now>';
      else if (key === 'username' && typeof item === 'string' && item.startsWith('learner')) out[key] = '<learner>';
      else out[key] = normalize(item);
    }
    return out;
  }
  return value;
}

const byKey = (field) => (a, b) => String(a[field]).localeCompare(String(b[field]));

// The scenario: the same calls, in the same order, on any backend. Each step records its answer or its message.
async function scenario(backend) {
  const log = [];
  const step = async (name, action) => {
    try {
      log.push({ step: name, value: normalize(await action()) });
    } catch (error) {
      log.push({ step: name, error: error.message.replace('@@user@@', '') });
    }
  };

  await step('profile starts', () => backend.getProfile());
  await step('xp grows', async () => {
    await backend.updateProfile({ xp: 50 });
    return backend.updateProfile({ xp: 20 });
  });
  await step('profile values are kept in range', () =>
    backend.updateProfile({
      daily_minutes: 999,
      target_score: 5,
      level: 'Z9',
      goal: 'other',
      avatar_color: 'red',
      exam_date: '2026-05-01',
      streak: -3,
      display_name: 'Ana',
    }),
  );
  await step('a bad username is refused', () => backend.updateProfile({ username: 'Bad Name' }));
  await step('a good username is kept', () => backend.updateProfile({ username: 'ana_01' }));

  const attempt = {
    id: 'attempt-1',
    kind: 'diagnostic',
    ref_id: 'diagnostic',
    title: 'Level check',
    score_pct: 140,
    predicted: 130,
    skills: { reading: 150, mixed: 9, writing: -4 },
    answers: ANSWERS,
    duration_s: 99999,
    created_at: '2026-03-01T10:00:00.000Z',
  };
  await step('an attempt is saved', () => backend.insertAttempt(attempt));
  await step('saving the same attempt again keeps the first copy', () => backend.insertAttempt({ ...attempt, score_pct: 10 }));
  await step('an unknown kind becomes practice', () =>
    backend.insertAttempt({ ...attempt, id: 'attempt-2', kind: 'surprise', created_at: '2026-03-02T10:00:00.000Z' }),
  );
  await step('attempts can be listed', () => backend.listAttempts(10));
  await step('attempts of one kind are listed', () => backend.listAttempts(10, 'diagnostic'));
  await step('attempts of one kind are counted', () => backend.countAttempts('diagnostic'));
  await step('an unknown kind is counted as none', () => backend.countAttempts('nonsense'));

  await step('skill scores keep known skills in range', async () => {
    await backend.setSkillScores({ reading: 150, mixed: 5, writing: -3 });
    return backend.getSkillScores();
  });

  await step('a lesson is recorded', async () => {
    await backend.upsertLessonProgress({ lesson_id: 'a1-u1-l1', stars: 9, best_pct: -5, attempts: 2, completed_at: null });
    return (await backend.listLessonProgress()).slice().sort(byKey('lesson_id'));
  });
  await step('a lesson without an id is refused', () => backend.upsertLessonProgress({ stars: 1 }));
  await step('several lessons are saved together', async () => {
    await backend.upsertLessonProgressMany([
      { lesson_id: 'b1-u1-l1', stars: 1, best_pct: 80, attempts: 0, completed_at: '2026-03-06T10:00:00.000Z' },
      { lesson_id: 'b1-u1-l2', stars: 2, best_pct: 90, attempts: 0, completed_at: '2026-03-06T10:00:00.000Z' },
    ]);
    return (await backend.listLessonProgress()).slice().sort(byKey('lesson_id'));
  });
  await step('a set of lessons with one refused row saves nothing', async () => {
    await backend.upsertLessonProgressMany([{ lesson_id: 'c1-u1-l1', stars: 1 }, { stars: 2 }]);
    return (await backend.listLessonProgress()).slice().sort(byKey('lesson_id'));
  });

  await step('review items are checked', async () => {
    const question = { id: 'q1', type: 'choice', prompt: 'Pick one', options: ['a', 'b', 'c'], answer: 0, skill: 'reading' };
    await backend.upsertReviewItems([
      { item_key: 'ok', skill: 'reading', payload: { question }, ease: 9, interval_days: -4, reps: 2, due_at: '2026-02-01T00:00:00.000Z' },
      { item_key: 'bad-skill', skill: 'mixed', payload: { question }, ease: 2.5, interval_days: 1, reps: 0, due_at: '2026-02-02T00:00:00.000Z' },
      { item_key: 'no-question', skill: 'reading', payload: { prompt: 'x' }, ease: 2.5, interval_days: 0, reps: 0, due_at: '2026-02-03T00:00:00.000Z' },
    ]);
    return (await backend.listReviewItems()).slice().sort(byKey('item_key'));
  });

  await step('coach chats keep their names, archive state and messages', async () => {
    await backend.createTutorChat({ id: 'c1', created_at: '2026-03-03T08:59:00.000Z' });
    await backend.createTutorChat({ id: 'c2', created_at: '2026-03-03T08:58:00.000Z' });
    await backend.renameTutorChat('c1', 'Verb tenses');
    await backend.setTutorChatArchived('c2', true);
    await backend.addTutor('c1', 'user', 'hi', {
      id: 'm1',
      created_at: '2026-03-03T09:00:00.000Z',
      attachments: [{ name: 'notes.pdf', kind: 'document', size: 42 }],
    });
    await backend.addTutor('c1', 'system', 'yo', { id: 'm2', created_at: '2026-03-03T09:01:00.000Z' });
    await backend.addTutor('c1', 'assistant', 'copy', { id: 'm1', created_at: '2026-03-03T09:00:00.000Z' });
    const chats = (await backend.listTutorChats()).map(({ id, title, archived }) => ({ id, title, archived }));
    return {
      chats,
      messages: await backend.listTutor('c1', 40),
      elsewhere: await backend.listTutor('c2', 40),
      byName: await backend.searchTutorChats('VERB TENSES'),
      byMessage: await backend.searchTutorChats('yo'),
    };
  });
  await step('a deleted coach chat takes its messages with it', async () => {
    await backend.deleteTutorChat('c1');
    return {
      chats: (await backend.listTutorChats()).map((chat) => chat.id),
      messages: await backend.listTutor('c1', 40),
    };
  });

  await step('a practice set is saved within its limits', async () => {
    await backend.insertTest({
      id: 't1',
      title: 'Set',
      description: 'A set',
      kind: 'ai',
      skill: 'nonsense',
      level: 'Z9',
      minutes: 999,
      content: { passages: [], questions: [] },
      created_at: '2026-03-04T10:00:00.000Z',
    });
    return backend.listMyTests();
  });
  await step('a practice set that is too large is refused', () =>
    backend.insertTest({
      title: 'Big',
      description: '',
      kind: 'custom',
      skill: 'reading',
      level: 'A1',
      minutes: 5,
      content: { passages: [{ id: 'p', title: 't', text: 'x'.repeat(250000) }], questions: [] },
    }),
  );

  await step('a link must be https', () => backend.addLibraryLink({ url: 'http://example.com', title: '', platform: 'other', category: 'General', note: '' }));
  await step('a link is saved', async () => {
    await backend.addLibraryLink({
      id: 'l1',
      url: 'https://example.com/a',
      title: 'A',
      platform: 'youtube',
      category: 'Reading',
      note: 'n',
      created_at: '2026-03-05T10:00:00.000Z',
    });
    return backend.listLibraryLinks();
  });
  await step('a link keeps its fields when the patch is empty', () => backend.updateLibraryLink('l1', null));
  await step('a link can be renamed', () => backend.updateLibraryLink('l1', { title: 'B' }));
  await step('a missing link is reported', () => backend.updateLibraryLink('missing', {}));

  await step('a picture must be WebP', () => backend.setAvatar(new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])])));
  await step('a WebP picture is saved', async () => {
    const profile = await backend.setAvatar(webp(2048));
    const picture = await backend.getAvatar();
    return { profile, pictureBytes: picture ? picture.size : null };
  });
  await step('a picture is removed', async () => {
    const profile = await backend.setAvatar(null);
    return { profile, picture: await backend.getAvatar() };
  });

  await step('friends are not available offline', () => backend.requestFriend('someone'));
  await step('friends list is empty offline', () => backend.listFriends());
  await step('the profile at the end', () => backend.getProfile());
  return log;
}

test('the desktop and the browser preview give the same answers for the same calls', async () => {
  const desktop = await scenario(desktopBackend());
  const preview = await scenario(previewBackend());
  assert.deepEqual(preview, desktop);
});

test('both offline backends offer the same methods', () => {
  const desktop = Object.keys(desktopBackend()).sort();
  const preview = Object.keys(previewBackend()).sort();
  assert.deepEqual(preview, desktop);
});

test('the scenario really reaches the rules: the refusals and the clamps are in the log', async () => {
  const log = await scenario(desktopBackend());
  const find = (name) => log.find((entry) => entry.step === name);
  assert.equal(find('a bad username is refused').error, 'Usernames use 3 to 20 lowercase letters, numbers or underscores.');
  assert.equal(find('a lesson without an id is refused').error, 'That lesson could not be saved.');
  assert.equal(find('a link must be https').error, 'Paste a web link that starts with https://.');
  assert.equal(find('a missing link is reported').error, 'That link is no longer in your library.');
  assert.equal(find('a picture must be WebP').error, 'That picture could not be saved. Try another one.');
  assert.equal(find('an attempt is saved').value.score_pct, 100);
  assert.equal(find('xp grows').value.xp, 50);
  assert.equal(find('a WebP picture is saved').value.pictureBytes, 2048);
});
