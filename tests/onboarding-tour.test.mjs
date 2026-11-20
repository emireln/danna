// The onboarding starts with the language and the look, before the name. After the setup, the tour walks past the main
// buttons, and each step names a button that the app marks for it with data-tour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', 'src', ...parts), 'utf8');

const welcome = read('screens', 'WelcomeScreen.tsx');
const setup = read('screens', 'SetupScreen.tsx');
const tour = read('components', 'Tour.tsx');
const shell = read('components', 'Shell.tsx');
const titlebar = read('components', 'TitleBar.tsx');
const settings = read('screens', 'SettingsScreen.tsx');
const whatsNew = read('screens', 'WhatsNewScreen.tsx');

test('the welcome asks for the language first, before the introduction', () => {
  const language = welcome.indexOf("t('Choose your language')");
  const intro = welcome.indexOf("t('Learn English, one small step at a time.')");
  assert.ok(language > 0 && intro > language, 'the language step comes before the introduction');
  assert.match(welcome, /setLang\(item\.code\)/, 'a language card sets the language');
});

test('the setup asks for the look before the name, and saves it to the profile', () => {
  assert.match(setup, /const STEPS = \['Look', 'Name', /, 'the look is the first step');
  const look = setup.indexOf('<LookPicker');
  const name = setup.indexOf("t('What should danna call you?')");
  assert.ok(look > 0 && name > look, 'the look picker comes before the name');
  assert.match(setup, /patchProfile\(\{ ui_style: next \}\)/, 'the look is saved to the profile');
});

test('finishing the setup offers the tour once, on Today', () => {
  assert.match(setup, /setTourStatus\('offer'\)/);
  assert.match(tour, /location\.pathname === '\/' && readTourStatus\(\) === 'offer'/);
});

test('every tour step names a button that the app marks for the tour', () => {
  const targets = [...tour.matchAll(/target: '([a-z-]+)'/g)].map((match) => match[1]);
  assert.ok(targets.length >= 6, 'the tour has its steps');
  const marked = shell + titlebar;
  for (const target of targets) {
    const found = marked.includes(`data-tour="${target}"`) || marked.includes(`tour: '${target}'`);
    assert.ok(found, `the app marks the ${target} button for the tour`);
  }
});

test('Settings starts the tour again', () => {
  assert.match(settings, /navigate\('\/', \{ state: \{ tour: true \} \}\)/);
  assert.match(tour, /if \(state\?\.tour\) start\(\)/);
});

test('the release notes show the V2 notes first, highlighted', () => {
  assert.match(whatsNew, /isVersionAtLeast\(release\.version, V2_FROM\)/);
  assert.match(whatsNew, /release--v2/);
});
