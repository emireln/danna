// The sheets, the reader and the pickers keep clear of the title bar and the bottom tabs. A sheet sits in the room between
// those two bars, so neither of them can cover its header or its footer, on a small window or a large one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');
const css = (file) => read('src', 'styles', file).replace(/\/\*[\s\S]*?\*\//g, '');
const app = css('app.css');
const library = css('library.css');
const pickers = read('src', 'components', 'Pickers.tsx');

test('the dim of a sheet starts under the title bar', () => {
  const scrim = app.match(/\.scrim \{([\s\S]*?)\}/);
  assert.ok(scrim, 'app.css styles the scrim');
  assert.match(scrim[1], /top: var\(--titlebar-h/, 'the scrim starts under the title bar');
});

test('in the shell, the dim stops at the bottom tabs', () => {
  assert.match(app, /\.shell \.scrim \{\s*--scrim-bottom: var\(--nav-h\);\s*\}/, 'the scrim ends where the tabs begin');
});

test('a sheet is never taller than the room between the bars, plus a 24 px gutter', () => {
  const sheet = app.match(/\.sheet \{([\s\S]*?)\}/);
  assert.ok(sheet, 'app.css styles the sheet');
  assert.match(
    sheet[1],
    /max-height: calc\(100vh - var\(--titlebar-h[^)]*\) - var\(--scrim-bottom\) - 48px\)/,
    'the height leaves the title bar, the tabs and 24 px above and below',
  );
});

test('the reader stops at the bottom tabs', () => {
  const viewer = library.match(/\.viewer \{([\s\S]*?)\}/);
  assert.ok(viewer, 'library.css styles the reader');
  assert.match(viewer[1], /bottom: var\(--nav-h/, 'the reader ends where the tabs begin');
});

test('a picker opens above its field when the tabs leave no room below', () => {
  assert.match(pickers, /roomBottom\(\) - box\.bottom/, 'the room is measured to the top of the tabs');
});
