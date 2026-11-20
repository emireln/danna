// Flashcards (2.0.0): the four grades set the next interval (again returns the card in ten minutes), a missed card
// in review loses ease and half its interval, and an import reads "front; back" or tab-separated lines.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
let server;
let gradeCard;
let gradeWaits;
let parseDeckImport;
let IMPORT_CARD_LIMIT;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  ({ gradeCard, gradeWaits } = await server.ssrLoadModule('/src/lib/srs.ts'));
  ({ parseDeckImport, IMPORT_CARD_LIMIT } = await server.ssrLoadModule('/src/lib/deck.ts'));
});

after(async () => {
  await server?.close();
});

const NOW = new Date('2026-11-20T09:00:00.000Z');
const DAY = 86_400_000;
const MINUTE = 60_000;
const fresh = { state: 'new', ease: 2.5, interval_days: 0, reps: 0, lapses: 0 };
const kept = { state: 'review', ease: 2.5, interval_days: 10, reps: 3, lapses: 0 };

test('a new card that is answered well is kept for a day, and is in review', () => {
  const next = gradeCard(fresh, 'good', NOW);
  assert.equal(next.state, 'review');
  assert.equal(next.interval_days, 1);
  assert.equal(next.reps, 1);
  assert.equal(new Date(next.due_at).getTime() - NOW.getTime(), DAY);
  assert.equal(next.last_review_at, NOW.toISOString());
});

test('a card in review grows its interval by its ease at each good answer', () => {
  const next = gradeCard(kept, 'good', NOW);
  assert.equal(next.interval_days, 25, 'ten days at ease 2.5');
  assert.equal(next.reps, 4);
  assert.equal(next.ease, 2.5, 'good keeps the ease');
});

test('again returns the card in ten minutes, and a missed card in review loses ease and half its interval', () => {
  const missed = gradeCard(kept, 'again', NOW);
  assert.equal(missed.state, 'learning');
  assert.equal(missed.lapses, 1);
  assert.equal(missed.interval_days, 5);
  assert.equal(missed.ease, 2.3);
  assert.equal(new Date(missed.due_at).getTime() - NOW.getTime(), 10 * MINUTE);
  assert.equal(missed.reps, 0);
});

test('ease stays between 1.3 and 4, however often the grade repeats', () => {
  let card = { ...kept };
  for (let index = 0; index < 20; index += 1) card = { ...gradeCard(card, 'again', NOW) };
  assert.equal(card.ease, 1.3);
  card = { ...kept, ease: 3.9 };
  for (let index = 0; index < 5; index += 1) card = { ...gradeCard(card, 'easy', NOW) };
  assert.equal(card.ease, 4);
});

test('the four grades wait longer each time, from ten minutes to days', () => {
  const waits = gradeWaits(kept, NOW);
  assert.ok(waits.again < waits.hard, 'again is the shortest wait');
  assert.ok(waits.hard < waits.good, 'hard waits less than good');
  assert.ok(waits.good < waits.easy, 'easy waits the longest');
  assert.equal(waits.again, 10 * MINUTE);
});

test('an import reads semicolon and tab lines, skips the lines that are not cards, and ignores blank lines', () => {
  const result = parseDeckImport('gate; porta de embarque\n\nboarding pass\tcartão de embarque\nno separator here\n; empty front\nfront only;\n');
  assert.deepEqual(result.cards, [
    { front: 'gate', back: 'porta de embarque' },
    { front: 'boarding pass', back: 'cartão de embarque' },
  ]);
  assert.equal(result.skipped, 3, 'three lines are not cards');
  assert.equal(result.truncated, false);
});

test('an import reads at most 500 cards, and says that the rest were left out', () => {
  const lines = Array.from({ length: IMPORT_CARD_LIMIT + 10 }, (_, index) => `word ${index}; palavra ${index}`).join('\n');
  const result = parseDeckImport(lines);
  assert.equal(result.cards.length, IMPORT_CARD_LIMIT);
  assert.equal(result.truncated, true);
});

test('long sides are cut to their limits', () => {
  const result = parseDeckImport(`${'a'.repeat(400)}; ${'b'.repeat(700)}`);
  assert.equal(result.cards[0].front.length, 300);
  assert.equal(result.cards[0].back.length, 600);
});
