// Makes the two brand images that come from the logo, the tray icon and the installer banner:
//   brand/tray-icon.png  the logo, trimmed and centred on a 512 px square at 88%, in its own colours
//   brand/banner.png     the installer banner: the accent colour, the logo in white centred at 70% of the width, nothing else
// Run it when brand/logo.png changes, then `npm run icons` and `npm run installer-art`. `npm run art` runs them all.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const sharp = require('sharp');

// The banner's accent: Danna's violet. Botdanna uses its coral, #d52b50.
const ACCENT = '#5236d1';
const LOGO = join(root, 'brand', 'logo.png');
const TRAY = join(root, 'brand', 'tray-icon.png');
const BANNER = join(root, 'brand', 'banner.png');

const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const TRAY_SIZE = 512;
const TRAY_LOGO_SHARE = 0.88;
const BANNER_WIDTH = 492; // three times the installer's 164 px, so the installer side is a whole-number scale
const BANNER_HEIGHT = 942; // three times the installer's 314 px
const BANNER_LOGO_SHARE = 0.7;

// The mark without its transparent margin.
const mark = await sharp(LOGO).trim().png().toBuffer();

// The same shape in white: the colour channels are set to white and the alpha channel is kept.
async function inWhite(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function fitInside(png, width, height) {
  return sharp(png).resize(width, height, { fit: 'inside', background: CLEAR }).png().toBuffer();
}

const traySide = Math.round(TRAY_SIZE * TRAY_LOGO_SHARE);
const trayMark = await fitInside(mark, traySide, traySide);
const tray = await sharp({ create: { width: TRAY_SIZE, height: TRAY_SIZE, channels: 4, background: CLEAR } })
  .composite([{ input: trayMark, gravity: 'centre' }])
  .png()
  .toBuffer();
await sharp(tray).toFile(TRAY);

const bannerMark = await fitInside(
  await inWhite(mark),
  Math.round(BANNER_WIDTH * BANNER_LOGO_SHARE),
  Math.round(BANNER_HEIGHT * BANNER_LOGO_SHARE),
);
await sharp({ create: { width: BANNER_WIDTH, height: BANNER_HEIGHT, channels: 3, background: ACCENT } })
  .composite([{ input: bannerMark, gravity: 'centre' }])
  .png()
  .toFile(BANNER);

console.log('Wrote brand/tray-icon.png and brand/banner.png');
