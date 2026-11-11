// Builds the logos shown next to learning links: src/assets/platforms/<id>.webp (256 px, transparent).
//  - Most logos come from Simple Icons, an open-licensed set. Each brand's trademark stays with its owner.
//  - A platform outside that set uses its official logo from brand/platforms/<id>.svg|png|webp when
//    that file exists. Such a file takes priority over the open set.
// Run with: npm run logos
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as simpleIcons from 'simple-icons';
import { PLATFORMS } from '../src/lib/platforms.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'src', 'assets', 'platforms');
const OFFICIAL = join(root, 'brand', 'platforms');
const SIZE = 256;
const WEBP = { quality: 92, alphaQuality: 100, effort: 6 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// Platform id -> the Simple Icons export for it.
const OPEN_SET = {
  youtube: 'siYoutube',
  coursera: 'siCoursera',
  udemy: 'siUdemy',
  khanacademy: 'siKhanacademy',
  edx: 'siEdx',
  duolingo: 'siDuolingo',
  ted: 'siTed',
  quizlet: 'siQuizlet',
  anki: 'siAnki',
  googletranslate: 'siGoogletranslate',
  spotify: 'siSpotify',
  applepodcasts: 'siApplepodcasts',
  soundcloud: 'siSoundcloud',
  vimeo: 'siVimeo',
};

function openSetSvg(icon) {
  const color = icon.hex || '0F1B33';
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24"><path fill="#${color}" d="${icon.path}"/></svg>`,
  );
}

async function fromOfficialFile(file) {
  const bytes = await readFile(join(OFFICIAL, file));
  const isSvg = file.endsWith('.svg');
  return sharp(bytes, isSvg ? { density: 300 } : {})
    .resize(SIZE, SIZE, { fit: 'contain', background: CLEAR })
    .webp(WEBP)
    .toBuffer();
}

await mkdir(OUT, { recursive: true });
const official = existsSync(OFFICIAL) ? await readdir(OFFICIAL) : [];
const report = [];

for (const platform of PLATFORMS) {
  const file = official.find((name) => name.startsWith(`${platform.id}.`) && /\.(svg|png|webp)$/.test(name));
  let image = null;
  let source = 'monogram';
  if (file) {
    image = await fromOfficialFile(file);
    source = 'official file';
  } else if (OPEN_SET[platform.id]) {
    const icon = simpleIcons[OPEN_SET[platform.id]];
    if (icon) {
      image = await sharp(openSetSvg(icon), { density: 72 }).webp(WEBP).toBuffer();
      source = 'open icon set';
    }
  }
  if (image) await writeFile(join(OUT, `${platform.id}.webp`), image);
  report.push(`${platform.id.padEnd(16)} ${source}`);
}

console.log(report.join('\n'));
console.log(`Wrote ${join('src', 'assets', 'platforms')}. Monograms are used where no logo exists yet.`);
