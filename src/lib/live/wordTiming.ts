// When each word of the coach's speech is said, in milliseconds from the start of the speech. The lip-sync of the avatar
// needs these times: each word becomes the mouth shapes of its sounds. The times are estimates. With the audio's real
// length, the words fill it exactly; without it, a word takes about as long as it takes to say at a natural pace.
// Pure functions, so the rules are tested without a browser.

/** The gap between two words, in milliseconds. */
export const GAP_MS = 35;
/** The shortest and longest a word is said. */
const MIN_WORD_MS = 160;
const MAX_WORD_MS = 650;

/** The words of a text, split at spaces. Empty text gives no words. */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((word) => word.length > 0);
}

/** How long a word takes to say at a natural pace, from its letters. */
export function wordMs(word: string): number {
  const letters = (word.match(/[\p{L}\p{N}]/gu) ?? []).length;
  return Math.min(MAX_WORD_MS, Math.max(MIN_WORD_MS, 110 + letters * 55));
}

export interface WordTimes {
  wtimes: number[];
  wdurations: number[];
  /** When the last word ends. */
  endMs: number;
}

/**
 * The times of the words. Without `totalMs`, the words start at `startMs` and take their natural length. With it (the
 * length of the audio that says them), the words share that length in proportion to their natural lengths.
 */
export function wordSchedule(words: readonly string[], startMs: number, totalMs?: number): WordTimes {
  const wtimes: number[] = [];
  const wdurations: number[] = [];
  if (words.length === 0) return { wtimes, wdurations, endMs: startMs };
  const weights = words.map(wordMs);
  const naturalTotal = weights.reduce((sum, value) => sum + value, 0);
  const gaps = GAP_MS * (words.length - 1);
  // A word never shrinks below a short blip, even when the audio is very short.
  const scale =
    totalMs !== undefined && totalMs > 0 && naturalTotal > 0 ? Math.max(40, totalMs - gaps) / naturalTotal : 1;
  let at = startMs;
  words.forEach((_, index) => {
    const duration = Math.max(40, weights[index] * scale);
    wtimes.push(Math.round(at));
    wdurations.push(Math.round(duration));
    at += duration + GAP_MS;
  });
  return { wtimes, wdurations, endMs: at - GAP_MS };
}
