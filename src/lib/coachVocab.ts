// A vocabulary card of the coach becomes a review item: its example sentence with the word blanked out, so the learner
// fills the word in later, in the same review as their other items. Plain functions, so the rules are tested without
// the screen.
import type { VocabItem } from './coachReply';
import { newReviewItem } from './srs';
import type { ReviewRow } from './types';

const escapeForPattern = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The review key of a word. The same word is kept once, whatever its capitals. */
export function vocabKey(word: string): string {
  return `coach-vocab:${word.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

/**
 * The example with its word blanked out, written the way the review reads a gap: {{word}}. Null when the example
 * does not use the word itself, so the card cannot be kept (a longer word that contains it does not count).
 */
export function vocabCloze(item: VocabItem): string | null {
  // Letters include the accented ones, so a word is never found inside a longer word such as "café".
  const match = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeForPattern(item.word)})(?![\\p{L}\\p{N}])`, 'iu').exec(item.example);
  if (!match) return null;
  const start = match.index + match[1].length;
  const word = match[2];
  return `${item.example.slice(0, start)}{{${word}}}${item.example.slice(start + word.length)}`;
}

/** The review item that keeps the word for practice. Null when the example does not use the word. */
export function vocabReview(item: VocabItem, now: Date = new Date()): ReviewRow | null {
  const text = vocabCloze(item);
  if (!text) return null;
  const key = vocabKey(item.word);
  return newReviewItem(
    key,
    'language',
    {
      question: {
        id: key,
        type: 'cloze',
        skill: 'language',
        prompt: 'Fill in the gap',
        text,
        explanation: item.meaning,
      },
    },
    now,
  );
}
