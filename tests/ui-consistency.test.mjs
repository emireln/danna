// Checks the screens against the styles. Every class name that a screen writes as plain text must have a
// rule in the stylesheets: a class without a rule is an element the layout does not know about, which is
// where spacing and alignment drift starts. Colours that the screens write by hand must be design tokens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');

function filesIn(folder, extensions) {
  const out = [];
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) out.push(...filesIn(path, extensions));
    else if (extensions.some((extension) => name.endsWith(extension))) out.push(path);
  }
  return out;
}

const styles = filesIn(join(src, 'styles'), ['.css']).map((path) => readFileSync(path, 'utf8')).join('\n');
const screens = filesIn(src, ['.tsx']).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
// The Classic look is the palette in app.css; the Playful look is in playful.css and defines its own colours.
const classicPalette = readFileSync(join(src, 'styles', 'app.css'), 'utf8');

// Every deck colour is a token that the Classic look defines: a swatch without its colour is an empty button.
test('every deck colour has its colour in the Classic palette', () => {
  const deckStyles = readFileSync(join(src, 'styles', 'decks.css'), 'utf8');
  const colours = [...deckStyles.matchAll(/\.deck-colour--(\w+)\s*\{/g)].map((match) => match[1]);
  assert.ok(colours.length >= 6, `the deck colours are styled, got ${colours.length}`);
  for (const colour of colours) {
    assert.match(classicPalette, new RegExp(`--${colour}:\\s*#[0-9a-f]{6};`, 'i'), `--${colour} is defined in app.css`);
  }
});


// Classes a screen writes as plain text: className="a b c". Dynamic parts (with braces) are left out.
function staticClasses(text) {
  const out = new Set();
  for (const match of text.matchAll(/className="([^"]*)"/g)) {
    for (const token of match[1].split(/\s+/)) if (token && !/[{}$]/.test(token)) out.add(token);
  }
  return out;
}

function hasRule(token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\.${escaped}(?![\\w-])`).test(styles);
}

// Classes that the browser or the libraries provide, so they never need a rule of ours.
const LIBRARY_CLASSES = new Set(['sr-only']);

test('every class a screen writes by hand has a style rule', () => {
  const missing = new Map();
  for (const screen of screens) {
    for (const token of staticClasses(screen.text)) {
      if (LIBRARY_CLASSES.has(token) || hasRule(token)) continue;
      if (!missing.has(token)) missing.set(token, []);
      missing.get(token).push(screen.path.replace(src, 'src'));
    }
  }
  const report = [...missing.entries()].map(([token, where]) => `${token} (${[...new Set(where)].join(', ')})`);
  assert.deepEqual(report, [], 'classes without a rule');
});

test('the screens use the colour tokens, not hard-coded colours', () => {
  const found = [];
  for (const screen of screens) {
    for (const match of screen.text.matchAll(/#[0-9a-fA-F]{6}\b/g)) found.push(`${match[0]} in ${screen.path.replace(src, 'src')}`);
  }
  // Brand and chart colours are given as data (the skill colours, the report chart) and are allowed.
  const allowed = [/TodayScreen\.tsx/, /StudyScreen\.tsx/, /ReportScreen\.tsx/, /RoadmapScreen\.tsx/, /charts\.tsx/, /art\.ts/];
  const hard = found.filter((item) => !allowed.some((pattern) => pattern.test(item)));
  assert.deepEqual(hard, [], 'hard-coded colours outside the data screens');
});

test('the layout tokens and the page header are defined once', () => {
  assert.equal((styles.match(/\.page-header\s*\{/g) ?? []).length, 1, 'one .page-header rule');
  assert.equal((styles.match(/\.section-title\s*\{/g) ?? []).length, 1, 'one .section-title rule');
  assert.match(styles, /--space-1:/, 'the spacing scale is defined');
});
