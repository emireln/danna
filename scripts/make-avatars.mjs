// Builds the built-in avatar pack in src/assets/avatars/ from the DiceBear HTTP API (https://www.dicebear.com).
// Only styles released under CC0 are used, so the pictures need no credit. Each picture's licence is checked before it
// is saved. The files are committed, so the app never fetches them: the pack works offline.
// Run with: npm run avatars
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'src', 'assets', 'avatars');
const API = 'https://api.dicebear.com/9.x';
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
// The soft tints of the Playful look, so every picture sits on a colour that the app uses.
const BACKGROUNDS = 'dcd2ff,efeaff,e8f1ff,e8f8ee';
// The style and the seeds of each picture. A seed is only a name for the picture; it is not a person's id.
const PACK = {
  lorelei: ['Maple', 'River', 'Sunny', 'Juniper', 'Willow', 'Ember', 'Comet', 'Harbor'],
  notionists: ['Pine', 'Kite', 'Ivy', 'Quill', 'Basil', 'Otter', 'Lark', 'Sage'],
  'open-peeps': ['Bay', 'Fern', 'Otto', 'Mira', 'Juno', 'Rowan', 'Hazel', 'Nico'],
};

await mkdir(OUT, { recursive: true });
for (const name of await readdir(OUT)) {
  if (/^avatar-\d+\.svg$/.test(name)) await unlink(join(OUT, name));
}

let number = 0;
for (const [style, seeds] of Object.entries(PACK)) {
  for (const seed of seeds) {
    number += 1;
    const response = await fetch(`${API}/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${BACKGROUNDS}&radius=50`);
    if (!response.ok) throw new Error(`DiceBear answered ${response.status} for ${style} "${seed}"`);
    const svg = await response.text();
    if (!svg.includes(`<dcterms:license xsi:type="dcterms:URI">${CC0}</dcterms:license>`)) {
      throw new Error(`${style} is not released under CC0, so its pictures are not added to the pack`);
    }
    await writeFile(join(OUT, `avatar-${String(number).padStart(2, '0')}.svg`), svg);
  }
}

console.log(`Wrote ${number} avatars to src/assets/avatars`);
