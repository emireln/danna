// The storage gateway client (src/lib/data/storageGateway.ts): the address of each file, what is sent with it, and what a
// missing file or a refusal gives back. The network is replaced by a fake, so no request leaves this machine.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let server;
let makeStorageGateway;
let realFetch;

before(async () => {
  realFetch = globalThis.fetch;
  server = await createServer({ root, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true } });
  ({ makeStorageGateway } = await server.ssrLoadModule('/src/lib/data/storageGateway.ts'));
});

after(async () => {
  globalThis.fetch = realFetch;
  await server?.close();
});

// Replaces fetch with an answer for each call, and records the calls.
function answering(answer) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    return answer(String(url), init);
  };
  return calls;
}

test('a file has its own address: the slashes of its path stay, and each part is encoded', async () => {
  const calls = answering(() => new Response(null, { status: 200 }));
  const gateway = makeStorageGateway('https://files.example.test/');
  await gateway.remove('library', 'user-1/my file.md', 'token-1');
  assert.equal(calls[0].url, 'https://files.example.test/object/library/user-1/my%20file.md');
});

test('an upload is a PUT with the sign-in and the type of the file', async () => {
  const calls = answering(() => new Response(null, { status: 200 }));
  const gateway = makeStorageGateway('https://files.example.test');
  await gateway.upload('avatars', 'user-1/avatar.webp', new Blob(['abc']), 'image/webp', 'token-1');
  assert.equal(calls[0].method, 'PUT');
  assert.equal(calls[0].headers.authorization, 'Bearer token-1');
  assert.equal(calls[0].headers['content-type'], 'image/webp');
});

test('a download returns the file, and sends the sign-in', async () => {
  const calls = answering(() => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
  const gateway = makeStorageGateway('https://files.example.test');
  const blob = await gateway.download('avatars', 'user-1/avatar.webp', 'token-1');
  assert.equal(blob.size, 3);
  assert.equal(calls[0].headers.authorization, 'Bearer token-1');
});

test('a file that is not there downloads as null, without an error', async () => {
  answering(() => new Response('{"error":"Not found."}', { status: 404, headers: { 'content-type': 'application/json' } }));
  const gateway = makeStorageGateway('https://files.example.test');
  assert.equal(await gateway.download('avatars', 'user-1/avatar.webp', 'token-1'), null);
});

test('a refusal throws the message the gateway sends', async () => {
  answering(
    () => new Response('{"error":"That file is too big to save."}', { status: 413, headers: { 'content-type': 'application/json' } }),
  );
  const gateway = makeStorageGateway('https://files.example.test');
  await assert.rejects(
    gateway.upload('avatars', 'user-1/avatar.webp', new Blob(['x']), 'image/webp', 'token-1'),
    /too big to save/,
  );
});

test('a removal is a DELETE with the sign-in', async () => {
  const calls = answering(() => new Response(null, { status: 200 }));
  const gateway = makeStorageGateway('https://files.example.test');
  await gateway.remove('profile-banners', 'user-1/banner.webp', 'token-1');
  assert.equal(calls[0].method, 'DELETE');
  assert.equal(calls[0].headers.authorization, 'Bearer token-1');
});
