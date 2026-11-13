// Profile pictures: a picture that could not be loaded is not remembered, so it is asked for again.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
});

after(async () => {
  await server?.close();
});

test('a picture that could not be loaded is asked for again, a loaded one is kept', async () => {
  // Object URLs exist only in the browser; a stand-in is enough to check the caching.
  globalThis.URL.createObjectURL = () => 'blob:stand-in';
  const { pictureUrl } = await server.ssrLoadModule('/src/lib/avatarCache.ts');

  let calls = 0;
  const missing = () => {
    calls += 1;
    return Promise.resolve(null);
  };
  assert.equal(await pictureUrl('friend:ana:1', missing), null);
  assert.equal(await pictureUrl('friend:ana:1', missing), null);
  assert.equal(calls, 2, 'a missing picture is requested again');

  const failing = () => Promise.reject(new Error('network'));
  assert.equal(await pictureUrl('friend:ana:2', failing), null);

  calls = 0;
  const present = () => {
    calls += 1;
    return Promise.resolve(new Blob(['x'], { type: 'image/webp' }));
  };
  assert.equal(await pictureUrl('friend:bo:1', present), 'blob:stand-in');
  assert.equal(await pictureUrl('friend:bo:1', present), 'blob:stand-in');
  assert.equal(calls, 1, 'a loaded picture is kept in memory');
});
