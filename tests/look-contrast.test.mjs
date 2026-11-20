// The Playful look (src/styles/playful.css): every text pair meets WCAG AA (4.5 to 1), and every rule sits under
// :root[data-look="playful"], so the Classic look cannot change by accident. The values are read from the file,
// so the design spec (docs/v2/DESIGN.md) and the stylesheet stay in step through this test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'src', 'styles', 'playful.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// The tokens declared under :root[data-look="playful"].
const tokenBlock = css.match(/:root\[data-look='playful'\]\s*\{([\s\S]*?)\n {2}\}/);
assert.ok(tokenBlock, 'playful.css declares the tokens under :root[data-look=\'playful\']');
const tokens = Object.fromEntries([...tokenBlock[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));

const channel = (hex) => {
  const value = Number.parseInt(hex, 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

// The relative luminance of a colour written as #rrggbb.
function luminance(colour) {
  const hex = colour.replace('#', '');
  assert.match(hex, /^[0-9a-fA-F]{6}$/, `${colour} is a six-digit hex colour`);
  return 0.2126 * channel(hex.slice(0, 2)) + 0.7152 * channel(hex.slice(2, 4)) + 0.0722 * channel(hex.slice(4, 6));
}

function ratio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// Resolves a token name, or passes a literal colour through.
const colourOf = (name) => {
  if (name.startsWith('#')) return name;
  assert.ok(tokens[name], `${name} is declared in playful.css`);
  return tokens[name];
};

// Every pair of text and background that the app puts together in the Playful look.
const PAIRS = [
  ['--ink', '--canvas'],
  ['--ink', '#ffffff'],
  ['--ink-2', '--canvas'],
  ['--ink-2', '#ffffff'],
  ['--muted', '--canvas'],
  ['--muted', '#ffffff'],
  ['--muted', '--canvas-2'],
  ['#ffffff', '--primary'],
  ['#ffffff', '--blue'],
  ['#ffffff', '--violet'],
  ['#ffffff', '--red'],
  ['#ffffff', '--hero-a'],
  ['#ffffff', '--hero-b'],
  ['--mint', '--hero-a'],
  ['--sun-ink', '--sun'],
  ['--ink', '--sun'],
  ['--primary', '--primary-50'],
  ['--blue', '--blue-50'],
  ['--violet', '--violet-50'],
  ['--red-ink', '--red-50'],
  ['--primary-700', '--primary-50'],
];

for (const [text, background] of PAIRS) {
  test(`${text} on ${background} meets 4.5 to 1`, () => {
    const contrast = ratio(colourOf(text), colourOf(background));
    assert.ok(contrast >= 4.5, `${text} (${colourOf(text)}) on ${background} (${colourOf(background)}) is ${contrast.toFixed(2)} to 1`);
  });
}

test('every Playful rule sits under :root[data-look="playful"]', () => {
  // Strip the @layer wrapper, then read each rule's selector list.
  const body = css.replace(/^\s*@layer\s+looks\s*\{/, '').replace(/\}\s*$/, '');
  const rules = [...body.matchAll(/([^{}]+)\{/g)].map((match) => match[1].trim());
  const selectors = rules.filter((text) => !text.startsWith('@'));
  for (const selector of selectors) {
    const scoped = selector.split(',').every((part) => part.trim().includes("data-look='playful'") || part.trim().startsWith(':root[data-look'));
    // The token block is scoped by its own selector; every other part must name the look.
    const isTokens = selector === ":root[data-look='playful']";
    assert.ok(isTokens || scoped, `"${selector}" is not scoped to the Playful look`);
  }
});
