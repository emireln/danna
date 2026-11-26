// Tests for the storage gateway (worker/storage/src/index.js). Supabase and R2 are replaced by fakes, so no request leaves
// this machine. Each test loads a fresh copy of the gateway, so its key and usage caches start empty.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const SUPABASE = 'https://test-project.supabase.co';
const APP = 'app://danna';
const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const KID = 'test-key';
const LIMIT = 1000; // the level at which new files go to R2, in these tests

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const otherKey = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const publicJwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: KID, alg: 'ES256', use: 'sig' };
const avatar = `/object/avatars/${ALICE}/avatar.webp`;

const encode = (bytes) => Buffer.from(bytes).toString('base64url');

// A sign-in as Supabase makes it: an ES256 token with a key id, the project as issuer, and the authenticated audience.
async function signIn(claims = {}, options = {}) {
  const header = encode(new TextEncoder().encode(JSON.stringify({ alg: options.alg ?? 'ES256', kid: KID, typ: 'JWT' })));
  const payload = encode(
    new TextEncoder().encode(
      JSON.stringify({
        iss: `${SUPABASE}/auth/v1`,
        aud: 'authenticated',
        role: 'authenticated',
        sub: ALICE,
        exp: Math.floor(Date.now() / 1000) + 3600,
        ...claims,
      }),
    ),
  );
  const signed = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, options.key ?? pair.privateKey, signed);
  return `${header}.${payload}.${encode(new Uint8Array(signature))}`;
}

// R2 as the gateway uses it: put, get and delete, with the removals recorded.
class FakeR2 {
  constructor() {
    this.items = new Map();
    this.deleted = [];
  }
  async put(key, value, options = {}) {
    this.items.set(key, { bytes: new Uint8Array(value), type: options.httpMetadata?.contentType });
  }
  async get(key) {
    const item = this.items.get(key);
    if (!item) return null;
    return { body: new Response(item.bytes).body, httpMetadata: { contentType: item.type } };
  }
  async delete(key) {
    this.deleted.push(key);
    this.items.delete(key);
  }
}

const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Answers the calls the gateway makes to Supabase, and records each call so a test can check what was sent.
function fakeSupabase(state) {
  return async (input, init = {}) => {
    const url = String(input);
    const method = (init.method || 'GET').toUpperCase();
    state.calls.push({ url, method, headers: init.headers || {}, body: init.body });
    if (url === `${SUPABASE}/auth/v1/.well-known/jwks.json`) return reply({ keys: [publicJwk] });
    if (url === `${SUPABASE}/rest/v1/rpc/storage_used_bytes`) {
      return state.usageFails ? reply({ message: 'down' }, 503) : reply(state.usage);
    }
    if (url.startsWith(`${SUPABASE}/rest/v1/rpc/can_read_`)) return reply(state.canRead === true);
    if (url.startsWith(`${SUPABASE}/storage/v1/object/`)) {
      if (method === 'POST') {
        return state.refuseUpload
          ? reply({ message: 'The object exceeded the maximum allowed size' }, 413)
          : reply({ Key: 'stored' });
      }
      if (method === 'GET') {
        return state.stored
          ? new Response(state.stored, { headers: { 'content-type': 'image/webp' } })
          : reply({ message: 'Object not found' }, 400);
      }
      if (method === 'DELETE') return reply({ message: 'Successfully deleted' });
    }
    return reply({ message: 'unexpected call' }, 500);
  };
}

// A fresh gateway with its own fake R2 and fake Supabase.
async function gateway(state, bucket = new FakeR2()) {
  globalThis.fetch = fakeSupabase(state);
  const worker = (await import(`../src/index.js?test=${Math.random()}`)).default;
  const env = {
    FILES: bucket,
    SUPABASE_URL: SUPABASE,
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'secret-key-test',
    ALLOWED_ORIGINS: `${APP},https://hub.danna.run`,
    STORAGE_THRESHOLD_BYTES: String(LIMIT),
  };
  return { bucket, send: (req) => worker.fetch(req, env) };
}

function request(method, path, { token, origin = APP, type, length, body } = {}) {
  const headers = {};
  if (origin) headers.origin = origin;
  if (token) headers.authorization = `Bearer ${token}`;
  if (type) headers['content-type'] = type;
  if (length !== undefined) headers['content-length'] = String(length);
  return new Request(`https://storage.test${path}`, { method, headers, body });
}

test('the gateway answers the browser check for its apps, and refuses any other origin', async () => {
  const { send } = await gateway({ calls: [], usage: 0 });
  const check = await send(request('OPTIONS', avatar));
  assert.equal(check.status, 204);
  assert.equal(check.headers.get('access-control-allow-origin'), APP);
  const other = await send(request('GET', avatar, { origin: 'https://evil.example', token: await signIn() }));
  assert.equal(other.status, 403);
});

test('a request without a valid Supabase sign-in is refused', async () => {
  const { send } = await gateway({ calls: [], usage: 0 });
  assert.equal((await send(request('GET', avatar))).status, 401, 'no sign-in');
  assert.equal((await send(request('GET', avatar, { token: await signIn({}, { alg: 'HS256' }) }))).status, 401, 'another algorithm');
  assert.equal((await send(request('GET', avatar, { token: await signIn({}, { key: otherKey.privateKey }) }))).status, 401, 'a forged signature');
  assert.equal((await send(request('GET', avatar, { token: await signIn({ exp: 1000 }) }))).status, 401, 'an expired sign-in');
  assert.equal(
    (await send(request('GET', avatar, { token: await signIn({ iss: 'https://elsewhere.example/auth/v1' }) }))).status,
    401,
    'another project',
  );
});

test('while Supabase Storage has room, a picture is saved there, and an old copy in R2 is removed', async () => {
  const state = { calls: [], usage: 100 };
  const { bucket, send } = await gateway(state);
  bucket.items.set(`avatars/${ALICE}/avatar.webp`, { bytes: new Uint8Array([1]), type: 'image/webp' });
  const response = await send(
    request('PUT', avatar, { token: await signIn(), type: 'image/webp', length: 4, body: new Uint8Array([1, 2, 3, 4]) }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { backend: 'supabase' });
  const upload = state.calls.find(
    (call) => call.method === 'POST' && call.url === `${SUPABASE}/storage/v1/object/avatars/${ALICE}/avatar.webp`,
  );
  assert.ok(upload, 'the picture is sent to Supabase Storage');
  assert.equal(upload.headers['x-upsert'], 'true');
  assert.deepEqual(bucket.deleted, [`avatars/${ALICE}/avatar.webp`]);
});

test('once Supabase Storage is nearly full, a new picture goes to R2 and its Supabase copy is removed', async () => {
  const state = { calls: [], usage: LIMIT + 500 };
  const { bucket, send } = await gateway(state);
  const response = await send(
    request('PUT', avatar, { token: await signIn(), type: 'image/webp', length: 4, body: new Uint8Array([1, 2, 3, 4]) }),
  );
  assert.deepEqual(await response.json(), { backend: 'r2' });
  assert.ok(bucket.items.has(`avatars/${ALICE}/avatar.webp`));
  assert.equal(
    state.calls.some((call) => call.method === 'POST' && call.url.includes('/storage/v1/object/')),
    false,
    'nothing is sent to Supabase Storage',
  );
  const removal = state.calls.find((call) => call.method === 'DELETE' && call.url === `${SUPABASE}/storage/v1/object/avatars`);
  assert.deepEqual(JSON.parse(removal.body), { prefixes: [`${ALICE}/avatar.webp`] });
  const usageCall = state.calls.find((call) => call.url.endsWith('/rpc/storage_used_bytes'));
  assert.equal(usageCall.headers.apikey, 'secret-key-test', 'the amount in use is read with the secret key');
  assert.equal(usageCall.headers.authorization, undefined, 'the secret key is sent in the apikey header only');
});

test('nobody writes into another person folder, or under another file name', async () => {
  const { send } = await gateway({ calls: [], usage: 0 });
  const token = await signIn();
  const intoBob = await send(
    request('PUT', `/object/avatars/${BOB}/avatar.webp`, { token, type: 'image/webp', length: 2, body: new Uint8Array([1, 2]) }),
  );
  assert.equal(intoBob.status, 403);
  const renamed = await send(
    request('PUT', `/object/avatars/${ALICE}/other.webp`, { token, type: 'image/webp', length: 2, body: new Uint8Array([1, 2]) }),
  );
  assert.equal(renamed.status, 403);
  const removeBobs = await send(request('DELETE', `/object/avatars/${BOB}/avatar.webp`, { token }));
  assert.equal(removeBobs.status, 403);
});

test('a file of the wrong type, or too big for its bucket, is refused', async () => {
  const { send } = await gateway({ calls: [], usage: 0 });
  const token = await signIn();
  const wrongType = await send(request('PUT', avatar, { token, type: 'text/html', length: 2, body: new Uint8Array([1, 2]) }));
  assert.equal(wrongType.status, 415);
  const tooBig = await send(request('PUT', avatar, { token, type: 'image/webp', length: 400000, body: new Uint8Array([1, 2]) }));
  assert.equal(tooBig.status, 413);
});

test('a picture kept in R2 is read only where the database allows it', async () => {
  const state = { calls: [], usage: LIMIT + 1, canRead: false };
  const bucket = new FakeR2();
  bucket.items.set(`avatars/${ALICE}/avatar.webp`, { bytes: new Uint8Array([9, 9]), type: 'image/webp' });
  const { send } = await gateway(state, bucket);
  const outsider = await send(request('GET', avatar, { token: await signIn({ sub: BOB }) }));
  assert.equal(outsider.status, 404, 'a person without access gets nothing');
  state.canRead = true;
  const friend = await send(request('GET', avatar, { token: await signIn({ sub: BOB }) }));
  assert.equal(friend.status, 200);
  assert.deepEqual(new Uint8Array(await friend.arrayBuffer()), new Uint8Array([9, 9]));
  assert.equal(friend.headers.get('content-type'), 'image/webp');
});

test('a picture still in Supabase Storage is read through the gateway, with the sign-in of the person reading it', async () => {
  const state = { calls: [], usage: 0, stored: new Uint8Array([5, 6, 7]) };
  const { send } = await gateway(state);
  const token = await signIn({ sub: BOB });
  const response = await send(request('GET', avatar, { token }));
  assert.equal(response.status, 200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([5, 6, 7]));
  const download = state.calls.find(
    (call) => call.method === 'GET' && call.url === `${SUPABASE}/storage/v1/object/avatars/${ALICE}/avatar.webp`,
  );
  assert.equal(download.headers.authorization, `Bearer ${token}`);
});

test('a library file kept in R2 is read and changed only by its owner', async () => {
  const state = { calls: [], usage: LIMIT + 1 };
  const { send } = await gateway(state);
  const file = `/object/library/${ALICE}/doc-1.md`;
  const written = await send(
    request('PUT', file, { token: await signIn(), type: 'text/markdown', length: 5, body: new TextEncoder().encode('Hello') }),
  );
  assert.deepEqual(await written.json(), { backend: 'r2' });
  assert.equal((await send(request('GET', file, { token: await signIn({ sub: BOB }) }))).status, 404, 'another person cannot read it');
  assert.equal((await send(request('GET', file, { token: await signIn() }))).status, 200, 'the owner reads it');
  const overwrite = await send(
    request('PUT', file, { token: await signIn({ sub: BOB }), type: 'text/markdown', length: 2, body: new Uint8Array([1, 2]) }),
  );
  assert.equal(overwrite.status, 403, 'another person cannot write it');
});

test('if the amount in use cannot be read, the file goes to Supabase Storage', async () => {
  const state = { calls: [], usageFails: true };
  const { bucket, send } = await gateway(state);
  const response = await send(
    request('PUT', avatar, { token: await signIn(), type: 'image/webp', length: 2, body: new Uint8Array([1, 2]) }),
  );
  assert.deepEqual(await response.json(), { backend: 'supabase' });
  assert.equal(bucket.items.size, 0);
});

test('a file that Supabase Storage refuses is reported with its reason', async () => {
  const state = { calls: [], usage: 0, refuseUpload: true };
  const { send } = await gateway(state);
  const response = await send(
    request('PUT', avatar, { token: await signIn(), type: 'image/webp', length: 2, body: new Uint8Array([1, 2]) }),
  );
  assert.equal(response.status, 413);
  assert.match((await response.json()).error, /maximum allowed size/);
});

test('a delete removes both copies, and only the owner can make it', async () => {
  const state = { calls: [], usage: 0 };
  const bucket = new FakeR2();
  bucket.items.set(`avatars/${ALICE}/avatar.webp`, { bytes: new Uint8Array([1]), type: 'image/webp' });
  const { send } = await gateway(state, bucket);
  const denied = await send(request('DELETE', avatar, { token: await signIn({ sub: BOB }) }));
  assert.equal(denied.status, 403);
  const removed = await send(request('DELETE', avatar, { token: await signIn() }));
  assert.equal(removed.status, 200);
  assert.deepEqual(bucket.deleted, [`avatars/${ALICE}/avatar.webp`]);
  assert.ok(state.calls.some((call) => call.method === 'DELETE' && call.url === `${SUPABASE}/storage/v1/object/avatars`));
});

test('a path that climbs out of its folder is refused', async () => {
  const { send } = await gateway({ calls: [], usage: 0 });
  const response = await send(request('GET', `/object/avatars/${ALICE}%2F..%2Fsecret.webp`, { token: await signIn() }));
  assert.equal(response.status, 404);
});
