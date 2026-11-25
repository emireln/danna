// Where the 3D pictures of the sign-in screen go: at random, apart from each other, and inside the panel. The same rules
// as the hub's account pages (website/auth.js), so the apps and the hub look alike. Pure functions, so they can be tested.

/** How far a picture drifts, as a share of the panel's shorter side. */
export const ART_DRIFT = 0.03;
/** The free space kept between two pictures, as a share of the panel's shorter side. */
export const ART_CLEARANCE = 0.04;
/** The recovery picture keeps this many times the usual space from the others. */
export const RECOVERY_SPACE = 1.3;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Panel {
  width: number;
  height: number;
}

export interface ArtPicture {
  name: string;
  /** Height over width of the picture. */
  ratio: number;
  /** The height as a share of the panel's shorter side, at its largest size. */
  share: number;
  /** The recovery picture is placed last, with more room around it. */
  recovery?: boolean;
}

/** The margin and the gap for a panel, as shares of its shorter side. */
export function artSpacing(panel: Panel): { short: number; margin: number; gap: number } {
  const short = Math.min(panel.width, panel.height);
  return { short, margin: (ART_DRIFT + 0.02) * short, gap: (2 * ART_DRIFT + ART_CLEARANCE) * short };
}

/** Two boxes are apart when neither covers the other and the gap is kept between them. */
export function apartBoxes(a: Box, b: Box, gap: number): boolean {
  return a.x + a.w + gap <= b.x || b.x + b.w + gap <= a.x || a.y + a.h + gap <= b.y || b.y + b.h + gap <= a.y;
}

export function shuffle<T>(list: readonly T[], random: () => number = Math.random): T[] {
  return list
    .map((item) => [random(), item] as const)
    .sort((a, b) => a[0] - b[0])
    .map((pair) => pair[1]);
}

/**
 * A random place for a picture of the given size that is apart from every box in `others` and inside the panel, or
 * null when there is no room. Every other try sits beside another picture, so a free place is found even when the
 * space between the pictures is small.
 */
export function freePlace(
  size: { w: number; h: number },
  others: readonly Box[],
  panel: Panel,
  gap: number,
  margin: number,
  random: () => number = Math.random,
): Box | null {
  const { w, h } = size;
  if (w + 2 * margin > panel.width || h + 2 * margin > panel.height) return null;
  const xMin = margin;
  const xMax = panel.width - w - margin;
  const yMin = margin;
  const yMax = panel.height - h - margin;
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  for (let attempt = 0; attempt < 400; attempt += 1) {
    let x = xMin + random() * (xMax - xMin);
    let y = yMin + random() * (yMax - yMin);
    if (others.length && attempt % 2 === 0) {
      const other = others[Math.floor(random() * others.length)];
      const side = Math.floor(random() * 4);
      if (side === 0) x = other.x - gap - w;
      else if (side === 1) x = other.x + other.w + gap;
      else if (side === 2) y = other.y - gap - h;
      else y = other.y + other.h + gap;
    }
    const box = { x: clamp(x, xMin, xMax), y: clamp(y, yMin, yMax), w, h };
    if (others.every((other) => apartBoxes(box, other, gap))) return box;
  }
  return null;
}

/**
 * Places every picture. When they do not fit at their largest size, they get a little smaller, round by round, and the
 * placement starts again. Returns the box of each picture by name, or null when nothing fits even when small.
 */
export function placeArt(pictures: readonly ArtPicture[], panel: Panel, random: () => number = Math.random): Map<string, Box> | null {
  const { short, margin, gap } = artSpacing(panel);
  const recovery = pictures.find((picture) => picture.recovery);
  const others = pictures.filter((picture) => !picture.recovery);
  for (let round = 0; round < 30; round += 1) {
    const scale = 0.93 ** round;
    const sizeOf = (picture: ArtPicture) => {
      const h = picture.share * short * scale;
      return { w: h / picture.ratio, h };
    };
    const boxes: Box[] = [];
    const placed = new Map<string, Box>();
    const allPlaced = shuffle(others, random).every((picture) => {
      const box = freePlace(sizeOf(picture), boxes, panel, gap, margin, random);
      if (box) {
        boxes.push(box);
        placed.set(picture.name, box);
      }
      return Boolean(box);
    });
    if (!allPlaced) continue;
    if (recovery) {
      const box = freePlace(sizeOf(recovery), boxes, panel, gap * RECOVERY_SPACE, margin, random);
      if (!box) continue;
      placed.set(recovery.name, box);
    }
    return placed;
  }
  return null;
}
