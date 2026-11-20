// The title bar of 2.0.0: the Beta tag is a small square (never a pill), it sits beside the wordmark in both looks,
// and the XP chip is shown only in the Playful look, so the Classic title bar is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');
const looks = read('src', 'styles', 'looks.css').replace(/\/\*[\s\S]*?\*\//g, '');
const titlebar = read('src', 'components', 'TitleBar.tsx');

test('the Beta tag is a small square with a thin border, not a pill', () => {
  const block = looks.match(/\.beta-tag \{([\s\S]*?)\}/);
  assert.ok(block, 'looks.css styles .beta-tag');
  const radius = block[1].match(/border-radius:\s*(\d+)px/);
  assert.ok(radius, 'the Beta tag sets a radius in pixels');
  assert.ok(Number(radius[1]) > 0 && Number(radius[1]) <= 4, `the Beta tag radius is ${radius[1]}px: it must be a square, 4px at most`);
  assert.doesNotMatch(block[1], /999px|pill/i);
});

test('the Beta tag sits beside the wordmark in the title bar', () => {
  const wordmark = titlebar.indexOf('className="wordmark"');
  const tag = titlebar.indexOf('className="beta-tag"');
  assert.ok(wordmark > 0 && tag > wordmark, 'the Beta tag follows the wordmark');
});

test('the XP chip is shown only in the Playful look', () => {
  assert.match(titlebar, /look === 'playful' && profile && <XpChip xp=\{profile\.xp\} \/>/);
});
