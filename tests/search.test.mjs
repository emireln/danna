// Tests the search of the whole app (src/lib/search.ts): every word must match, accents and case do not count, a name
// that starts with the query comes first, bundled names are translated and the learner's own names are not, and
// the results are grouped. It also checks that the bundled index has no repeated ids, because the list uses them.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let search;
let index;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  search = await server.ssrLoadModule('/src/lib/search.ts');
  index = await server.ssrLoadModule('/src/lib/searchIndex.ts');
});

after(async () => {
  await server?.close();
});

const identity = (text) => text;
const entry = (id, title, detail = '', extra = {}) => ({ id, kind: 'lesson', title, detail, keywords: '', bundled: true, route: '/', ...extra });
const ids = (hits) => hits.map((hit) => hit.entry.id);

test('every word of the query must match, in any order, and the detail is searched too', () => {
  const entries = [entry('a1', 'A1 level test', 'Questions from every lesson'), entry('toefl', 'TOEFL warm-up test', 'Reading and listening')];
  assert.deepEqual(ids(search.searchEntries(entries, 'level a1', identity)), ['a1']);
  assert.deepEqual(ids(search.searchEntries(entries, 'WARM up', identity)), ['toefl']);
  assert.deepEqual(ids(search.searchEntries(entries, 'listening', identity)), ['toefl']);
  assert.deepEqual(ids(search.searchEntries(entries, 'zebra', identity)), []);
  assert.deepEqual(search.searchEntries(entries, '   ', identity), [], 'an empty query finds nothing');
});

test('accents and case do not matter', () => {
  const entries = [entry('acao', 'Ação de voz', '')];
  assert.deepEqual(ids(search.searchEntries(entries, 'ACAO', identity)), ['acao']);
  assert.deepEqual(ids(search.searchEntries(entries, 'acão', identity)), ['acao']);
});

test('a name that starts with the query is listed before a name that only contains it', () => {
  const entries = [entry('detail', 'Unit 3 · Verbs', 'Practice with the verb to be'), entry('start', 'Verb tenses', '')];
  assert.deepEqual(ids(search.searchEntries(entries, 'verb', identity)), ['start', 'detail']);
});

test('bundled names are translated for the search and the learner’s own names are not', () => {
  const translate = (text) => (text === 'Settings' ? 'Configurações' : text === 'Find' ? 'Localizar' : text);
  const bundled = entry('settings', 'Settings', '', { kind: 'setting' });
  const own = entry('file', 'Find', '', { kind: 'file', bundled: false });
  assert.deepEqual(ids(search.searchEntries([bundled], 'configuracoes', translate)), ['settings']);
  assert.deepEqual(ids(search.searchEntries([own], 'localizar', translate)), [], 'a file named Find is not translated');
  assert.deepEqual(ids(search.searchEntries([own], 'find', translate)), ['file']);
});

test('the results are grouped by kind, in the order each kind first appears', () => {
  const hit = (id, kind) => ({ entry: { id, kind, title: id, bundled: true, route: '/' }, score: 1 });
  const groups = search.groupHits([hit('a', 'lesson'), hit('b', 'test'), hit('c', 'lesson')]);
  assert.deepEqual(groups.map((group) => group.kind), ['lesson', 'test']);
  assert.deepEqual(groups[0].hits.map((item) => item.entry.id), ['a', 'c']);
});

test('the bundled index has no repeated ids, and it opens the lessons and the tests', () => {
  const entries = index.bundledEntries();
  const all = entries.map((item) => item.id);
  assert.equal(new Set(all).size, all.length, 'every id is unique');
  assert.ok(entries.some((item) => item.route === '/play/test/mock-a1'), 'the A1 level test opens');
  assert.ok(entries.some((item) => item.kind === 'lesson' && item.route.startsWith('/play/lesson/')), 'lessons open');
  assert.ok(entries.some((item) => item.route === '/settings' && item.title === 'Listening voice'), 'the voice setting is found');
});

test('the learner’s own places are found without a backend, as an empty list', async () => {
  assert.deepEqual(await index.learnerEntries(null), []);
});
