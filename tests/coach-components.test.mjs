// Renders the coach's chat history, its mention picker and its search box to markup, and checks what a person
// and a screen reader would find: the chats in their groups, the actions of each chat, the empty messages, and
// the labels of the search fields.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let history;
let mention;
let ui;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  history = await server.ssrLoadModule('/src/components/ChatHistory.tsx');
  mention = await server.ssrLoadModule('/src/components/MentionSheet.tsx');
  ui = await server.ssrLoadModule('/src/components/ui.tsx');
});

after(async () => {
  await server?.close();
});

const h = React.createElement;
const render = (element) => renderToStaticMarkup(h(MemoryRouter, null, element));
const noop = () => {};
const asyncNoop = async () => {};

const CHATS = [
  { id: 'c1', title: 'Verb tenses', archived: false, created_at: '2026-11-13T09:00:00.000Z', updated_at: '2026-11-13T09:10:00.000Z' },
  { id: 'c2', title: null, archived: true, created_at: '2026-11-01T09:00:00.000Z', updated_at: '2026-11-02T09:00:00.000Z' },
];

const historyProps = (overrides = {}) => ({
  chats: CHATS,
  searching: false,
  query: '',
  activeId: 'c1',
  busy: false,
  onQuery: noop,
  onOpen: noop,
  onNew: noop,
  onRename: asyncNoop,
  onArchive: asyncNoop,
  onDelete: asyncNoop,
  onClose: noop,
  ...overrides,
});

test('the chat history lists the chats first, then the archived ones, and marks the open chat', () => {
  const html = render(h(history.ChatHistory, historyProps()));
  assert.match(html, /aria-label="Chats"/);
  assert.match(html, /aria-label="Archived"/);
  assert.ok(html.indexOf('Verb tenses') < html.indexOf('Untitled chat'), 'the active chat is listed before the archived one');
  assert.match(html, /chat-row is-active/, 'the open chat is marked');
  assert.match(html, /aria-label="Rename chat"/);
  assert.match(html, /aria-label="Archive chat"/, 'a chat that is not archived can be archived');
  assert.match(html, /aria-label="Restore chat"/, 'an archived chat can be restored');
  assert.match(html, /aria-label="Delete chat"/);
  assert.match(html, /aria-label="Search chats"/, 'the history has a search box');
});

test('the history explains an empty result, both when there is no chat and when a search finds none', () => {
  assert.match(render(h(history.ChatHistory, historyProps({ chats: [] }))), /No chats yet\./);
  const searched = render(h(history.ChatHistory, historyProps({ chats: [], searching: true, query: 'zzz' })));
  assert.match(searched, /No chat matches your search\./);
});

test('a day label reads Today for a message from today', () => {
  const today = new Date().toISOString();
  assert.equal(history.chatDay(today, (text) => text), 'Today');
});

test('the mention picker lists the library files with their kinds, and names the limit', () => {
  const files = [
    { id: 'f1', name: 'Unit 3.pdf', kind: 'pdf', mime_type: 'application/pdf', size_bytes: 900, pages: 4, created_at: '', updated_at: '' },
    { id: 'f2', name: 'Notes.md', kind: 'md', mime_type: 'text/markdown', size_bytes: 40, pages: null, created_at: '', updated_at: '' },
  ];
  const html = render(h(mention.MentionSheet, { files, chosen: ['f2'], limit: 9, onConfirm: noop, onClose: noop }));
  assert.match(html, /Unit 3\.pdf/);
  assert.match(html, /Notes\.md/);
  assert.match(html, /mention-option is-on/, 'the file already mentioned is marked');
  assert.match(html, /You can mention up to 9 files in one message\./);
  assert.match(html, /aria-label="Search your files"/);
});

test('the mention picker says the library is empty when there are no files', () => {
  const html = render(h(mention.MentionSheet, { files: [], chosen: [], limit: 10, onConfirm: noop, onClose: noop }));
  assert.match(html, /Your library is empty/);
  assert.match(html, /Add a file in My library first\./);
});

test('the search field labels its input and shows its magnifier', () => {
  const html = render(h(ui.SearchField, { value: 'verb', onChange: noop, placeholder: 'Search chats', label: 'Search chats' }));
  assert.match(html, /class="search-field"/);
  assert.match(html, /aria-label="Search chats"/);
  assert.match(html, /value="verb"/);
});
