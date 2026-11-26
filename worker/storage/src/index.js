// The storage gateway for Danna and Botdanna (setup: README.md in this folder).
//
// Profile pictures, banners and library files live in Supabase Storage. Once Supabase Storage holds STORAGE_THRESHOLD_BYTES
// (400 MB by default), new files go to Cloudflare R2 instead. A file is kept in one place only: a write removes the other
// copy, and a read looks in R2 first.
//
// Every request carries the person's Supabase sign-in. The gateway checks it with the project's public key, and it applies
// the rules of the storage policies: a person writes only in their own folder, reads their own files, and reads a friend's
// picture only where the database allows it. The service-role key is used for one thing: adding up the storage in use.

const DEFAULT_THRESHOLD_BYTES = 400 * 1024 * 1024;
const USAGE_TTL_MS = 60 * 1000;
const KEYS_TTL_MS = 10 * 60 * 1000;
const KEYS_RETRY_MS = 60 * 1000;
const READ_CACHE = 'private, max-age=300';

// The buckets the apps use, with the same types and sizes as their Supabase buckets.
const BUCKETS = {
  avatars: { types: ['image/webp'], maxBytes: 307200, ownName: 'avatar.webp', canRead: 'can_read_avatar' },
  'profile-banners': { types: ['image/webp'], maxBytes: 491520, ownName: 'banner.webp', canRead: 'can_read_banner' },
  library: { types: ['application/pdf', 'text/plain', 'text/markdown'], maxBytes: 20971520, ownName: null, canRead: null },
};

let keys = { fetchedAt: 0, list: [] };
let usage = { checkedAt: 0, bytes: 0 };

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const origin = request.headers.get('origin') || '';
    if (origin && !allowed.includes(origin)) return json({ error: 'This app cannot use the storage.' }, 403);
    const cors = origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
          'access-control-allow-headers': 'authorization, content-type, cache-control',
          'access-control-max-age': '600',
        },
      });
    }

    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true }, 200, cors);
    const match = /^\/object\/([a-z-]+)\/(.+)$/.exec(url.pathname);
    if (!match || !BUCKETS[match[1]]) return json({ error: 'Not found.' }, 404, cors);
    const bucket = match[1];
    let path;
    try {
      path = decodeURIComponent(match[2]);
    } catch {
      return json({ error: 'Not found.' }, 404, cors);
    }
    if (!plainPath(path)) return json({ error: 'Not found.' }, 404, cors);

    const user = await verifySignIn(request, env);
    if (!user) return json({ error: 'Sign in to use the storage.' }, 401, cors);

    let response;
    if (request.method === 'GET') {
      response = await readFile(env, user, bucket, path);
    } else if (request.method === 'PUT' || request.method === 'DELETE') {
      if (!ownFile(bucket, path, user.uid)) return json({ error: 'You can only change your own files.' }, 403, cors);
      response =
        request.method === 'PUT'
          ? await writeFile(request, env, user, bucket, path)
          : await removeFile(env, user, bucket, path);
    } else {
      return json({ error: 'Method not allowed.' }, 405, cors);
    }
    return withHeaders(response, cors);
  },
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

function withHeaders(response, extra) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}

// A plain relative path: no empty part, no "." or "..", and no control characters or backslashes.
function plainPath(path) {
  if (!path || path.length > 300 || /[\u0000-\u001f\\]/.test(path)) return false;
  return path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

// Writes and removals are allowed only in the person's own folder, and a picture only under its own file name.
function ownFile(bucket, path, uid) {
  const parts = path.split('/');
  const rule = BUCKETS[bucket];
  if (parts[0] !== uid) return false;
  return rule.ownName ? parts.length === 2 && parts[1] === rule.ownName : parts.length >= 2;
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function objectKey(bucket, path) {
  return `${bucket}/${path}`;
}

function supabaseHeaders(env, token, extra = {}) {
  return { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}`, ...extra };
}

function fromBase64Url(text) {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

// The public keys of the Supabase project, cached. A key id that is not in the cache refreshes the list, once a minute at most.
async function signingKey(kid, env) {
  const age = Date.now() - keys.fetchedAt;
  const known = keys.list.some((key) => key.kid === kid);
  if (age > KEYS_TTL_MS || (!known && age > KEYS_RETRY_MS)) {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
    if (response.ok) {
      const body = await response.json();
      keys = { fetchedAt: Date.now(), list: Array.isArray(body.keys) ? body.keys : [] };
    }
  }
  const jwk = keys.list.find((key) => key.kid === kid && key.kty === 'EC' && key.crv === 'P-256');
  if (!jwk) return null;
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
}

// The person's id and their sign-in, when the request carries a valid Supabase sign-in; otherwise null.
async function verifySignIn(request, env) {
  const match = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(request.headers.get('authorization') || '');
  if (!match) return null;
  const token = match[1];
  const [headerPart, payloadPart, signaturePart] = token.split('.');
  try {
    const header = JSON.parse(new TextDecoder().decode(fromBase64Url(headerPart)));
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadPart)));
    if (header.alg !== 'ES256' || typeof header.kid !== 'string') return null;
    const key = await signingKey(header.kid, env);
    if (!key) return null;
    const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromBase64Url(signaturePart), signed);
    if (!valid) return null;
    if (claims.iss !== `${env.SUPABASE_URL}/auth/v1` || claims.aud !== 'authenticated') return null;
    if (typeof claims.exp !== 'number' || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    if (typeof claims.sub !== 'string' || !/^[0-9a-f-]{36}$/.test(claims.sub)) return null;
    return { uid: claims.sub, token };
  } catch {
    return null;
  }
}

// The storage in use, as Supabase counts it. The secret key (SUPABASE_SECRET_KEY, or the older SUPABASE_SERVICE_ROLE_KEY
// name) is sent in the apikey header only: a secret key is not a person's sign-in, so it has no Authorization header.
async function storageInUse(env) {
  if (Date.now() - usage.checkedAt < USAGE_TTL_MS) return usage.bytes;
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('no secret key is set (SUPABASE_SECRET_KEY)');
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/storage_used_bytes`, {
    method: 'POST',
    headers: { apikey: secret, 'content-type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) throw new Error(`the storage total was refused with status ${response.status}`);
  const bytes = Number(await response.json());
  if (!Number.isFinite(bytes) || bytes < 0) throw new Error('the storage total is not a number');
  usage = { checkedAt: Date.now(), bytes };
  return bytes;
}

// New files go to R2 once Supabase Storage holds the threshold or more. If the amount cannot be read, Supabase is used.
// Each decision is logged, without any key, so a missing secret or a refused key shows in the Worker's logs.
async function usesR2(env) {
  const threshold = Number(env.STORAGE_THRESHOLD_BYTES) || DEFAULT_THRESHOLD_BYTES;
  try {
    const bytes = await storageInUse(env);
    const toR2 = bytes >= threshold;
    console.log(JSON.stringify({ event: 'storage-decision', bytes, threshold, backend: toR2 ? 'r2' : 'supabase' }));
    return toR2;
  } catch (error) {
    console.log(JSON.stringify({ event: 'storage-decision', error: String(error.message), backend: 'supabase' }));
    return false;
  }
}

// Whether the person may read a file kept in R2: the same answer the storage policies give for Supabase Storage.
async function mayRead(env, user, bucket, path) {
  const rule = BUCKETS[bucket];
  if (!rule.canRead) return path.split('/')[0] === user.uid;
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${rule.canRead}`, {
    method: 'POST',
    headers: supabaseHeaders(env, user.token, { 'content-type': 'application/json' }),
    body: JSON.stringify({ object_name: path }),
  });
  return response.ok && (await response.json()) === true;
}

async function readFile(env, user, bucket, path) {
  const stored = await env.FILES.get(objectKey(bucket, path));
  if (stored) {
    if (!(await mayRead(env, user, bucket, path))) return json({ error: 'Not found.' }, 404);
    return new Response(stored.body, {
      headers: {
        'content-type': stored.httpMetadata?.contentType || 'application/octet-stream',
        'cache-control': READ_CACHE,
      },
    });
  }
  // Not in R2, so the file is in Supabase Storage. The storage policies decide, with the person's own sign-in.
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${encodePath(path)}`, {
    headers: supabaseHeaders(env, user.token),
  });
  if (response.ok) {
    return new Response(response.body, {
      headers: {
        'content-type': response.headers.get('content-type') || 'application/octet-stream',
        'cache-control': READ_CACHE,
      },
    });
  }
  if (response.status >= 500) return json({ error: 'The file could not be opened. Try again in a moment.' }, 502);
  return json({ error: 'Not found.' }, 404);
}

async function storageError(response) {
  let message = 'The file could not be saved. Try again in a moment.';
  try {
    const body = await response.json();
    message = body.message || body.error || message;
  } catch {
    // The answer was not JSON, so the general message is used.
  }
  const status = response.status === 413 ? 413 : response.status >= 500 ? 502 : 400;
  return json({ error: String(message) }, status);
}

async function writeFile(request, env, user, bucket, path) {
  const rule = BUCKETS[bucket];
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!rule.types.includes(type)) return json({ error: 'This kind of file cannot be saved here.' }, 415);
  const declared = Number(request.headers.get('content-length'));
  if (!Number.isFinite(declared) || declared <= 0 || declared > rule.maxBytes) {
    return json({ error: 'That file is too big to save.' }, 413);
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > rule.maxBytes) return json({ error: 'That file is too big to save.' }, 413);

  if (await usesR2(env)) {
    await env.FILES.put(objectKey(bucket, path), bytes, { httpMetadata: { contentType: type } });
    await removeFromSupabase(env, user.token, bucket, path);
    return json({ backend: 'r2' });
  }
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${encodePath(path)}`, {
    method: 'POST',
    headers: supabaseHeaders(env, user.token, { 'content-type': type, 'x-upsert': 'true', 'cache-control': 'max-age=3600' }),
    body: bytes,
  });
  if (!response.ok) return storageError(response);
  await env.FILES.delete(objectKey(bucket, path));
  return json({ backend: 'supabase' });
}

async function removeFromSupabase(env, token, bucket, path) {
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    headers: supabaseHeaders(env, token, { 'content-type': 'application/json' }),
    body: JSON.stringify({ prefixes: [path] }),
  });
  return response.ok;
}

async function removeFile(env, user, bucket, path) {
  await env.FILES.delete(objectKey(bucket, path));
  await removeFromSupabase(env, user.token, bucket, path);
  return json({ ok: true });
}
