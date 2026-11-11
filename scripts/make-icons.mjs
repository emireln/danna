// Builds every logo and icon file from brand/logo.png, the master logo.
//   src/assets/logo.webp   the logo shown in the app (WebP)
//   src/assets/icon.webp   the app icon shown in the app (WebP)
//   public/favicon.webp    the browser tab icon (WebP)
//   build/icon.png         the app icon, 1024 px (PNG)
//   build/icon.ico         the installer and shortcut icon (several sizes)
//   electron/assets/       window icon and tray icon (PNG; tray@2x is used on high-DPI screens)
// The app interface uses WebP for fast loading. Windows and the tray need PNG or ICO.
// Run with: npm run icons
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(root, 'brand', 'logo.png');

// The app icon is the logo on a white rounded square.
const TILE_RADIUS = 0.225; // corner radius as a share of the icon size
const TILE_EDGE_SHARE = 0.008; // a thin edge, so the white tile reads on white backgrounds
const TILE_EDGE = '#e3e9f5';
const ICON_MARK_SHARE = 0.6; // the logo fills 60% of the icon width
const LOGO_MARK_SHARE = 0.92; // the logo fills 92% of the in-app square
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const WEBP = { quality: 92, alphaQuality: 100, effort: 6 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// The logo without its transparent margin, so every size uses the mark's real shape.
async function loadMark() {
  return sharp(await readFile(SOURCE)).trim().png().toBuffer();
}

async function fitMark(mark, box) {
  return sharp(mark).resize(box, box, { fit: 'inside', background: CLEAR }).png().toBuffer();
}

// Puts a PNG in the middle of a transparent square.
async function centred(size, input) {
  const canvas = { create: { width: size, height: size, channels: 4, background: CLEAR } };
  return sharp(canvas).composite([{ input, gravity: 'centre' }]).png().toBuffer();
}

async function logoSquare(size, mark) {
  return centred(size, await fitMark(mark, Math.round(size * LOGO_MARK_SHARE)));
}

async function iconPng(size, mark) {
  const inset = (size * TILE_EDGE_SHARE) / 2;
  const side = size - inset * 2;
  const radius = size * TILE_RADIUS;
  const tile = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<rect x="${inset}" y="${inset}" width="${side}" height="${side}" rx="${radius}" ry="${radius}" ` +
      `fill="#ffffff" stroke="${TILE_EDGE}" stroke-width="${size * TILE_EDGE_SHARE}"/></svg>`,
  );
  const markPng = await fitMark(mark, Math.round(size * ICON_MARK_SHARE));
  return sharp(tile).composite([{ input: markPng, gravity: 'centre' }]).png().toBuffer();
}

// A Windows icon file holding several PNG images (Windows Vista and later read PNG entries).
function encodeIco(images) {
  const headerSize = 6 + images.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = headerSize;
  images.forEach((image, index) => {
    const at = 6 + index * 16;
    const dimension = image.size >= 256 ? 0 : image.size;
    header[at] = dimension;
    header[at + 1] = dimension;
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(image.png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += image.png.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

const mark = await loadMark();

await mkdir(join(root, 'src', 'assets'), { recursive: true });
await writeFile(join(root, 'src', 'assets', 'logo.webp'), await sharp(await logoSquare(512, mark)).webp(WEBP).toBuffer());
await writeFile(join(root, 'src', 'assets', 'icon.webp'), await sharp(await iconPng(512, mark)).webp(WEBP).toBuffer());
await writeFile(join(root, 'public', 'favicon.webp'), await sharp(await iconPng(128, mark)).webp(WEBP).toBuffer());

await mkdir(join(root, 'build'), { recursive: true });
await writeFile(join(root, 'build', 'icon.png'), await iconPng(1024, mark));
const sizes = [];
for (const size of ICO_SIZES) sizes.push({ size, png: await iconPng(size, mark) });
await writeFile(join(root, 'build', 'icon.ico'), encodeIco(sizes));

await mkdir(join(root, 'electron', 'assets'), { recursive: true });
await writeFile(join(root, 'electron', 'assets', 'icon.png'), await iconPng(256, mark));
await writeFile(join(root, 'electron', 'assets', 'tray.png'), await iconPng(16, mark));
await writeFile(join(root, 'electron', 'assets', 'tray@2x.png'), await iconPng(32, mark));

console.log('Wrote the logo and icon files: src/assets, public/favicon.webp, build/, electron/assets/');
