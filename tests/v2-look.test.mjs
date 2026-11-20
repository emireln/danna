// The look of a profile: a missing or unknown look is Classic, and the desktop database knows the same two
// looks as the app. The Settings picker and the page attribute are checked by the component tests.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
let server;
let lookOf;
let LOOKS;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  ({ lookOf } = await server.ssrLoadModule('/src/lib/look.ts'));
  ({ LOOKS } = await server.ssrLoadModule('/src/lib/types.ts'));
});

after(async () => {
  await server?.close();
});

test('a profile without a look, or with an unknown one, is Classic', () => {
  assert.equal(lookOf(null), 'classic');
  assert.equal(lookOf(undefined), 'classic');
  assert.equal(lookOf({}), 'classic');
  assert.equal(lookOf({ ui_style: 'neon' }), 'classic');
  assert.equal(lookOf({ ui_style: 'playful' }), 'playful');
});

test('the desktop database knows the same two looks as the app', () => {
  const localdb = readFileSync(join(root, 'electron', 'localdb.cjs'), 'utf8');
  const declared = localdb.match(/const LOOKS = (\[[^\]]*\]);/);
  assert.ok(declared, 'electron/localdb.cjs declares LOOKS');
  assert.deepEqual(JSON.parse(declared[1].replace(/'/g, '"')), [...LOOKS]);
});
