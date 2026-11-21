// The built-in avatar pack: 24 CC0 pictures from DiceBear, bundled with the app. A person's pick is fixed by their id.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const folder = join(here, '..', 'src', 'assets', 'avatars');
let server;
let pack;

before(async () => {
  server = await createServer({ root: join(here, '..'), configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  pack = await server.ssrLoadModule('/src/lib/avatarPack.ts');
});

after(async () => {
  await server?.close();
});

test('the pack holds 24 pictures, each an SVG under the CC0 licence', () => {
  const files = readdirSync(folder).filter((name) => name.endsWith('.svg'));
  assert.equal(files.length, 24);
  assert.equal(pack.AVATAR_PACK_SIZE, 24);
  for (const file of files) {
    const svg = readFileSync(join(folder, file), 'utf8');
    assert.match(svg, /^<svg /, `${file} is an SVG`);
    assert.match(svg, /creativecommons\.org\/publicdomain\/zero\/1\.0\//, `${file} is CC0`);
  }
});

test('a person gets the same built-in picture every time, and different people get different ones', () => {
  assert.equal(pack.defaultAvatarUrl('user-1'), pack.defaultAvatarUrl('user-1'));
  const picks = new Set(Array.from({ length: 200 }, (_, index) => pack.defaultAvatarUrl(`user-${index}`)));
  assert.ok(picks.size >= 20, 'the picks spread across the pack');
});
