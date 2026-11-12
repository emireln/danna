// Renders the shared components to markup and checks what a person and a screen reader would find: the
// messages that must be announced, the labels that must be attached to their fields, the dialogs that must be
// named, and the numbers that must read correctly. The components are rendered without a browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Star } from 'lucide-react';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let ui;
let session;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  ui = await server.ssrLoadModule('/src/components/ui.tsx');
  session = await server.ssrLoadModule('/src/lib/progress.ts');
});

after(async () => {
  await server?.close();
});

const render = (element) => renderToStaticMarkup(React.createElement(MemoryRouter, null, element));
const h = React.createElement;

test('an error notice is announced, and a plain notice is not', () => {
  const error = render(h(ui.Notice, { tone: 'error' }, 'We could not save.'));
  assert.match(error, /role="alert"/);
  assert.match(error, /notice--error/);
  assert.match(error, /We could not save\./);
  const plain = render(h(ui.Notice, null, 'Heads up'));
  assert.doesNotMatch(plain, /role="alert"/);
});

test('a field labels its control, and shows its hint', () => {
  const markup = render(h(ui.Field, { label: 'Username', hint: '3 to 20 characters' }, h('input', { className: 'input' })));
  assert.match(markup, /^<label class="field">/);
  assert.match(markup, /<span class="field__label">Username<\/span>/);
  assert.match(markup, /<span class="field__hint">3 to 20 characters<\/span>/);
});

test('tabs mark the selected tab and show a count only when there is one', () => {
  const markup = render(
    h(ui.Tabs, {
      label: 'Friends',
      value: 'requests',
      onChange: () => {},
      items: [
        { value: 'friends', label: 'Friends', count: 4 },
        { value: 'requests', label: 'Requests', count: 2, alert: true },
        { value: 'inbox', label: 'Inbox', count: 0 },
      ],
    }),
  );
  assert.match(markup, /role="tablist"/);
  assert.match(markup, /aria-selected="true"[^>]*>Requests/);
  assert.match(markup, /segmented__count--alert">2</, 'a waiting request is shown in red');
  assert.match(markup, />Friends<span class="segmented__count">4</);
  assert.doesNotMatch(markup, />Inbox<span/, 'an empty count is not shown');
});

test('a page header puts its actions beside the title only when there are some', () => {
  const plain = render(h(ui.PageHeader, { eyebrow: 'Your plan', title: 'Today' }));
  assert.match(plain, /<h1 class="page-title">Today<\/h1>/);
  assert.doesNotMatch(plain, /page-header__aside/);
  const withAside = render(h(ui.PageHeader, { title: 'Roadmap', aside: h('span', null, 'Level B1') }));
  assert.match(withAside, /page-header__aside/);
});

test('a feature card is a button only when it can be pressed', () => {
  const pressable = render(h(ui.FeatureCard, { icon: h('i'), title: 'Level check', onClick: () => {} }));
  assert.match(pressable, /^<button type="button" class="feature-card feature-card--link"/);
  const fixed = render(h(ui.FeatureCard, { icon: h('i'), title: 'Learning setup', muted: true }));
  assert.match(fixed, /^<div class="feature-card feature-card--muted">/);
});

test('a dialog is named by its title and has a close control', () => {
  const markup = render(h(ui.Sheet, { title: 'Exam date', onClose: () => {}, footer: h('button', null, 'Save') }, h('p', null, 'Body')));
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="true"/);
  assert.match(markup, /aria-label="Exam date"/);
  assert.match(markup, /aria-label="Close"/);
  assert.match(markup, /sheet__foot/);
});

test('a confirmation asks with a red button and a quiet cancel', () => {
  const markup = render(h(ui.ConfirmSheet, { title: 'Remove this file?', confirmLabel: 'Remove file', onConfirm: () => {}, onClose: () => {} }, 'It cannot be undone.'));
  assert.match(markup, /btn btn--danger/);
  assert.match(markup, /btn btn--ghost/);
  assert.match(markup, />\s*Remove file</, 'the confirm button names what it does');
});

test('an empty state has a title and an optional line', () => {
  const markup = render(h(ui.Empty, { title: 'Nothing here yet' }, 'Add a file first.'));
  assert.match(markup, /<h3>Nothing here yet<\/h3>/);
  assert.match(markup, /class="muted small">Add a file first\.<\/p>/);
});

test('a progress bar reports its value as a whole number', () => {
  const markup = render(h(ui.ProgressBar, { value: 2.6, max: 8, label: 'Lessons' }));
  assert.match(markup, /role="progressbar"/);
  assert.match(markup, /aria-valuenow="3"/);
  assert.match(markup, /aria-valuemax="8"/);
  assert.match(markup, /aria-label="Lessons"/);
});

test('a picture is shown when there is one, and initials when there is not', () => {
  const pictured = render(h(ui.Avatar, { name: 'Ana Maria', src: 'blob:one' }));
  assert.match(pictured, /<img class="avatar__img" src="blob:one"/);
  assert.doesNotMatch(pictured, /AM/);
  const plain = render(h(ui.Avatar, { name: 'Ana Maria', color: '#123456' }));
  assert.match(plain, />AM</);
  assert.match(plain, /background:#123456/);
});

test('initials come from the first two words, and a blank name has a placeholder', () => {
  assert.equal(ui.initials('Ana Maria Silva'), 'AM');
  assert.equal(ui.initials('  luca '), 'L');
  assert.equal(ui.initials('   '), '?');
});

test('the clock in a session counts minutes and seconds', () => {
  assert.equal(ui.formatClock(0), '00:00');
  assert.equal(ui.formatClock(75), '01:15');
  assert.equal(ui.formatClock(3605), '60:05');
});

test('the badge of a feature card and the star icon render without a crash', () => {
  const markup = render(h(ui.Badge, { tone: 'done' }, 'Done'));
  assert.match(markup, /badge badge--done/);
  assert.ok(render(h(Star, { 'aria-hidden': 'true' })).includes('svg'));
});

test('dates, sizes of time and XP read the same way everywhere', () => {
  const iso = '2026-03-04T10:00:00.000Z';
  assert.match(session.formatDate(iso), /Mar 4/);
  assert.match(session.formatLongDate(iso), /March 4, 2026/);
  assert.equal(session.formatDuration(45), '45 s');
  assert.equal(session.formatDuration(600), '10 min');
  assert.deepEqual(session.levelInfo(450), { level: 3, into: 50, span: 200, percent: 25 });
  assert.equal(session.daysUntil(null), null);
  assert.equal(session.daysUntil('not-a-date'), null);
});
