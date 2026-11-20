// The weekly league (2.0.0): the tiers and where the XP sits in them, the ranking with ties, the caller's place,
// and the daily bars of the last seven days.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
let server;
let tierOf;
let ranked;
let placeOf;
let dailyXp;
let TIERS;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  ({ tierOf, ranked, placeOf, dailyXp, TIERS } = await server.ssrLoadModule('/src/lib/league.ts'));
});

after(async () => {
  await server?.close();
});

const member = (userId, name, weekXp) => ({
  user_id: userId,
  username: name.toLowerCase(),
  display_name: name,
  avatar_color: '#2f6bff',
  avatar_path: null,
  avatar_updated_at: null,
  week_xp: weekXp,
});

test('the tiers start at their floors, and the top tier is reached and held', () => {
  assert.equal(tierOf(0).id, 'bronze');
  assert.equal(tierOf(49).id, 'bronze');
  assert.equal(tierOf(50).id, 'silver');
  assert.equal(tierOf(749).id, 'emerald');
  assert.equal(tierOf(750).id, 'diamond');
  assert.equal(tierOf(5000).id, 'diamond');
  assert.equal(tierOf(5000).next, null);
  assert.equal(tierOf(5000).progress, 100);
});

test('the XP to the next tier and the progress to it are worked out from the floor', () => {
  const info = tierOf(85);
  assert.equal(info.id, 'silver');
  assert.equal(info.next, 'gold');
  assert.equal(info.toNext, 35);
  assert.equal(info.progress, 50, 'halfway from 50 to 120 is 85');
  assert.equal(TIERS.length, 7);
});

test('negative or missing XP is treated as none', () => {
  assert.equal(tierOf(-20).id, 'bronze');
  assert.equal(tierOf(Number.NaN).id, 'bronze');
});

test('the ranking is by the week XP, most first, and ties keep the order of their names', () => {
  const rows = [member('a', 'Bea', 40), member('b', 'Ana', 40), member('c', 'Cy', 90)];
  assert.deepEqual(
    ranked(rows).map((row) => row.display_name),
    ['Cy', 'Ana', 'Bea'],
  );
});

test('the caller\'s place counts from the first, and is absent when the caller is not listed', () => {
  const rows = [member('a', 'Bea', 40), member('b', 'Ana', 70)];
  assert.deepEqual(placeOf(rows, 'a'), { place: 2, total: 2 });
  assert.equal(placeOf(rows, 'missing'), null);
});

test('the bars count the XP of each local day in the last seven days, oldest first', () => {
  const now = new Date(2026, 10, 20, 12, 0, 0);
  const at = (daysAgo, xp) => ({
    created_at: new Date(2026, 10, 20 - daysAgo, 9, 0, 0).toISOString(),
    xp,
  });
  const runs = [at(0, 30), at(0, 10), at(6, 5), at(7, 99)];
  const bars = dailyXp(runs, 7, now);
  assert.equal(bars.length, 7);
  assert.equal(bars[0].day, '2026-11-14', 'the first bar is six days back');
  assert.equal(bars[6].xp, 40, 'today adds up its runs');
  assert.equal(bars[0].xp, 5);
  assert.equal(
    bars.reduce((sum, item) => sum + item.xp, 0),
    45,
    'a run seven days back is left out',
  );
});
