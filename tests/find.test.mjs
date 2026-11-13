// Tests Find in a file (src/lib/find.ts): where the words are, with or without regard to case, the pieces of
// text around the matches, and the matches across the pages of a PDF.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let find;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  find = await server.ssrLoadModule('/src/lib/find.ts');
});

after(async () => {
  await server?.close();
});

test('matches are found without regard to case, unless the case is asked for', () => {
  assert.deepEqual(find.findRanges('The cat and the Cat', 'the'), [[0, 3], [12, 15]]);
  assert.deepEqual(find.findRanges('The cat and the Cat', 'Cat', true), [[16, 19]]);
  assert.deepEqual(find.findRanges('AÇÃO e ação', 'ação'), [[0, 4], [7, 11]], 'accents and cedillas count as letters');
});

test('the query is taken as plain text, and matches do not overlap', () => {
  assert.deepEqual(find.findRanges('a.b a+b', 'a.b'), [[0, 3]], 'a dot is a dot, not any character');
  assert.deepEqual(find.findRanges('aaaa', 'aa'), [[0, 2], [2, 4]]);
  assert.deepEqual(find.findRanges('text', ''), [], 'an empty search finds nothing');
});

test('the text around the matches joins back into the text', () => {
  const text = 'Read the text, then read again.';
  const spans = find.splitHits(text, 'read');
  assert.equal(spans.map((span) => span.text).join(''), text);
  assert.deepEqual(spans.filter((span) => span.hit).map((span) => span.text), ['Read', 'read']);
  assert.deepEqual(find.splitHits('nothing here', 'zebra'), [{ text: 'nothing here', hit: false }]);
});

test('the matches of a PDF are listed by page, in order', () => {
  assert.deepEqual(find.pageHits(['cat dog', 'no animals', 'cat, cat'], 'cat'), [{ page: 1 }, { page: 3 }, { page: 3 }]);
  assert.deepEqual(find.pageHits(['cat'], ''), []);
});

test('a very common word stops at the limit of matches', () => {
  assert.equal(find.findRanges('a'.repeat(5000), 'a').length, find.MAX_MATCHES);
});
