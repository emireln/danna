// Builds the installer's side picture from brand/banner.png: a 164 x 314 BMP, the size the installer expects. The installer
// and the uninstaller both use it. The banner is scaled to cover the side and cropped evenly at its edges, so nothing is
// stretched. Run with: npm run installer-art
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BANNER = join(root, 'brand', 'banner.png');
const WIDTH = 164;
const HEIGHT = 314;
// A BMP has no transparency, so any see-through part of the banner is filled with the app's purple.
const BACKGROUND = '#5236d1';

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

const { data, info } = await sharp(await readFile(BANNER))
  .flatten({ background: BACKGROUND })
  .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
if (info.width !== WIDTH || info.height !== HEIGHT || info.channels !== 3) {
  throw new Error(`The banner was made ${info.width} x ${info.height}, not ${WIDTH} x ${HEIGHT}.`);
}

await mkdir(join(root, 'build'), { recursive: true });
const side = bmp24(WIDTH, HEIGHT, data);
await writeFile(join(root, 'build', 'installerSidebar.bmp'), side);
await writeFile(join(root, 'build', 'uninstallerSidebar.bmp'), side);

// Optional preview for checking the result (not part of the build).
if (process.argv[2]) await sharp(data, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } }).png().toFile(process.argv[2]);

console.log('Wrote build/installerSidebar.bmp and build/uninstallerSidebar.bmp');
