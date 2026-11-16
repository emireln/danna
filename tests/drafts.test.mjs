// Tests the drafts that keep an unfinished lesson or test on this device: a draft belongs to one learner and one page,
// it comes back only for the same test and a question that exists, and a store that fails never stops a session.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let drafts;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  drafts = await server.ssrLoadModule('/src/lib/drafts.ts');
});

after(async () => {
  await server?.close();
});

/** A store that keeps its values in memory, the way the browser's storage does. */
function memoryStore() {
  const values = new Map();
  return {
    values,
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

const session = {
  testId: 'mock-b1-reading-listening',
  index: 3,
  startedAt: 1_700_000_000_000,
  items: { q1: { choice: 2 }, q2: { cloze: ['goes'] } },
  results: { q1: { id: 'q1', skill: 'reading', fraction: 1, response: 2 } },
  revealed: { q1: true },
  blankMarks: { q2: [true] },
};

test('a session is kept for one learner and one page, and comes back whole', () => {
  const store = memoryStore();
  const key = drafts.draftKey('profile-1', '/play/lesson/a1-first');
  drafts.writeSessionDraft(store, key, session);
  assert.deepEqual(drafts.readSessionDraft(store, key, session.testId, 10), session);
  assert.notEqual(drafts.draftKey('profile-2', '/play/lesson/a1-first'), key, 'another learner has a draft of their own');
  assert.notEqual(drafts.draftKey('profile-1', '/play/lesson/a1-second'), key, 'another page has a draft of its own');
});

test('a draft comes back only for the same test, on a question that exists', () => {
  const store = memoryStore();
  drafts.writeSessionDraft(store, 'k', session);
  assert.equal(drafts.readSessionDraft(store, 'k', 'mock-b1-writing-speaking', 10), null, 'another test');
  assert.equal(drafts.readSessionDraft(store, 'k', session.testId, 3), null, 'the question is past the end of the test');
  assert.equal(drafts.readSessionDraft(store, 'k', session.testId, 4)?.index, 3);
});

test('a draft that is not valid JSON, or has a broken part, is ignored', () => {
  const store = memoryStore();
  store.setItem('bad', '{not json');
  assert.equal(drafts.readSessionDraft(store, 'bad', session.testId, 10), null);
  store.setItem('broken', JSON.stringify({ ...session, items: 'none' }));
  assert.equal(drafts.readSessionDraft(store, 'broken', session.testId, 10), null);
  store.setItem('negative', JSON.stringify({ ...session, index: -1 }));
  assert.equal(drafts.readSessionDraft(store, 'negative', session.testId, 10), null);
  assert.equal(drafts.readSessionDraft(store, 'missing', session.testId, 10), null);
});

test('a finished or restarted session removes its draft', () => {
  const store = memoryStore();
  drafts.writeSessionDraft(store, 'k', session);
  drafts.clearDraft(store, 'k');
  assert.equal(drafts.readSessionDraft(store, 'k', session.testId, 10), null);
  assert.equal(store.values.size, 0);
});

test('a store that refuses or fails never stops a session', () => {
  const broken = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('full');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };
  assert.doesNotThrow(() => drafts.writeSessionDraft(broken, 'k', session));
  assert.equal(drafts.readSessionDraft(broken, 'k', session.testId, 10), null);
  assert.doesNotThrow(() => drafts.clearDraft(broken, 'k'));
  assert.equal(drafts.readSessionDraft(null, 'k', session.testId, 10), null, 'no store at all');
  assert.doesNotThrow(() => drafts.writeSessionDraft(null, 'k', session));
  assert.equal(drafts.localDrafts(), null, 'outside the browser there is no local storage');
});
