// My library: the parts that do not touch the screen or the database. File kinds, and the
// passages the tutor reads for a question.
import type { LibraryKind } from './types';

export const LIBRARY_MAX_BYTES = 20 * 1024 * 1024;
export const LIBRARY_TEXT_LIMIT = 400_000;
/** The most text the tutor reads for one question. */
const TUTOR_CHARS = 12_000;

export const KIND_MIME: Record<LibraryKind, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
};

export const KIND_LABEL: Record<LibraryKind, string> = { pdf: 'PDF', txt: 'TXT', md: 'MD' };

/** The kind of file a name and type describe, or null when the library does not keep that kind. */
export function kindForFile(name: string, mime: string): LibraryKind | null {
  const lower = name.toLowerCase();
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (mime === 'text/markdown' || lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md';
  if (mime === 'text/plain' || lower.endsWith('.txt')) return 'txt';
  return null;
}

/** Cuts text into overlapping pieces, breaking at spaces where it can. */
export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + size);
    if (end < clean.length) {
      const space = clean.lastIndexOf(' ', end);
      if (space > start + size / 2) end = space;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

const STOPWORDS = new Set([
  'about', 'above', 'after', 'again', 'also', 'and', 'any', 'are', 'because', 'been', 'before', 'being', 'between',
  'both', 'but', 'can', 'could', 'did', 'does', 'doing', 'done', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
  'have', 'having', 'her', 'here', 'hers', 'him', 'his', 'how', 'into', 'its', 'just', 'more', 'most', 'not', 'off',
  'once', 'only', 'other', 'our', 'out', 'over', 'own', 'same', 'she', 'should', 'some', 'such', 'than', 'that', 'the',
  'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'too', 'under', 'until', 'very', 'was',
  'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your',
]);

/** The words that help find a passage: lower case, three letters or more, without common words. */
export function termsOf(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [])
    .map((word) => word.replace(/'s$/, ''))
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

export interface LibraryPassage {
  file: string;
  text: string;
}

/**
 * The passages the tutor reads for a question. A small selection is read whole. A larger one is
 * ranked by how well each piece matches the words of the question, and the best pieces that fit are kept.
 */
export function selectPassages(
  question: string,
  files: ReadonlyArray<{ name: string; text: string }>,
  maxChars = TUTOR_CHARS,
): LibraryPassage[] {
  const pieces: Array<{ file: string; text: string; order: number }> = [];
  // A piece is never bigger than the budget, or nothing would fit.
  const size = Math.min(1200, maxChars);
  for (const file of files) {
    for (const text of chunkText(file.text, size, Math.min(150, Math.floor(size / 8)))) {
      pieces.push({ file: file.name, text, order: pieces.length });
    }
  }
  const total = pieces.reduce((sum, piece) => sum + piece.text.length, 0);
  if (total <= maxChars) return pieces.map(({ file, text }) => ({ file, text }));

  const wanted = [...new Set(termsOf(question))];
  const words = pieces.map((piece) => termsOf(piece.text));
  const piecesWith = new Map<string, number>();
  for (const list of words) {
    for (const word of new Set(list)) piecesWith.set(word, (piecesWith.get(word) ?? 0) + 1);
  }

  const scored = pieces.map((piece, index) => {
    const counts = new Map<string, number>();
    for (const word of words[index]) counts.set(word, (counts.get(word) ?? 0) + 1);
    let score = 0;
    for (const word of wanted) {
      const hits = counts.get(word) ?? 0;
      if (hits === 0) continue;
      const rarity = Math.log((pieces.length + 1) / ((piecesWith.get(word) ?? 0) + 1)) + 1;
      score += (hits / Math.sqrt(words[index].length + 1)) * rarity;
    }
    return { ...piece, score };
  });

  const ranked = [...scored].sort((a, b) => b.score - a.score || a.order - b.order);
  const anyMatch = ranked.length > 0 && ranked[0].score > 0;
  const picked: typeof scored = [];
  let used = 0;
  for (const piece of ranked) {
    if (anyMatch && piece.score <= 0) break;
    if (used + piece.text.length > maxChars) continue;
    picked.push(piece);
    used += piece.text.length;
  }
  return picked.sort((a, b) => a.order - b.order).map(({ file, text }) => ({ file, text }));
}

/** The excerpts the tutor sees for a question, each labelled with the file it comes from. */
export function tutorExcerpts(question: string, files: ReadonlyArray<{ name: string; text: string }>): string {
  return selectPassages(question, files)
    .map((passage) => `[${passage.file}]\n${passage.text}`)
    .join('\n\n---\n\n');
}
