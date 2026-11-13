// The day streak: it counts on the day after the last study day, and the flame changes at 10 and 50 days.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
});

after(async () => {
  await server?.close();
});

test('the streak counts on the day after the last study day, and not after that', async () => {
  const { activeStreak } = await server.ssrLoadModule('/src/lib/progress.ts');
  assert.equal(activeStreak({ streak: 4, last_active: '2026-03-10' }, '2026-03-10'), 4, 'studied today');
  assert.equal(activeStreak({ streak: 4, last_active: '2026-03-09' }, '2026-03-10'), 4, 'studied yesterday, so the streak is alive');
  assert.equal(activeStreak({ streak: 4, last_active: '2026-03-08' }, '2026-03-10'), 0, 'a day was missed');
  assert.equal(activeStreak({ streak: 0, last_active: '2026-03-10' }, '2026-03-10'), 0);
  assert.equal(activeStreak({ streak: 4, last_active: null }, '2026-03-10'), 0);
  assert.equal(activeStreak({ streak: 2, last_active: '2026-02-28' }, '2026-03-01'), 2, 'the day before the first of a month');
});

test('the flame changes at 10 days and again at 50 days', async () => {
  const { streakTier } = await server.ssrLoadModule('/src/lib/progress.ts');
  assert.equal(streakTier(1), 'ember');
  assert.equal(streakTier(9), 'ember');
  assert.equal(streakTier(10), 'blaze');
  assert.equal(streakTier(49), 'blaze');
  assert.equal(streakTier(50), 'inferno');
  assert.equal(streakTier(365), 'inferno');
});
