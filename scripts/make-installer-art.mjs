// Draws the installer's side banner: a 164 x 314 BMP, the #2f6bff background, and the letters of
// "danna" in white, stacked from the top: D, A, N, N, A. The letters use the bold Unbounded font
// that the app uses for its wordmark. The installer and the uninstaller both use the banner.
// Run with: npm run installer-art
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const opentype = require('opentype.js');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT = join(root, 'node_modules', '@fontsource', 'unbounded', 'files', 'unbounded-latin-700-normal.woff');
const WIDTH = 164;
const HEIGHT = 314;
const BACKGROUND = '#2f6bff';
const LETTERS = ['D', 'A', 'N', 'N', 'A'];
const CAP_HEIGHT = 34; // pixels for each letter
const GAP = 20; // pixels between letters

/** A 24-bit uncompressed BMP from top-down RGB pixels (the format the installer expects). */
function bmp24(width, height, rgb) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelBytes = rowSize * height;
  const file = Buffer.alloc(54 + pixelBytes);
  file.write('BM', 0, 'ascii');
  file.writeUInt32LE(54 + pixelBytes, 2);
  file.writeUInt32LE(54, 10);
  file.writeUInt32LE(40, 14);
  file.writeInt32LE(width, 18);
  file.writeInt32LE(height, 22);
  file.writeUInt16LE(1, 26);
  file.writeUInt16LE(24, 28);
  file.writeUInt32LE(0, 30);
  file.writeUInt32LE(pixelBytes, 34);
  file.writeInt32LE(2835, 38);
  file.writeInt32LE(2835, 42);
  for (let y = 0; y < height; y += 1) {
    const source = (height - 1 - y) * width * 3; // BMP rows run bottom to top
    const target = 54 + y * rowSize;
    for (let x = 0; x < width; x += 1) {
      file[target + x * 3] = rgb[source + x * 3 + 2];
      file[target + x * 3 + 1] = rgb[source + x * 3 + 1];
      file[target + x * 3 + 2] = rgb[source + x * 3];
    }
  }
  return file;
}

const fontBytes = await readFile(FONT);
const font = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));
const capRatio = font.tables.os2.sCapHeight / font.unitsPerEm;
const size = CAP_HEIGHT / capRatio;
const top = (HEIGHT - (LETTERS.length * CAP_HEIGHT + (LETTERS.length - 1) * GAP)) / 2;

const shapes = LETTERS.map((letter, index) => {
  const box = font.getPath(letter, 0, 0, size).getBoundingBox();
  const x = (WIDTH - (box.x2 - box.x1)) / 2 - box.x1; // centred on its own width
  const baseline = top + index * (CAP_HEIGHT + GAP) + CAP_HEIGHT;
  return font.getPath(letter, x, baseline, size).toPathData(2);
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BACKGROUND}"/>
  ${shapes.map((d) => `<path fill="#ffffff" d="${d}"/>`).join('\n  ')}
</svg>`;

const { data, info } = await sharp(Buffer.from(svg), { density: 72 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== WIDTH || info.height !== HEIGHT || info.channels !== 3) {
  throw new Error(`The banner rendered at ${info.width} x ${info.height}, not ${WIDTH} x ${HEIGHT}.`);
}

await mkdir(join(root, 'build'), { recursive: true });
const banner = bmp24(WIDTH, HEIGHT, data);
await writeFile(join(root, 'build', 'installerSidebar.bmp'), banner);
await writeFile(join(root, 'build', 'uninstallerSidebar.bmp'), banner);

// Optional preview for checking the result (not part of the build).
if (process.argv[2]) await sharp(data, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } }).png().toFile(process.argv[2]);

console.log('Wrote build/installerSidebar.bmp and build/uninstallerSidebar.bmp');
