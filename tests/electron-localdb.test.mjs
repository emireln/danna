// Tests the offline database module (electron/localdb.cjs) on a real SQLite file: the actions the interface
// may call, the limits it enforces, and what it refuses. Electron is stood in for by a small module, so the
// module runs under plain Node exactly as it does in the app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const localdbPath = join(here, '..', 'electron', 'localdb.cjs');
const electronPath = require.resolve('electron');

function loadLocalDb(folder) {
  require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { app: { getPath: () => folder } },
  };
  delete require.cache[localdbPath];
  return require(localdbPath);
}

function withDatabase(run) {
  const folder = mkdtempSync(join(tmpdir(), 'danna-localdb-'));
  try {
    return run(loadLocalDb(folder));
  } finally {
    // Windows keeps the file open while the process runs, so cleanup is best effort.
    try {
      rmSync(folder, { recursive: true, force: true });
    } catch {
      // The system cleans up the temporary folder later.
    }
  }
}

const bytesOf = (text) => new TextEncoder().encode(text).buffer;
// A WebP file starts with RIFF, a size, then WEBP. The rest is padding for these tests.
const webpOf = (length) => {
  const head = Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ', 'latin1');
  return Buffer.concat([head, Buffer.alloc(Math.max(0, length - head.length))]);
};
// The bytes of a Buffer as their own ArrayBuffer, the way the interface sends them.
const arrayBufferOf = (buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const userMessage = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error.message.includes('@@user@@') ? error.message.replace('@@user@@', '') : `internal: ${error.message}`;
  }
};

test('the interface can only call the listed actions', () => {
  withDatabase((local) => {
    assert.equal(local.call('getProfile').goal, 'english');
    for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'deleteEverything', '']) {
      assert.equal(userMessage(() => local.call(name, [])), 'That action is not available right now.', `"${name}" is refused`);
    }
  });
});

test('attempts keep a bounded copy of the answers and only known skills', () => {
  withDatabase((local) => {
    const answers = Array.from({ length: 400 }, (_, index) => ({
      id: `q${index}`,
      skill: index === 0 ? 'mixed' : 'reading',
      fraction: index === 0 ? 7 : 1,
      response: index === 1 ? 'x'.repeat(5000) : index === 2 ? ['a', 'b'] : 3,
    }));
    const row = local.call('insertAttempt', [
      {
        kind: 'surprise',
        ref_id: 'lesson-a1',
        title: 'A test',
        score_pct: 140,
        predicted: null,
        skills: { reading: 150, mixed: 9, writing: -4 },
        answers,
        duration_s: 99999999,
      },
    ]);
    assert.equal(row.kind, 'practice', 'an unknown kind becomes practice');
    assert.equal(row.score_pct, 100);
    assert.equal(row.duration_s, 86400);
    assert.deepEqual(row.skills, { reading: 100, writing: 0 });
    assert.equal(row.answers.length, 300, 'at most 300 answers are kept');
    assert.equal(row.answers[0].fraction, 1, 'a fraction stays between 0 and 1');
    assert.equal(row.answers[0].skill, 'language', 'an unknown skill is replaced');
    assert.equal(row.answers[1].response.length, 2000, 'a long answer is cut');
    assert.deepEqual(row.answers[2].response, ['a', 'b']);
  });
});

test('attempts can be listed and counted by kind', () => {
  withDatabase((local) => {
    const base = { ref_id: 'r', title: 'T', score_pct: 50, skills: {}, answers: [], duration_s: 1 };
    local.call('insertAttempt', [{ ...base, kind: 'diagnostic', created_at: '2026-01-01T00:00:00.000Z' }]);
    local.call('insertAttempt', [{ ...base, kind: 'lesson', created_at: '2026-01-02T00:00:00.000Z' }]);
    local.call('insertAttempt', [{ ...base, kind: 'diagnostic', created_at: '2026-01-03T00:00:00.000Z' }]);
    assert.equal(local.call('listAttempts', [10]).length, 3);
    const diagnostics = local.call('listAttempts', [10, 'diagnostic']);
    assert.deepEqual(
      diagnostics.map((attempt) => attempt.created_at),
      ['2026-01-03T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      'newest first',
    );
    assert.equal(local.call('countAttempts', ['diagnostic']), 2);
    assert.equal(local.call('countAttempts', ['lesson']), 1);
    assert.equal(local.call('countAttempts', ['nonsense']), 0);
    assert.equal(local.call('listAttempts', [10, 'nonsense']).length, 3, 'an unknown filter is ignored');
  });
});

test('an attempt keeps a valid time, and a broken one gets the current time', () => {
  withDatabase((local) => {
    const row = local.call('insertAttempt', [
      { kind: 'lesson', ref_id: 'r', title: 'T', score_pct: 1, skills: {}, answers: [], duration_s: 0, created_at: 'soon' },
    ]);
    assert.ok(!Number.isNaN(Date.parse(row.created_at)), 'the stored time is a real date');
    assert.notEqual(row.created_at, 'soon');
  });
});

test('library files take their type from their kind, not from the caller', () => {
  withDatabase((local) => {
    const file = local.call('insertLibraryFile', [
      { kind: 'txt', name: 'notes.txt', mime_type: 'text/html', data: bytesOf('hello'), extracted_text: 'hello', pages: null },
    ]);
    assert.equal(file.mime_type, 'text/plain');
    assert.equal(file.size_bytes, 5);
    assert.equal(userMessage(() => local.call('insertLibraryFile', [{ kind: 'exe', data: bytesOf('x') }])), 'Only PDF, TXT and Markdown files can be kept in the library.');
    assert.equal(userMessage(() => local.call('insertLibraryFile', [{ kind: 'md', data: new ArrayBuffer(0) }])), 'That file is too large. Choose one under 20 MB.');
  });
});

test('library links must be https, and an empty patch changes nothing', () => {
  withDatabase((local) => {
    assert.equal(userMessage(() => local.call('insertLibraryLink', [{ url: 'http://example.com' }])), 'Paste a web link that starts with https://.');
    assert.equal(userMessage(() => local.call('insertLibraryLink', [{ url: 'javascript:alert(1)' }])), 'Paste a web link that starts with https://.');
    const link = local.call('insertLibraryLink', [{ url: 'https://example.com/a', title: 'A', category: 'Reading', note: 'n' }]);
    const unchanged = local.call('updateLibraryLink', [link.id, null]);
    assert.deepEqual([unchanged.title, unchanged.category, unchanged.note], ['A', 'Reading', 'n'], 'a null patch leaves the link as it was');
    const renamed = local.call('updateLibraryLink', [link.id, { title: 'B' }]);
    assert.equal(renamed.title, 'B');
    assert.equal(renamed.category, 'Reading');
    assert.equal(renamed.note, 'n');
    assert.equal(userMessage(() => local.call('updateLibraryLink', ['missing', {}])), 'That link is no longer in your library.');
  });
});

test('review items are checked before they are kept', () => {
  withDatabase((local) => {
    const question = { id: 'q1', type: 'choice', prompt: 'Pick one', options: ['a', 'b', 'c'], answer: 0, skill: 'reading' };
    local.call('upsertReviewItems', [
      [
        { item_key: 'ok', skill: 'reading', payload: { question }, ease: 9, interval_days: -4, reps: 2, due_at: 'later' },
        { item_key: 'bad-skill', skill: 'mixed', payload: { question }, ease: 2.5, due_at: '2026-02-01T00:00:00.000Z' },
        { item_key: 'no-question', skill: 'reading', payload: { prompt: 'x' }, due_at: '2026-02-01T00:00:00.000Z' },
        { skill: 'reading', payload: { question }, due_at: '2026-02-01T00:00:00.000Z' },
        null,
      ],
    ]);
    const rows = local.call('listReviewItems');
    assert.deepEqual(rows.map((row) => row.item_key).sort(), ['bad-skill', 'ok']);
    const ok = rows.find((row) => row.item_key === 'ok');
    assert.equal(ok.ease, 5, 'ease is kept between 1.3 and 5');
    assert.equal(ok.interval_days, 0);
    assert.ok(!Number.isNaN(Date.parse(ok.due_at)), 'a broken due time becomes a real date');
    assert.equal(rows.find((row) => row.item_key === 'bad-skill').skill, 'language');
    assert.equal(rows.find((row) => row.item_key === 'ok').payload.question.prompt, 'Pick one');
  });
});

test('coach messages keep a valid time and a known role', () => {
  withDatabase((local) => {
    const kept = local.call('addTutor', ['system', 'hi', 'message-1', 'yesterday']);
    assert.equal(kept.role, 'user', 'an unknown role becomes a user message');
    assert.ok(!Number.isNaN(Date.parse(kept.created_at)));
    local.call('addTutor', ['assistant', 'copy', 'message-1', '2026-03-01T10:00:00.000Z']);
    const messages = local.call('listTutor', [40]);
    assert.equal(messages.length, 1, 'a message with a known id is not added again');
    assert.equal(messages[0].content, 'hi', 'the first copy is the one that stays');
    local.call('clearTutor');
    assert.equal(local.call('listTutor', [40]).length, 0);
  });
});

test('lesson progress needs a lesson, and its numbers stay in range', () => {
  withDatabase((local) => {
    assert.equal(userMessage(() => local.call('upsertLessonProgress', [{ stars: 3 }])), 'That lesson could not be saved.');
    local.call('upsertLessonProgress', [{ lesson_id: 'a1-u1-l1', stars: 9, best_pct: -5, attempts: 2, completed_at: null }]);
    const [row] = local.call('listLessonProgress');
    assert.equal(row.lesson_id, 'a1-u1-l1');
    assert.equal(row.stars, 3);
    assert.equal(row.best_pct, 0);
  });
});

test('practice sets have a size limit and a known skill and level', () => {
  withDatabase((local) => {
    const set = local.call('insertTest', [
      { title: 'Set', kind: 'ai', skill: 'nonsense', level: 'Z9', minutes: 999, content: { passages: [], questions: [] } },
    ]);
    assert.equal(set.skill, 'mixed');
    assert.equal(set.level, 'B1');
    assert.equal(set.minutes, 240);
    const big = { passages: [{ id: 'p', title: 't', text: 'x'.repeat(250000) }], questions: [] };
    assert.equal(userMessage(() => local.call('insertTest', [{ title: 'Big', kind: 'custom', skill: 'reading', level: 'A1', minutes: 5, content: big }])), 'That practice set is too large to keep.');
  });
});

test('profile values stay within their limits, and XP never goes down', () => {
  withDatabase((local) => {
    local.call('updateProfile', [{ xp: 50 }]);
    assert.equal(local.call('updateProfile', [{ xp: 20 }]).xp, 50, 'XP never goes down');
    const profile = local.call('updateProfile', [{ daily_minutes: 999, target_score: 5, level: 'Z9', goal: 'other', avatar_color: 'red', exam_date: 'soon', streak: -3 }]);
    assert.equal(profile.daily_minutes, 180);
    assert.equal(profile.target_score, 60);
    assert.equal(profile.level, 'B1');
    assert.equal(profile.goal, 'english');
    assert.equal(profile.avatar_color, '#2f6bff');
    assert.equal(profile.exam_date, null);
    assert.equal(profile.streak, 0);
    assert.equal(userMessage(() => local.call('updateProfile', [{ username: 'Bad Name' }])), 'Usernames use 3 to 20 lowercase letters, numbers or underscores.');
    assert.equal(local.call('updateProfile', [{ username: 'ana_01' }]).username, 'ana_01');
  });
});

test('profile pictures must be WebP and at most 300 KB', () => {
  withDatabase((local) => {
    assert.equal(userMessage(() => local.call('setAvatar', [bytesOf('not an image at all')])), 'That picture could not be saved. Try another one.');
    assert.equal(userMessage(() => local.call('setAvatar', [arrayBufferOf(webpOf(301 * 1024))])), 'That picture is too large. Choose a smaller one.');
    const saved = local.call('setAvatar', [arrayBufferOf(webpOf(2048))]);
    assert.ok(saved.avatar_updated_at, 'the picture has a version');
    assert.equal(local.call('getAvatar').length, 2048);
    const cleared = local.call('clearAvatar');
    assert.equal(cleared.avatar_updated_at, null);
    assert.equal(local.call('getAvatar'), null);
  });
});

test('skill scores keep only the five skills, from 0 to 100', () => {
  withDatabase((local) => {
    local.call('setSkillScores', [{ reading: 150, mixed: 5, writing: -3 }]);
    assert.deepEqual(local.call('getSkillScores'), { reading: 100, writing: 0 });
  });
});
