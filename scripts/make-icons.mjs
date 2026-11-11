// Draws the danna mark (a speech bubble with rising bars) as PNG and ICO files,
// plus the SVG favicon. Run with: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const NAVY = [15, 27, 51];
const BLUE = [47, 107, 255];
const WHITE = [255, 255, 255];
const TEAL = [19, 181, 164];

// The mark lives on a 64 x 64 grid. Keep these numbers in sync with BrandMark in src/components/ui.tsx.
const BUBBLE = { left: 10, top: 12, width: 44, height: 32, radius: 12 };
const TAIL = [
  [30, 44],
  [19, 52],
  [20, 44],
];
const BARS = [
  { left: 14.75, top: 31, width: 6, height: 7, color: WHITE },
  { left: 24.25, top: 26, width: 6, height: 12, color: WHITE },
  { left: 33.75, top: 21, width: 6, height: 17, color: WHITE },
  { left: 43.25, top: 16, width: 6, height: 22, color: TEAL },
];

function inRoundedRect(x, y, left, top, width, height, radius) {
  if (x < left || x > left + width || y < top || y > top + height) return false;
  const cx = Math.min(Math.max(x, left + radius), left + width - radius);
  const cy = Math.min(Math.max(y, top + radius), top + height - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function inTriangle(px, py, a, b, c) {
  const sign = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const p = [px, py];
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}

function colorAt(x, y) {
  if (!inRoundedRect(x, y, 0, 0, 64, 64, 16)) return null;
  let color = NAVY;
  if (inRoundedRect(x, y, BUBBLE.left, BUBBLE.top, BUBBLE.width, BUBBLE.height, BUBBLE.radius) || inTriangle(x, y, TAIL[0], TAIL[1], TAIL[2])) {
    color = BLUE;
  }
  for (const bar of BARS) {
    if (inRoundedRect(x, y, bar.left, bar.top, bar.width, bar.height, 3)) color = bar.color;
  }
  return color;
}

function rasterize(size) {
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let hits = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = ((px + (sx + 0.5) / samples) / size) * 64;
          const y = ((py + (sy + 0.5) / samples) / size) * 64;
          const color = colorAt(x, y);
          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            hits += 1;
          }
        }
      }
      const offset = (py * size + px) * 4;
      if (hits > 0) {
        pixels[offset] = Math.round(r / hits);
        pixels[offset + 1] = Math.round(g / hits);
        pixels[offset + 2] = Math.round(b / hits);
        pixels[offset + 3] = Math.round((hits / (samples * samples)) * 255);
      }
    }
  }
  return pixels;
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

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = size * 4 + 1;
  const rows = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    rows[y * stride] = 0;
    rgba.copy(rows, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(png) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = 0;
  header[7] = 0;
  header[8] = 0;
  header[9] = 0;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#0f1b33"/>
  <path d="M22 12H42A12 12 0 0 1 54 24V32A12 12 0 0 1 42 44H30L19 52L20 44H22A12 12 0 0 1 10 32V24A12 12 0 0 1 22 12Z" fill="#2f6bff"/>
  <rect x="14.75" y="31" width="6" height="7" rx="3" fill="#ffffff"/>
  <rect x="24.25" y="26" width="6" height="12" rx="3" fill="#ffffff"/>
  <rect x="33.75" y="21" width="6" height="17" rx="3" fill="#ffffff"/>
  <rect x="43.25" y="16" width="6" height="22" rx="3" fill="#13b5a4"/>
</svg>
`;

const outputs = [
  ['build', 'icon.png', 512],
  ['electron/assets', 'icon.png', 256],
  ['electron/assets', 'tray.png', 32],
];

for (const [folder, name, size] of outputs) {
  const target = join(root, folder);
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, name), encodePng(size, rasterize(size)));
}

mkdirSync(join(root, 'build'), { recursive: true });
writeFileSync(join(root, 'build', 'icon.ico'), encodeIco(encodePng(256, rasterize(256))));
mkdirSync(join(root, 'public'), { recursive: true });
writeFileSync(join(root, 'public', 'favicon.svg'), svg);

console.log('Wrote build/icon.png, build/icon.ico, electron/assets/icon.png, electron/assets/tray.png, public/favicon.svg');
