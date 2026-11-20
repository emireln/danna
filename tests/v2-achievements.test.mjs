// The achievements (2.0.0): each one unlocks at its need and shows its count capped at the need; the counts come
// from the profile, the lessons finished and the runs saved (flashcard sessions, writing checks and role-play).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
let server;
let achievementsOf;
let statsOf;
let ACHIEVEMENT_IDS;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  ({ achievementsOf, statsOf, ACHIEVEMENT_IDS } = await server.ssrLoadModule('/src/lib/achievements.ts'));
});

after(async () => {
  await server?.close();
});

const zero = {
  streak: 0,
  xp: 0,
  lessonsDone: 0,
  lessonsAndTests: 0,
  flashcardsStudied: 0,
  writingChecks: 0,
  roleplays: 0,
  decks: 0,
  savedWords: 0,
};

const byId = (items, id) => items.find((item) => item.id === id);

test('there are ten achievements, and none is unlocked with nothing done', () => {
  const items = achievementsOf(zero);
  assert.equal(items.length, 10);
  assert.equal(ACHIEVEMENT_IDS.length, 10);
  assert.ok(items.every((item) => !item.unlocked && item.value === 0));
});

test('each achievement unlocks at its need, and its count never shows more than the need', () => {
  const almost = achievementsOf({ ...zero, streak: 6, xp: 999, lessonsDone: 24 });
  assert.equal(byId(almost, 'on-a-roll').unlocked, false);
  assert.equal(byId(almost, 'on-a-roll').value, 6);
  assert.equal(byId(almost, 'thousand-club').unlocked, false);
  assert.equal(byId(almost, 'lesson-master').unlocked, false);

  const done = achievementsOf({ ...zero, streak: 45, xp: 1500, lessonsDone: 30 });
  assert.equal(byId(done, 'on-a-roll').unlocked, true);
  assert.equal(byId(done, 'unstoppable').unlocked, true);
  assert.equal(byId(done, 'thousand-club').value, 1000, 'the count is capped at the need');
  assert.equal(byId(done, 'lesson-master').value, 25);
});

test('the statistics come from the runs, the lessons and the profile', () => {
  const runs = [
    { ref_id: 'flashcards', kind: 'practice', answers: Array.from({ length: 12 }, () => ({})) },
    { ref_id: 'writing-check', kind: 'practice', answers: [] },
    { ref_id: 'writing-check', kind: 'practice', answers: [] },
    { ref_id: 'roleplay-cafe', kind: 'practice', answers: [] },
    { ref_id: 'a1-u1-l1', kind: 'lesson', answers: [] },
    { ref_id: 'review', kind: 'review', answers: [] },
  ];
  const lessons = [
    { lesson_id: 'a', completed_at: '2026-11-01T10:00:00.000Z' },
    { lesson_id: 'b', completed_at: null },
  ];
  const stats = statsOf({ profile: { streak: 3, xp: 80 }, lessons, runs, decks: 1, savedWords: 4 });
  assert.equal(stats.flashcardsStudied, 12);
  assert.equal(stats.writingChecks, 2);
  assert.equal(stats.roleplays, 1);
  assert.equal(stats.lessonsAndTests, 1, 'a review is not a lesson or a test');
  assert.equal(stats.lessonsDone, 1);
  assert.equal(stats.streak, 3);
  assert.equal(stats.xp, 80);
  assert.equal(stats.decks, 1);
  assert.equal(stats.savedWords, 4);
});

test('a missing profile counts as nothing, not as an error', () => {
  const stats = statsOf({ profile: null, lessons: [], runs: [], decks: 0, savedWords: 0 });
  assert.deepEqual(stats, zero);
});
