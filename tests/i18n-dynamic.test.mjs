// The Portuguese translation (F12) for the strings the code does not pass to t() as a literal: the messages of errors
// that the screens show, the names of the coach's modes and starters, the writing check's labels, and the league tiers.
// tests/i18n.test.mjs covers the literal t('...') calls; this file covers the rest, so no string can be forgotten.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let i18n;
let PT;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  i18n = await server.ssrLoadModule('/src/lib/i18n/index.ts');
  ({ PT } = await server.ssrLoadModule('/src/lib/i18n/pt/index.ts'));
});

after(async () => {
  await server?.close();
});

async function sourceFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (path.replace(/\\/g, '/').endsWith('/lib/i18n/pt')) continue;
      found.push(...(await sourceFiles(path)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

// A string literal as the code writes it: single or double quotes, with \' and \\ escapes.
const LITERAL = String.raw`'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"`;
const unescape = (text) => text.replace(/\\(.)/g, '$1');

// A text is translated when the Portuguese dictionary has it, with a value. A word that is spelled the same in both
// languages, such as "Bronze", still needs its entry, so that it is a decision and not an omission.
function assertTranslated(texts, label) {
  const untranslated = [...new Set(texts)].filter((text) => text.trim() && !(Object.hasOwn(PT, text) && PT[text].trim()));
  assert.deepEqual(untranslated, [], `${untranslated.length} ${label} have no Portuguese: ${untranslated.slice(0, 25).join(' | ')}`);
}

test('every message an error can show has a Portuguese translation', async () => {
  const messages = [];
  for (const file of await sourceFiles(join(root, 'src'))) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(new RegExp(String.raw`userError\(\s*(?:${LITERAL})`, 'g'))) messages.push(unescape(match[1] ?? match[2]));
  }
  // The messages errorText gives for the known service errors, and its fallback.
  const bridge = await readFile(join(root, 'src', 'lib', 'bridge.ts'), 'utf8');
  for (const match of bridge.matchAll(/^\s*\[\/.*\/[a-z]*, '((?:[^'\\\n]|\\.)*)'\],?\s*$/gm)) messages.push(unescape(match[1]));
  const fallback = bridge.match(/const FALLBACK = '((?:[^'\\\n]|\\.)*)'/);
  if (fallback) messages.push(unescape(fallback[1]));
  assert.ok(messages.length > 40, `the scan should find the error messages, found ${messages.length}`);
  assertTranslated(messages, 'error messages');
});

test('the coach modes, the starters and the writing labels have Portuguese', async () => {
  const modes = await server.ssrLoadModule('/src/lib/coachModes.ts');
  const coach = await server.ssrLoadModule('/src/lib/coach.ts');
  const writing = await server.ssrLoadModule('/src/lib/writingCheck.ts');
  const texts = [];
  for (const mode of modes.COACH_MODES) {
    texts.push(mode.title, mode.blurb);
    if (mode.opener) texts.push(mode.opener);
  }
  texts.push(...coach.STARTERS);
  texts.push(...Object.values(writing.LOCAL_REASON), writing.LOCAL_SUMMARY);
  assertTranslated(texts, 'coach and writing texts');
});

test('the league tiers have Portuguese names', async () => {
  const league = await server.ssrLoadModule('/src/lib/league.ts');
  const names = league.TIERS.map((tier) => tier.id.charAt(0).toUpperCase() + tier.id.slice(1));
  assertTranslated(names, 'league tier names');
});

test('the scan covers the literal messages the code writes', async () => {
  // Guards the scan itself: a message written with double quotes is found as well as one with single quotes.
  const sample = `throw userError("A quoted message, with 'apostrophes'.");`;
  const found = [...sample.matchAll(new RegExp(String.raw`userError\(\s*(?:${LITERAL})`, 'g'))].map((match) => unescape(match[1] ?? match[2]));
  assert.deepEqual(found, ["A quoted message, with 'apostrophes'."]);
});
