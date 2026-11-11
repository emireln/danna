// Generates the Windows app icon from the danna mark (same geometry as public/favicon.svg).
// Writes build/icon.png and build/icon.ico. Run with: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'build');
mkdirSync(outDir, { recursive: true });

const SIZE = 256;
const SAMPLES = 4; // supersampling per axis for smooth edges
const BLUE = [47, 107, 255];

function inRoundedRect(x, y, left, top, width, height, radius) {
  if (x < left || x > left + width || y < top || y > top + height) return false;
  const cx = Math.min(Math.max(x, left + radius), left + width - radius);
  const cy = Math.min(Math.max(y, top + radius), top + height - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

// The mark lives on a 32 x 32 grid: a blue rounded square with a white "d".
function sample(x, y) {
  if (!inRoundedRect(x, y, 0, 0, 32, 32, 9)) return null;
  const distance = Math.hypot(x - 13, y - 18);
  const ring = Math.abs(distance - 6.2) <= 1.6;
  const stem = inRoundedRect(x, y, 18.4, 7.5, 3.2, 17.5, 1.6);
  return ring || stem ? [255, 255, 255] : BLUE;
}

const pixels = Buffer.alloc(SIZE * SIZE * 4);
for (let py = 0; py < SIZE; py += 1) {
  for (let px = 0; px < SIZE; px += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let hits = 0;
    for (let sy = 0; sy < SAMPLES; sy += 1) {
      for (let sx = 0; sx < SAMPLES; sx += 1) {
        const x = ((px + (sx + 0.5) / SAMPLES) / SIZE) * 32;
        const y = ((py + (sy + 0.5) / SAMPLES) / SIZE) * 32;
        const color = sample(x, y);
        if (color) {
          r += color[0];
          g += color[1];
          b += color[2];
          hits += 1;
        }
      }
    }
    const total = SAMPLES * SAMPLES;
    const offset = (py * SIZE + px) * 4;
    if (hits > 0) {
      pixels[offset] = Math.round(r / hits);
      pixels[offset + 1] = Math.round(g / hits);
      pixels[offset + 2] = Math.round(b / hits);
      pixels[offset + 3] = Math.round((hits / total) * 255);
    }
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rows[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const png = encodePng(SIZE, SIZE, pixels);
writeFileSync(join(outDir, 'icon.png'), png);

// A single-image ICO that stores the 256 px PNG directly (supported by Windows Vista and later).
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); // reserved
ico.writeUInt16LE(1, 2); // type: icon
ico.writeUInt16LE(1, 4); // image count
ico[6] = 0; // width 256 is stored as 0
ico[7] = 0; // height 256 is stored as 0
ico[8] = 0; // colour count
ico[9] = 0; // reserved
ico.writeUInt16LE(1, 10); // colour planes
ico.writeUInt16LE(32, 12); // bits per pixel
ico.writeUInt32LE(png.length, 14); // image size
ico.writeUInt32LE(22, 18); // image offset
writeFileSync(join(outDir, 'icon.ico'), Buffer.concat([ico, png]));

console.log('Wrote build/icon.png and build/icon.ico');
