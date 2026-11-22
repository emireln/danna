// The coach's reply while it arrives: its text is kept apart from the chat screen (src/lib/textStore.ts) and drawn by
// WritingReply (src/components/CoachReply.tsx). A message the learner sent shows its files by name.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let textStore;
let replies;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  textStore = await server.ssrLoadModule('/src/lib/textStore.ts');
  replies = await server.ssrLoadModule('/src/components/CoachReply.tsx');
});

after(async () => {
  await server?.close();
});

const h = React.createElement;
const render = (element) => renderToStaticMarkup(h(MemoryRouter, null, element));
const noop = () => undefined;

test('a text store tells its readers about each change of text, and no longer tells a reader that left', () => {
  const store = textStore.createTextStore();
  let told = 0;
  const leave = store.subscribe(() => {
    told += 1;
  });
  store.set('Hello');
  store.set('Hello');
  store.set('Hello there');
  assert.equal(store.get(), 'Hello there');
  assert.equal(told, 2, 'the same text again is not a change');
  leave();
  store.set('Bye');
  assert.equal(told, 2, 'a reader that left is not told');
});

test('a reply being written shows the newest text of its store, with the cursor at its end', () => {
  const store = textStore.createTextStore('Good **morning**');
  const html = render(h(replies.WritingReply, { store, reviewKeys: new Set(), onNavigate: noop, onCopy: noop, onFollow: noop }));
  assert.match(html, /<strong>morning<\/strong>/);
  assert.match(html, /is-writing/);
  assert.match(html, /turn__cursor/);
});

test("the learner's message shows its files by name, and its text in a bubble", () => {
  const html = render(
    h(replies.LearnerTurn, {
      text: 'Check these',
      attachments: [
        { name: 'page.png', kind: 'image', size: 10 },
        { name: 'Unit 3', kind: 'library', size: 0 },
      ],
      editable: false,
      busy: false,
      onCopy: noop,
      onEdit: noop,
    }),
  );
  assert.match(html, /page\.png/);
  assert.match(html, /Unit 3/);
  assert.match(html, /turn__bubble/);
});

test('a message with no files shows no row of files', () => {
  const html = render(h(replies.LearnerTurn, { text: 'Hi', attachments: [], editable: false, busy: false, onCopy: noop, onEdit: noop }));
  assert.doesNotMatch(html, /turn__files/);
});
