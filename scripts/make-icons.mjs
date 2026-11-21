// Builds every logo and icon file from three masters in brand/:
//   brand/logo.png   the master logo: the mark shown inside the app
//   brand/icon.png   the master app icon: a finished icon with its own rounded square, used as it is, with no frame
//   brand/tray-icon.png   the master tray icon: a finished picture, used as it is in the Windows tray
// It writes:
//   src/assets/logo.webp   the logo shown in the app (WebP)
//   src/assets/icon.webp   the app icon (WebP)
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
const LOGO_SOURCE = join(root, 'brand', 'logo.png');
const ICON_SOURCE = join(root, 'brand', 'icon.png');
const TRAY_SOURCE = join(root, 'brand', 'tray-icon.png');
const LOGO_MARK_SHARE = 0.92; // the logo fills 92% of the in-app square
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const WEBP = { quality: 92, alphaQuality: 100, effort: 6 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// The logo without its transparent margin, so every size uses the mark's real shape.
async function loadLogo() {
  return sharp(await readFile(LOGO_SOURCE)).trim().png().toBuffer();
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

// The app icon is already a finished icon: a rounded square with its own colours and a transparent margin. It is
// resized as it is, so the window, the tray, the installer and the tab show the same picture.
async function appIcon(size, icon) {
  return sharp(icon).resize(size, size, { fit: 'contain', background: CLEAR }).png().toBuffer();
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

const logo = await loadLogo();
const icon = await readFile(ICON_SOURCE);
const tray = await readFile(TRAY_SOURCE);

await mkdir(join(root, 'src', 'assets'), { recursive: true });
await writeFile(join(root, 'src', 'assets', 'logo.webp'), await sharp(await logoSquare(512, logo)).webp(WEBP).toBuffer());
await writeFile(join(root, 'src', 'assets', 'icon.webp'), await sharp(await appIcon(512, icon)).webp(WEBP).toBuffer());
await writeFile(join(root, 'public', 'favicon.webp'), await sharp(await appIcon(128, icon)).webp(WEBP).toBuffer());

await mkdir(join(root, 'build'), { recursive: true });
await writeFile(join(root, 'build', 'icon.png'), await appIcon(1024, icon));
const sizes = [];
for (const size of ICO_SIZES) sizes.push({ size, png: await appIcon(size, icon) });
await writeFile(join(root, 'build', 'icon.ico'), encodeIco(sizes));

await mkdir(join(root, 'electron', 'assets'), { recursive: true });
await writeFile(join(root, 'electron', 'assets', 'icon.png'), await appIcon(256, icon));
await writeFile(join(root, 'electron', 'assets', 'tray.png'), await appIcon(16, tray));
await writeFile(join(root, 'electron', 'assets', 'tray@2x.png'), await appIcon(32, tray));

console.log('Wrote the logo and icon files: src/assets, public/favicon.webp, build/, electron/assets/');
