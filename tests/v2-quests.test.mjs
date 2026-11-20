// The daily goal and the quests (2.0.0): what counts as a lesson, a flashcard, a minute, and the day it falls on.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
let server;
let dayActivity;
let questsOf;
let goalOf;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  ({ dayActivity, questsOf, goalOf } = await server.ssrLoadModule('/src/lib/quests.ts'));
});

after(async () => {
  await server?.close();
});

const pad = (value) => String(value).padStart(2, '0');
const dayOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const today = new Date();
const todayKey = dayOf(today);
const at = (date, hour) => {
  const moment = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0);
  return moment.toISOString();
};
const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

const run = (overrides) => ({
  id: 'run',
  user_id: 'u',
  kind: 'practice',
  ref_id: 'reading-1',
  title: 'Practice',
  score_pct: 80,
  predicted: null,
  skills: {},
  answers: [],
  duration_s: 60,
  xp: 0,
  created_at: at(today, 10),
  ...overrides,
});

test('a lesson or a test finished today counts as one; a review, a flashcard session, a writing check and a role-play do not', () => {
  const runs = [
    run({ id: 'lesson', kind: 'lesson', ref_id: 'a1-u1-l1' }),
    run({ id: 'review', kind: 'review', ref_id: 'review' }),
    run({ id: 'cards', ref_id: 'flashcards', answers: Array.from({ length: 7 }, () => ({ id: 'c', skill: 'language', fraction: 1, response: null })) }),
    run({ id: 'writing', ref_id: 'writing-check' }),
    run({ id: 'talk', ref_id: 'roleplay-cafe' }),
  ];
  const activity = dayActivity(runs, todayKey);
  assert.equal(activity.lessonsAndTests, 1);
  assert.equal(activity.flashcards, 7);
});

test('only today counts: yesterday\'s runs are left out of the day', () => {
  const runs = [run({ id: 'old', kind: 'lesson', ref_id: 'a1-u1-l1', duration_s: 600, created_at: at(yesterday, 18) })];
  assert.deepEqual(dayActivity(runs, todayKey), { lessonsAndTests: 0, flashcards: 0, minutes: 0 });
});

test('minutes are whole minutes of practice, and a negative duration counts as none', () => {
  const runs = [run({ duration_s: 400 }), run({ duration_s: 500 }), run({ duration_s: -30 })];
  assert.equal(dayActivity(runs, todayKey).minutes, 15);
});

test('the three quests carry their targets, and a quest never shows more than its target', () => {
  const quests = questsOf({ lessonsAndTests: 3, flashcards: 4, minutes: 9 });
  assert.deepEqual(
    quests.map((item) => [item.id, item.target, item.progress, item.done]),
    [
      ['lesson', 1, 1, true],
      ['flashcards', 10, 4, false],
      ['minutes', 5, 5, true],
    ],
  );
});

test('the daily goal is the share reached, capped at 100, and done when the minutes reach it', () => {
  assert.deepEqual(goalOf(0, 15), { percent: 0, done: false });
  assert.deepEqual(goalOf(6, 15), { percent: 40, done: false });
  assert.deepEqual(goalOf(15, 15), { percent: 100, done: true });
  assert.deepEqual(goalOf(30, 15), { percent: 100, done: true });
  assert.deepEqual(goalOf(3, 0), { percent: 100, done: true }, 'a goal under one minute counts as one');
});
