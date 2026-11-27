// The sign-in panel: one picture, the app's own, fixed in the middle. It is not placed at random and it does not move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

test('the sign-in panel shows the app\'s own picture only', () => {
  const brand = read('src', 'components', 'AuthBrand.tsx');
  assert.match(brand, /danna-3d-logo\.webp/);
  assert.doesNotMatch(brand, /botdanna/i, 'the other app\'s picture is not shown');
  assert.doesNotMatch(brand, /recovery/i, 'the recovery picture is not shown');
  assert.doesNotMatch(brand, /Math\.random|placeArt|authArt/, 'the picture is not placed at random');
});

test('the picture sits in the middle of the panel, and it is large', () => {
  const css = read('src', 'styles', 'app.css');
  const rule = css.match(/\.auth-brand__art \{([^}]*)\}/);
  assert.ok(rule, 'the picture has a rule');
  assert.match(rule[1], /top:\s*50%/);
  assert.match(rule[1], /left:\s*50%/);
  assert.match(rule[1], /translate\(-50%, -50%\)/);
  assert.match(rule[1], /height:\s*8\d%/, 'the picture fills most of the panel');
});

test('the sign-in screen uses the panel without choosing pictures', () => {
  const screen = read('src', 'screens', 'AuthScreen.tsx');
  assert.match(screen, /<AuthBrand \/>/);
  assert.doesNotMatch(screen, /SIGN_IN_ART|RESET_ART/);
});
