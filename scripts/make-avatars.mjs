// Builds the built-in avatar pack in src/assets/avatars/: 96 WebP pictures made from DiceBear avatars (https://www.dicebear.com)
// in the styles lorelei, notionists and open-peeps. Those styles are released under CC0 1.0, so no credit is required, and
// the script checks every picture's licence before it is saved. It also writes CREDITS.md, which lists each file with its
// style and seed. The pictures are converted to WebP here, once, and committed: the app bundles them and never fetches or
// converts them. Run with: npm run avatars
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'src', 'assets', 'avatars');
const API = 'https://api.dicebear.com/9.x';
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
// The same size as the pictures people upload (src/lib/avatar.ts), so both kinds look equally sharp.
const SIZE = 256;
// The soft tints of the Playful look, so every picture sits on a colour that the app uses.
const BACKGROUNDS = 'dcd2ff,efeaff,e8f1ff,e8f8ee';
const STYLES = ['lorelei', 'notionists', 'open-peeps'];
const PER_STYLE = 32;
const WEBP = { quality: 88, alphaQuality: 100, effort: 6 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchSvg(style, seed) {
  const url = `${API}/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${BACKGROUNDS}&radius=50`;
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url);
    if (response.status === 429 && attempt < 5) {
      await sleep(2000 * attempt); // the API asks for a pause; wait longer each time
      continue;
    }
    if (!response.ok) throw new Error(`DiceBear answered ${response.status} for ${style} "${seed}"`);
    return response.text();
  }
}

await mkdir(OUT, { recursive: true });
for (const name of await readdir(OUT)) {
  if (/^avatar-\d+\.(svg|webp)$/.test(name) || name === 'CREDITS.md') await unlink(join(OUT, name));
}

const credits = [];
let number = 0;
for (const style of STYLES) {
  for (let index = 1; index <= PER_STYLE; index += 1) {
    const seed = `${style}-${String(index).padStart(2, '0')}`;
    number += 1;
    await sleep(120); // a short pause between requests, so the API is not overloaded
    const svg = await fetchSvg(style, seed);
    if (!svg.includes(`<dcterms:license xsi:type="dcterms:URI">${CC0}</dcterms:license>`)) {
      throw new Error(`${style} is not released under CC0, so its pictures are not added to the pack`);
    }
    const file = `avatar-${String(number).padStart(2, '0')}.webp`;
    await writeFile(join(OUT, file), await sharp(Buffer.from(svg)).resize(SIZE, SIZE).webp(WEBP).toBuffer());
    credits.push(`${file}  ${style}  ${seed}`);
  }
}

await writeFile(
  join(OUT, 'CREDITS.md'),
  [
    '# Built-in avatars',
    '',
    'The pictures in this folder are made with DiceBear (https://www.dicebear.com), in the styles lorelei, notionists and',
    'open-peeps. Those styles are released under CC0 1.0 (public domain), so no credit is required. This list records the',
    'style and seed of each file. `npm run avatars` rebuilds the pack.',
    '',
    ...credits,
    '',
  ].join('\n'),
);

console.log(`Wrote ${number} WebP avatars and CREDITS.md to src/assets/avatars`);
