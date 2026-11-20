// Flashcards (2.0.0): reading a list of cards that the learner pastes in, and the names of the decks that danna makes.
// A line is "front; back" or "front<TAB>back". Lines without both sides are skipped, and at most 500 cards are read.

export const IMPORT_CARD_LIMIT = 500;
export const SAVED_WORDS_TITLE = 'Saved words';

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
