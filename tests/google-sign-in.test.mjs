// Google sign-in: the sign-in page the app may open, the address the browser returns to, and the session in it.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const authLink = require('../electron/authLink.cjs');
const { isGoogleSignInUrl, findAuthCallback } = authLink;

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let signIn;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  signIn = await server.ssrLoadModule('/src/lib/googleSignIn.ts');
});

after(async () => {
  await server?.close();
});

test('only the project\'s own Google sign-in page over https is opened', () => {
  const page = 'https://abcdefgh.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fhub.danna.run%2Fapp-danna';
  assert.equal(isGoogleSignInUrl(page), true);
  assert.equal(isGoogleSignInUrl(page.replace('https://', 'http://')), false, 'plain http is refused');
  assert.equal(isGoogleSignInUrl(page.replace('abcdefgh.supabase.co', 'example.com')), false, 'another host is refused');
  assert.equal(isGoogleSignInUrl(page.replace('provider=google', 'provider=github')), false, 'another provider is refused');
  assert.equal(isGoogleSignInUrl(page.replace('/auth/v1/authorize', '/rest/v1/profiles')), false, 'another path is refused');
  assert.equal(isGoogleSignInUrl('javascript:alert(1)'), false);
  assert.equal(isGoogleSignInUrl(undefined), false);
  assert.equal(isGoogleSignInUrl(`${page}&x=${'a'.repeat(2100)}`), false, 'a very long address is refused');
});

test('only the app\'s own return address is taken from a command line', () => {
  const address = 'danna://auth-callback#access_token=a&refresh_token=b';
  assert.equal(findAuthCallback(['Danna.exe', address], 'danna'), address);
  assert.equal(findAuthCallback(['Danna.exe', 'danna://auth-callback?code=x'], 'danna'), 'danna://auth-callback?code=x');
  assert.equal(findAuthCallback(['Danna.exe', 'danna://auth-callbackX#a=b'], 'danna'), null, 'a different path is not taken');
  assert.equal(findAuthCallback(['Botdanna.exe', 'botdanna://auth-callback#a=b'], 'danna'), null, 'another app is not taken');
  assert.equal(findAuthCallback(['Danna.exe'], 'danna'), null);
  assert.equal(findAuthCallback(null, 'danna'), null);
});

test('a session comes back in the fragment of the return address', () => {
  const result = signIn.readSignInCallback(
    'danna://auth-callback#access_token=eyJ.a.b&expires_in=3600&refresh_token=refresh-1&token_type=bearer',
  );
  assert.deepEqual(result, { kind: 'session', accessToken: 'eyJ.a.b', refreshToken: 'refresh-1' });
});

test('a session is also read from the query of the return address', () => {
  const result = signIn.readSignInCallback('danna://auth-callback?access_token=a&refresh_token=b');
  assert.deepEqual(result, { kind: 'session', accessToken: 'a', refreshToken: 'b' });
});

test('an error that comes back is reported without its detail', () => {
  const result = signIn.readSignInCallback('danna://auth-callback#error=access_denied&error_description=User+cancelled+the+sign-in');
  assert.deepEqual(result, { kind: 'error' });
});

test('an address with neither a session nor an error is not read', () => {
  assert.equal(signIn.readSignInCallback('danna://auth-callback'), null);
  assert.equal(signIn.readSignInCallback('danna://auth-callback#access_token=only-one'), null, 'a session needs both tokens');
  assert.equal(signIn.readSignInCallback('not a web address'), null);
  assert.equal(signIn.GOOGLE_RETURN_URL, 'https://hub.danna.run/app-danna');
});

test('a sign-in that started within the hour can still be taken, and an older one cannot', () => {
  const started = 1_000_000;
  assert.equal(authLink.signInIsPending(started, started + 60_000), true);
  assert.equal(authLink.signInIsPending(started, started + authLink.SIGN_IN_WINDOW_MS), true, 'the last moment of the hour');
  assert.equal(authLink.signInIsPending(started, started + authLink.SIGN_IN_WINDOW_MS + 1), false, 'a sign-in that came too late');
  assert.equal(authLink.signInIsPending(0, started), false, 'no sign-in was started');
  assert.equal(authLink.signInIsPending(started, started - 1), false, 'a clock that went back');
});

test('the start of a sign-in is kept on disk, so a restart of Danna still takes the return', () => {
  const dir = mkdtempSync(join(tmpdir(), 'danna-sign-in-'));
  const file = join(dir, 'google-sign-in.json');
  try {
    assert.equal(authLink.readSignInStart(file), 0, 'nothing is kept yet');
    authLink.writeSignInStart(file, 42_000);
    assert.equal(authLink.readSignInStart(file), 42_000, 'a new run reads the start again');
    authLink.clearSignInStart(file);
    assert.equal(authLink.readSignInStart(file), 0, 'the start is cleared once the sign-in is taken');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
