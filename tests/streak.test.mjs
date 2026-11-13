// The day streak: it counts on the day after the last study day, and the flame changes colour at 200, 500 and 1000 days.
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

test('the flame keeps its orange look to 200 days, then turns red, blue and purple at 200, 500 and 1000 days', async () => {
  const { streakTier } = await server.ssrLoadModule('/src/lib/progress.ts');
  assert.equal(streakTier(1), 'ember');
  assert.equal(streakTier(200), 'ember');
  assert.equal(streakTier(201), 'ruby');
  assert.equal(streakTier(500), 'ruby');
  assert.equal(streakTier(501), 'sapphire');
  assert.equal(streakTier(999), 'sapphire');
  assert.equal(streakTier(1000), 'amethyst');
  assert.equal(streakTier(5000), 'amethyst');
});

test('the flame shows its tier and colour, the day count, and nothing without a streak', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StreakFire } = await server.ssrLoadModule('/src/components/StreakFire.tsx');
  const html = (days) => renderToStaticMarkup(createElement(StreakFire, { days }));

  assert.equal(html(0), '', 'no streak, no flame');
  assert.match(html(3), /streak--ember/);
  assert.match(html(200), /streak--ember/, 'the same flame up to 200 days');
  assert.match(html(250), /streak--ruby/);
  assert.match(html(600), /streak--sapphire/);
  assert.match(html(1000), /streak--amethyst/);
  assert.doesNotMatch(html(1000), /streak__halo|streak__sparks/, 'the halo and the sparks are gone');
  assert.match(html(1), /aria-label="1 day streak"/);
  assert.match(html(12), /aria-label="12 days streak"/);
  assert.match(html(12), />12</, 'the count is shown beside the flame');
});
