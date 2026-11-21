// What the character needs to know about the voice it hears or makes: how loud it is, where its energy sits and its
// pitch. These are pure functions, so the tests need no audio device.

/** One reading of a sound: its loudness, its pitch in hertz (0 when there is none), and its energy in three bands. */
export interface SoundFrame {
  /** Loudness from 0 to 1. */
  level: number;
  /** Pitch in hertz, from 70 to 400, or 0 when no steady pitch is heard. */
  pitch: number;
  /** Energy from 80 to 500 hertz, from 0 to 1. Vowels such as o and u sit here. */
  low: number;
  /** Energy from 500 to 1500 hertz, from 0 to 1. */
  mid: number;
  /** Energy from 1500 to 4000 hertz, from 0 to 1. Vowels such as e and i sit here. */
  high: number;
}

/** The shape of the mouth, each from 0 to 1: open for an open vowel, round for o and u, wide for e and i. */
export interface Mouth {
  open: number;
  round: number;
  wide: number;
}

export const SILENCE: Readonly<SoundFrame> = Object.freeze({ level: 0, pitch: 0, low: 0, mid: 0, high: 0 });
export const CLOSED_MOUTH: Readonly<Mouth> = Object.freeze({ open: 0, round: 0, wide: 0 });

export function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Moves `current` towards `target` by the time passed: at `rate` per second, so the motion is the same at any frame rate. */
export function ease(current: number, target: number, seconds: number, rate: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * seconds));
}

/** The loudness of the samples, from 0 to 1 (their root mean square, scaled so that speech reads well). */
export function loudnessOf(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  return Math.min(1, Math.sqrt(sum / samples.length) * 2);
}

/** The pitch of a voice in hertz, from 70 to 400, or 0 when the samples have no steady pitch. */
export function pitchOf(samples: Float32Array, rate: number): number {
  const minLag = Math.floor(rate / 400);
  const maxLag = Math.ceil(rate / 70);
  const count = samples.length - maxLag;
  // The samples must hold at least two periods of the lowest pitch, and they must not be silence.
  if (count < maxLag || loudnessOf(samples) < 0.02) return 0;
  let head = 0;
  for (let i = 0; i < count; i += 1) head += samples[i] * samples[i];
  const scores: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let cross = 0;
    let tail = 0;
    for (let i = 0; i < count; i += 1) {
      const shifted = samples[i + lag];
      cross += samples[i] * shifted;
      tail += shifted * shifted;
    }
    scores.push(cross / Math.sqrt(head * tail + 1e-12));
  }
  const peak = Math.max(...scores);
  if (peak < 0.6) return 0;
  // The first peak of the curve that is nearly as high as the best one is the period, not a point on its slope or a multiple.
  const threshold = peak * 0.9;
  for (let k = 1; k < scores.length - 1; k += 1) {
    if (scores[k] >= threshold && scores[k] >= scores[k - 1] && scores[k] >= scores[k + 1]) return rate / (minLag + k);
  }
  return rate / (minLag + scores.indexOf(peak));
}

/** The average energy of a spectrum (bytes from 0 to 255, one per bin) in three bands, each from 0 to 1. */
export function bandsOf(bins: Uint8Array, binHz: number): { low: number; mid: number; high: number } {
  const band = (from: number, to: number): number => {
    const first = Math.max(1, Math.ceil(from / binHz));
    const last = Math.min(bins.length - 1, Math.floor(to / binHz));
    let sum = 0;
    let count = 0;
    for (let i = first; i <= last; i += 1) {
      sum += bins[i];
      count += 1;
    }
    return count > 0 ? sum / count / 255 : 0;
  };
  return { low: band(80, 500), mid: band(500, 1500), high: band(1500, 4000) };
}

/** Moves the mouth towards the shape of one reading. The mouth opens with the loudness, and its shape follows the bands. */
export function mouthFor(frame: SoundFrame, previous: Mouth, seconds: number): Mouth {
  const open = clamp01((frame.level - 0.012) * 4);
  const total = frame.low + frame.mid + frame.high + 1e-6;
  const round = open * clamp01((frame.low / total - 0.42) * 3);
  const wide = open * clamp01((frame.high / total - 0.22) * 3) * (1 - round * 0.5);
  return {
    open: ease(previous.open, open, seconds, open > previous.open ? 30 : 12),
    round: ease(previous.round, round, seconds, round > previous.round ? 30 : 12),
    wide: ease(previous.wide, wide, seconds, wide > previous.wide ? 30 : 12),
  };
}
