// The loading screen and the sign-in page show the danna wordmark instead of the old logo. The last setup step takes
// a pasted AI key in the same field Settings uses. A chosen option keeps its tick and its colour in both looks.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

let server;
let keyConnect;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  keyConnect = await server.ssrLoadModule('/src/components/KeyConnect.tsx');
});

after(async () => {
  await server?.close();
});

test('the loading screen and the sign-in page show the danna wordmark, not the old logo', () => {
  for (const file of ['Splash.tsx', 'AuthScreen.tsx']) {
    const source = read('src', 'screens', file);
    assert.doesNotMatch(source, /BrandMark/, `${file} does not draw the logo`);
    assert.match(source, /<Wordmark/, `${file} shows the wordmark`);
  }
});

test('the last setup step takes a pasted AI key, and Settings uses the same field', () => {
  const setup = read('src', 'screens', 'SetupScreen.tsx');
  assert.match(setup, /<KeyConnect autoFocus \/>/, 'the last step has the key field, focused for pasting');
  assert.match(setup, /Prefer to wait\? Add a key later in Settings\./, 'the skip stays in view');
  const settings = read('src', 'screens', 'SettingsScreen.tsx');
  assert.match(settings, /<KeyConnect/, 'Settings uses the shared field');
  assert.doesNotMatch(settings, /type=\{showKey \?/, 'Settings keeps no key field of its own');
});

test('a chosen option shows a tick and keeps its colour in both looks', () => {
  const setup = read('src', 'screens', 'SetupScreen.tsx');
  assert.match(setup, /className="choice__tick"/, 'every option has a tick');
  assert.match(read('src', 'styles', 'app.css'), /\.choice\[aria-checked='true'\] \.choice__tick/, 'the Classic tick fills when chosen');
  assert.match(
    read('src', 'styles', 'playful.css'),
    /:root\[data-look='playful'\] \.choice\[aria-checked='true'\],/,
    'the Playful look keeps the colour of a chosen option',
  );
});

test('a key is recognised by its shape as it is typed', () => {
  const { candidatesFor } = keyConnect;
  assert.deepEqual(candidatesFor('sk-ant-api03-abc'), ['anthropic']);
  assert.deepEqual(candidatesFor('sk-or-v1-abc'), ['openrouter']);
  assert.deepEqual(candidatesFor('sk-proj-abc'), ['openai']);
  assert.deepEqual(candidatesFor('sk-abcdef'), ['openai', 'deepseek']);
  assert.deepEqual(candidatesFor(`AIza${'a'.repeat(35)}`), ['gemini']);
  assert.deepEqual(candidatesFor('hello'), []);
});
