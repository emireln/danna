// The sheets, the reader and the pickers keep clear of the title bar and the bottom tabs. A sheet sits in the main panel,
// between the title bar and the accent frame, so neither the title bar nor the tabs can cover its header or its footer.
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

test('the dim covers the main panel, the bottom tabs included, and leaves the accent frame bright', () => {
  const scrim = app.match(/\.scrim \{([\s\S]*?)\}/);
  assert.ok(scrim, 'app.css styles the scrim');
  assert.match(scrim[1], /bottom: var\(--frame-gutter/, 'the scrim ends at the frame gutter, so the tabs are under it');
  assert.match(scrim[1], /left: var\(--frame-gutter/, 'the scrim keeps the frame gutter on the left');
  assert.match(scrim[1], /right: var\(--frame-gutter/, 'the scrim keeps the frame gutter on the right');
  assert.match(scrim[1], /border-radius: var\(--frame-radius/, 'the scrim has the corners of the panel');
});

test('a sheet is never taller than the panel, plus a 24 px gutter above and below', () => {
  const sheet = app.match(/\.sheet \{([\s\S]*?)\}/);
  assert.ok(sheet, 'app.css styles the sheet');
  assert.match(
    sheet[1],
    /max-height: calc\(100vh - var\(--titlebar-h[^)]*\) - 2 \* var\(--frame-gutter[^)]*\) - 48px\)/,
    'the height leaves the title bar, the frame gutter at the bottom and 24 px above and below',
  );
});

test('the reader stops at the bottom tabs', () => {
  const viewer = library.match(/\.viewer \{([\s\S]*?)\}/);
  assert.ok(viewer, 'library.css styles the reader');
  assert.match(
    viewer[1],
    /bottom: calc\(var\(--nav-h[^)]*\) \+ var\(--frame-gutter/,
    'the reader ends where the tabs begin, above the frame gutter',
  );
});

test('a picker opens above its field when the tabs leave no room below', () => {
  assert.match(pickers, /roomBottom\(\) - box\.bottom/, 'the room is measured to the top of the tabs');
});
