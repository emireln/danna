// The title bar: the V2 BETA badge is a gradient link to the release notes, and the word News opens beside it on hover or
// keyboard focus. The XP chip is shown only in the Playful look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');
const looks = read('src', 'styles', 'looks.css').replace(/\/\*[\s\S]*?\*\//g, '');
const titlebar = read('src', 'components', 'TitleBar.tsx');

test('the V2 BETA badge is a gradient with a small radius', () => {
  const block = looks.match(/\.beta-badge \{([\s\S]*?)\}/);
  assert.ok(block, 'looks.css styles .beta-badge');
  assert.match(block[1], /background: linear-gradient\(/, 'the badge has a gradient background');
  const radius = block[1].match(/border-radius:\s*(\d+)px/);
  assert.ok(radius && Number(radius[1]) > 0 && Number(radius[1]) <= 10, 'the badge radius is 10px at most');
});

test('the V2 BETA badge opens the release notes, beside the wordmark', () => {
  const wordmark = titlebar.indexOf('className="wordmark"');
  const badge = titlebar.indexOf('className="beta-badge"');
  assert.ok(wordmark > 0 && badge > wordmark, 'the badge follows the wordmark');
  assert.match(titlebar, /<Link\s+to="\/whats-new"\s+className="beta-badge"/, 'the badge links to the release notes');
});

test('the word News opens on hover and on keyboard focus, and its width changes smoothly', () => {
  assert.match(looks, /\.beta-badge:hover \.beta-badge__more,\s*\.beta-badge:focus-visible \.beta-badge__more \{/);
  const closed = looks.match(/\.beta-badge__more \{([\s\S]*?)\}/);
  assert.ok(closed && /max-width: 0;/.test(closed[1]), 'the word starts with no width');
  assert.ok(closed && /transition:[\s\S]*max-width/.test(closed[1]), 'the width is transitioned');
});

test('the XP chip is shown only in the Playful look', () => {
  assert.match(titlebar, /look === 'playful' && profile && <XpChip xp=\{profile\.xp\} \/>/);
});
