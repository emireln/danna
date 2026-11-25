// The 3D pictures of the sign-in screen: inside the panel, apart from each other, and smaller when they must be.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let art;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  art = await server.ssrLoadModule('/src/lib/authArt.ts');
});

after(async () => {
  await server?.close();
});

// A seeded random number source, so each layout is the same on every run
function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

const PICTURES = [
  { name: 'danna', ratio: 1.15, share: 0.72 },
  { name: 'botdanna', ratio: 1.1, share: 0.72 },
  { name: 'recovery', ratio: 1.2, share: 0.55, recovery: true },
];

const EPS = 1e-6;

test('two boxes are apart only when the gap is kept between them', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  assert.equal(art.apartBoxes(a, { x: 20, y: 0, w: 10, h: 10 }, 10), true, 'a gap of exactly the spacing is apart');
  assert.equal(art.apartBoxes(a, { x: 19, y: 0, w: 10, h: 10 }, 10), false, 'a smaller gap is not apart');
  assert.equal(art.apartBoxes(a, { x: 5, y: 5, w: 10, h: 10 }, 0), false, 'overlapping boxes are not apart');
  assert.equal(art.apartBoxes(a, { x: 0, y: 30, w: 10, h: 10 }, 10), true, 'one above the other, with the gap, is apart');
});

test('every picture is placed inside the panel and apart from the others', () => {
  for (let seed = 1; seed <= 60; seed += 1) {
    const panel = { width: 820 + seed * 9, height: 560 + seed * 4 };
    const placed = art.placeArt(PICTURES, panel, seeded(seed));
    assert.ok(placed, `seed ${seed}: the pictures fit`);
    const { margin, gap } = art.artSpacing(panel);
    const boxes = PICTURES.map((picture) => [picture.name, placed.get(picture.name)]);
    for (const [name, box] of boxes) {
      assert.ok(box, `seed ${seed}: ${name} has a place`);
      assert.ok(box.x >= margin - EPS && box.x + box.w <= panel.width - margin + EPS, `seed ${seed}: ${name} is inside on the width`);
      assert.ok(box.y >= margin - EPS && box.y + box.h <= panel.height - margin + EPS, `seed ${seed}: ${name} is inside on the height`);
    }
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const [nameA, a] = boxes[i];
        const [nameB, b] = boxes[j];
        const needed = nameA === 'recovery' || nameB === 'recovery' ? gap * art.RECOVERY_SPACE : gap;
        assert.ok(art.apartBoxes(a, b, needed - EPS), `seed ${seed}: ${nameA} and ${nameB} are apart`);
      }
    }
  }
});

test('the same seed gives the same place for each picture', () => {
  const panel = { width: 1000, height: 640 };
  const first = art.placeArt(PICTURES, panel, seeded(7));
  const second = art.placeArt(PICTURES, panel, seeded(7));
  assert.deepEqual([...first.entries()], [...second.entries()]);
});

test('on a small panel the pictures get smaller rather than overlap', () => {
  const panel = { width: 360, height: 300 };
  const placed = art.placeArt(PICTURES, panel, seeded(3));
  assert.ok(placed, 'the pictures still fit when they are smaller');
  const short = Math.min(panel.width, panel.height);
  const danna = placed.get('danna');
  assert.ok(danna.h < 0.72 * short, 'the danna picture is smaller than its largest size');
});

test('on a tiny panel the pictures shrink until they are inside it', () => {
  const panel = { width: 90, height: 60 };
  const placed = art.placeArt(PICTURES, panel, seeded(5));
  assert.ok(placed, 'the pictures are made small enough to fit');
  for (const box of placed.values()) {
    assert.ok(box.x >= 0 && box.x + box.w <= panel.width + EPS, 'inside on the width');
    assert.ok(box.y >= 0 && box.y + box.h <= panel.height + EPS, 'inside on the height');
  }
});

test('a picture wider than the panel has no free place', () => {
  const box = art.freePlace({ w: 500, h: 100 }, [], { width: 300, height: 300 }, 10, 5);
  assert.equal(box, null);
});

test('shuffling keeps every item once', () => {
  const list = [1, 2, 3, 4, 5, 6];
  const shuffled = art.shuffle(list, seeded(11));
  assert.deepEqual([...shuffled].sort((a, b) => a - b), list);
});
