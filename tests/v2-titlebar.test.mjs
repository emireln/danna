// The title bar: the wordmark, then the streak and no badge or XP chip. In the Playful look the streak takes the sun-yellow
// look that the XP badge had.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');
const titlebar = read('src', 'components', 'TitleBar.tsx');

test('the title bar has no V2 BETA badge', () => {
  assert.doesNotMatch(titlebar, /beta-badge|V2 BETA|whats-new/, 'the badge and its link to the release notes are gone');
});

test('the title bar shows the streak only, and no XP badge in either look', () => {
  assert.doesNotMatch(titlebar, /XpChip|xp-chip/, 'the XP badge is gone from the title bar');
  assert.match(titlebar, /<StreakFire days=\{streak\} \/>/, 'the streak badge stays');
});

test('the streak takes the XP badge look in the Playful look', () => {
  const playful = read('src', 'styles', 'playful.css');
  assert.match(playful, /:root\[data-look='playful'\] \.streak,\s*:root\[data-look='playful'\] \.streak--ruby/, 'the streak is restyled');
  assert.match(playful, /:root\[data-look='playful'\] \.streak[\s\S]*?background: var\(--sun\);/, 'it is sun-coloured like the XP badge');
});
