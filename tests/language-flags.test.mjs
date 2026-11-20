// The language tabs show each language by its flag. The flags are SVG files, kept out of the screens so the
// colour check can keep the screens to the design tokens. These checks read the files and the switch that uses them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const languages = [...read('lib', 'i18n', 'index.ts').matchAll(/code: '(\w+)'/g)].map((match) => match[1]);
const switcher = read('components', 'LanguageSwitch.tsx');
const tabs = read('components', 'ui.tsx');
const usFlag = read('assets', 'flags', 'us.svg');
const brFlag = read('assets', 'flags', 'br.svg');

test('every language on the switch has its flag', () => {
  assert.deepEqual(languages, ['en', 'pt']);
  assert.match(switcher, /const FLAGS: Record<Lang, string> = \{ en: usFlag, pt: brFlag \};/);
  assert.match(switcher, /import usFlag from '\.\.\/assets\/flags\/us\.svg';/);
  assert.match(switcher, /import brFlag from '\.\.\/assets\/flags\/br\.svg';/);
  for (const file of ['us.svg', 'br.svg']) {
    assert.ok(existsSync(join(src, 'assets', 'flags', file)), `${file} exists`);
  }
});

test('the flags are drawn in the official colours', () => {
  // United States: thirteen stripes, a blue canton and fifty white stars (one path of fifty subpaths).
  assert.match(usFlag, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 7410 3900">/);
  for (const colour of ['#B22234', '#3C3B6E', '#FFFFFF']) assert.match(usFlag, new RegExp(colour, 'i'));
  assert.equal((usFlag.match(/<rect y=/g) ?? []).length, 13, 'thirteen stripes');
  assert.equal((usFlag.match(/M/g) ?? []).length, 50, 'fifty stars');
  // Brazil: the green field, the yellow rhombus and the blue globe with its white band.
  assert.match(brFlag, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 1000 700">/);
  for (const colour of ['#009C3B', '#FFDF00', '#002776', '#FFFFFF']) assert.match(brFlag, new RegExp(colour, 'i'));
});

test('the flag is decorative, and the language name stays on the tab for screen readers', () => {
  assert.match(switcher, /<img className="lang-flag" src=\{FLAGS\[item\.code\]\} alt="" \/>/);
  assert.match(switcher, /iconOnly: true/);
  assert.match(tabs, /title=\{item\.iconOnly \? item\.label : undefined\}/);
  assert.match(tabs, /\{item\.iconOnly \? <span className="sr-only">\{item\.label\}<\/span> : item\.label\}/);
});
