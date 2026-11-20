import type { CardRow } from './types';

// Flashcards (2.0.0): reading a list of cards that the learner pastes in, and the names of the decks that danna makes.
// A line is "front; back" or "front<TAB>back". Lines without both sides are skipped, and at most 500 cards are read.

export const IMPORT_CARD_LIMIT = 500;
export const SAVED_WORDS_TITLE = 'Saved words';
/** The names the app's own decks have: the English name, and the Portuguese one made when the app was in Portuguese. */
export const SAVED_WORDS_NAMES: readonly string[] = [SAVED_WORDS_TITLE, 'Palavras salvas'];
export const CORRECTIONS_NAMES: readonly string[] = ['My corrections', 'Minhas correções'];

export interface ParsedCard {
  front: string;
  back: string;
}

export interface ImportResult {
  cards: ParsedCard[];
  /** Lines that were not a card: no separator, or one side empty. */
  skipped: number;
  /** True when there were more cards than the limit, and the rest were not read. */
  truncated: boolean;
}

export function parseDeckImport(text: string): ImportResult {
  const cards: ParsedCard[] = [];
  let skipped = 0;
  let truncated = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (cards.length >= IMPORT_CARD_LIMIT) {
      truncated = true;
      break;
    }
    const separator = line.includes('\t') ? '\t' : line.includes(';') ? ';' : null;
    if (!separator) {
      skipped += 1;
      continue;
    }
    const at = line.indexOf(separator);
    const front = line.slice(0, at).trim();
    const back = line.slice(at + 1).trim();
    if (!front || !back) {
      skipped += 1;
      continue;
    }
    cards.push({ front: front.slice(0, 300), back: back.slice(0, 600) });
  }
  return { cards, skipped, truncated };
}

/** A study session shows at most this many new cards and this many cards in all. */
export const SESSION_NEW_LIMIT = 10;
export const SESSION_LIMIT = 50;
/** One XP for each card graded in a session. */
export const XP_PER_CARD = 1;

/**
 * The cards of one session: the reviews that are due, earliest due first, then new cards up to the limit for new
 * cards. A card that is not due yet is left out, and so is anything beyond the session limit.
 */
export function sessionQueue(cards: readonly CardRow[], now: Date, newLimit = SESSION_NEW_LIMIT, limit = SESSION_LIMIT): CardRow[] {
  const due = cards
    .filter((card) => new Date(card.due_at).getTime() <= now.getTime())
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  const reviews = due.filter((card) => card.state !== 'new');
  const fresh = due.filter((card) => card.state === 'new').slice(0, newLimit);
  return [...reviews, ...fresh].slice(0, limit);
}
