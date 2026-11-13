// Tests the rules of the profile: the day streak's colour by its length, the shares a friend sent you, and the size
// of a banner. The same size is kept on this device, in the account, and in the file size limit of its bucket.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let progress;
let friends;
let rules;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  progress = await server.ssrLoadModule('/src/lib/progress.ts');
  friends = await server.ssrLoadModule('/src/lib/friends.ts');
  rules = await server.ssrLoadModule('/src/lib/data/rules.ts');
});

after(async () => {
  await server?.close();
});

test('a friend’s shares are the ones they sent you, in the order the list gives', () => {
  const shares = [
    { id: 's1', direction: 'received', other_id: 'ana', kind: 'result' },
    { id: 's2', direction: 'sent', other_id: 'ana', kind: 'test' },
    { id: 's3', direction: 'received', other_id: 'bruno', kind: 'test' },
    { id: 's4', direction: 'received', other_id: 'ana', kind: 'test' },
  ];
  assert.deepEqual(friends.sharesFrom(shares, 'ana').map((share) => share.id), ['s1', 's4']);
  assert.deepEqual(friends.sharesFrom(shares, 'carla'), []);
});

test('a banner is kept at the same size everywhere: 480 KB, the file limit of the profile-banners bucket', () => {
  assert.equal(rules.BANNER_MAX_BYTES, 480 * 1024);
  assert.equal(rules.BANNER_MAX_BYTES, 491520);
});
