// Version numbers are compared part by part: 2.0.7 is at least 2.0.0, and 1.4.3 is not.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let isVersionAtLeast;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  ({ isVersionAtLeast } = await server.ssrLoadModule('/src/lib/version.ts'));
});

after(async () => {
  await server?.close();
});

test('a version is at least the V2 start when its parts are not lower', () => {
  assert.equal(isVersionAtLeast('2.0.0', '2.0.0'), true);
  assert.equal(isVersionAtLeast('2.0.7', '2.0.0'), true);
  assert.equal(isVersionAtLeast('10.0.0', '2.0.0'), true);
  assert.equal(isVersionAtLeast('2', '2.0.0'), true);
});

test('a version before the V2 start is not at least it', () => {
  assert.equal(isVersionAtLeast('1.4.3', '2.0.0'), false);
  assert.equal(isVersionAtLeast('1.99.0', '2.0.0'), false);
  assert.equal(isVersionAtLeast('1.0.0', '2.0.0'), false);
});
