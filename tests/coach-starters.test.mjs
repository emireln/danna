// Tests the coach's starter questions (src/lib/coach.ts): the pool is large, each pick has no repeats, the pick
// is random, and every question has its Portuguese text.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let coach;
let PT;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  coach = await server.ssrLoadModule('/src/lib/coach.ts');
  ({ PT } = await server.ssrLoadModule('/src/lib/i18n/pt/index.ts'));
});

after(async () => {
  await server?.close();
});

test('the starter pool is large, has no repeats, and shows four questions at a time', () => {
  assert.ok(coach.STARTERS.length >= 20, 'there are many questions to start from');
  assert.equal(new Set(coach.STARTERS).size, coach.STARTERS.length, 'no question is listed twice');
  assert.equal(coach.STARTER_COUNT, 4);
});

test('a pick has no repeats, comes from the pool, and changes between picks', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f'];
  // A fixed sequence of numbers makes the picks the same on every run.
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const first = coach.pickStarters(pool, 4, random);
  const second = coach.pickStarters(pool, 4, random);
  assert.equal(first.length, 4);
  assert.equal(new Set(first).size, 4, 'no question repeats in one pick');
  assert.ok(first.every((item) => pool.includes(item)), 'every question comes from the pool');
  assert.notDeepEqual(second, first, 'the next pick is a different set or order');
  assert.equal(coach.pickStarters(pool, 9, random).length, pool.length, 'a pick never holds more than the pool');
  assert.deepEqual(pool, ['a', 'b', 'c', 'd', 'e', 'f'], 'the pool is not changed');
});

test('every starter question has its Portuguese text', () => {
  for (const question of coach.STARTERS) {
    assert.ok(PT[question], `no Portuguese text for: ${question}`);
  }
});
