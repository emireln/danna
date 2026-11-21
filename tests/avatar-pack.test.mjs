// The built-in avatar pack: 96 WebP pictures made from DiceBear avatars under CC0, bundled with the app. A person's pick
// is fixed by their id, and every picture is listed with its licence in CREDITS.md.
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

test('the pack holds 96 WebP pictures, and no other picture format', () => {
  const names = readdirSync(folder);
  const pictures = names.filter((name) => name.endsWith('.webp'));
  assert.equal(pictures.length, 96);
  assert.equal(pack.AVATAR_PACK_SIZE, 96);
  assert.deepEqual(names.filter((name) => /\.(svg|png|jpe?g|gif)$/i.test(name)), [], 'no SVG, PNG, JPEG or GIF pictures');
  for (const file of pictures) {
    const bytes = readFileSync(join(folder, file));
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', `${file} starts like a WebP file`);
    assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP', `${file} is a WebP file`);
  }
});

test('every picture is listed with its licence in CREDITS.md', () => {
  const credits = readFileSync(join(folder, 'CREDITS.md'), 'utf8');
  assert.match(credits, /CC0 1\.0/);
  const listed = credits.match(/^avatar-\d\d\.webp/gm) ?? [];
  assert.equal(listed.length, 96);
});

test('a person gets the same built-in picture every time, and different people get different ones', () => {
  assert.equal(pack.defaultAvatarUrl('user-1'), pack.defaultAvatarUrl('user-1'));
  const picks = new Set(Array.from({ length: 200 }, (_, index) => pack.defaultAvatarUrl(`user-${index}`)));
  assert.ok(picks.size >= 40, 'the picks spread across the pack');
});
