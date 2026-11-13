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

test('the flame shows its tier, the halo and sparks from 50 days, the day count, and nothing without a streak', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StreakFire } = await server.ssrLoadModule('/src/components/StreakFire.tsx');
  const html = (days) => renderToStaticMarkup(createElement(StreakFire, { days }));

  assert.equal(html(0), '', 'no streak, no flame');
  assert.match(html(3), /streak--ember/);
  assert.match(html(12), /streak--blaze/);
  assert.doesNotMatch(html(12), /streak__halo/, 'the halo is for the inferno only');
  assert.match(html(55), /streak--inferno/);
  assert.match(html(55), /streak__halo/);
  assert.match(html(55), /streak__sparks/);
  assert.match(html(1), /aria-label="1 day streak"/);
  assert.match(html(12), /aria-label="12 days streak"/);
  assert.match(html(12), />12</, 'the count is shown beside the flame');
});
