// Retrieval for My library. The coach does not read whole files. Each file is cut into sections and
// pieces, the pieces are ranked against the question with BM25 (the ranking most search engines use),
// and only the best pieces that fit the budget are sent, each labelled with its file and section.
// A short map of every chosen file (its sections, or where it starts) is always sent, so the coach
// knows what the files cover. Indexes are built once per file and kept in memory.

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

/** Common English words that do not help find a passage. */
export const STOPWORDS = new Set([
  'about', 'above', 'after', 'again', 'also', 'and', 'any', 'are', 'because', 'been', 'before', 'being', 'between',
  'both', 'but', 'can', 'could', 'did', 'does', 'doing', 'done', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
  'have', 'having', 'her', 'here', 'hers', 'him', 'his', 'how', 'into', 'its', 'just', 'more', 'most', 'not', 'off',
  'once', 'only', 'other', 'our', 'out', 'over', 'own', 'same', 'she', 'should', 'some', 'such', 'than', 'that', 'the',
  'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'too', 'under', 'until', 'very', 'was',
  'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your',
]);

/** The most text sent for one question, in characters (about 2,300 tokens). */
export const CONTEXT_CHARS = 9_000;
const PIECE_CHARS = 900;
const MAP_CHARS = 400;
const K1 = 1.2;
const B = 0.75;
const SEPARATOR = '\n\n---\n\n';

export interface LibraryDocument {
  id: string;
  name: string;
  text: string;
}

export interface Piece {
  docId: string;
  file: string;
  section: string;
  order: number;
  text: string;
  tf: Map<string, number>;
  length: number;
}

export interface DocumentIndex {
  id: string;
  name: string;
  map: string;
  pieces: Piece[];
}

export interface Retrieved {
  /** The file map and the labelled passages, ready to send to the coach. */
  text: string;
  /** The files the passages come from. */
  files: string[];
  /** How many passages were chosen. */
  passages: number;
}

/** A light stemmer, so "studies", "study" and "studied" count as the same word. */
export function stem(word: string): string {
  if (word.length > 5 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('ied')) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** The useful words of a text: lower case, three letters or more, no common words, stemmed. */
export function tokens(text: string): string[] {
  const found: string[] = [];
  for (const raw of text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []) {
    const word = raw.replace(/['’]s$/u, '').replace(/^['’-]+|['’-]+$/gu, '');
    if (word.length < 3 || STOPWORDS.has(word) || /^\p{N}+$/u.test(word)) continue;
    found.push(stem(word));
  }
  return found;
}

/** A line that starts a section: a Markdown heading, "Unit 3: ...", "2.1 Methods" or a short capitalised title. */
function isHeading(line: string): boolean {
  const clean = line.trim();
  if (clean.length === 0 || clean.length > 80) return false;
  if (/^#{1,6}\s+\S/.test(clean)) return true;
  if (/^(unit|chapter|section|lesson|part|module)\s+[\w.]+/i.test(clean) && !/[.;!?]$/.test(clean)) return true;
  if (/^\d+(\.\d+)*[.):]?\s+[A-Z][^.!?]*$/.test(clean)) return true;
  return /^[A-Z][A-Z0-9 '&:-]{3,60}$/.test(clean);
}

function cleanHeading(line: string): string {
  return line.trim().replace(/^#{1,6}\s*/, '').replace(/[:\s]+$/, '').slice(0, 80);
}

/** Cuts a text into pieces of about `size` characters. A piece never crosses a section. */
export function piecesOf(text: string, size = PIECE_CHARS): Array<{ section: string; text: string }> {
  const paragraphs: Array<{ section: string; text: string }> = [];
  let section = '';
  let current: string[] = [];
  const flush = () => {
    const body = current.join('\n').trim();
    if (body) paragraphs.push({ section, text: body });
    current = [];
  };
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line.trim() === '') {
      flush();
      continue;
    }
    if (isHeading(line)) {
      flush();
      section = cleanHeading(line);
    }
    current.push(line);
  }
  flush();

  const pieces: Array<{ section: string; text: string }> = [];
  let buffer = '';
  let bufferSection = '';
  const emit = () => {
    if (buffer.trim()) pieces.push({ section: bufferSection, text: buffer.trim() });
    buffer = '';
  };
  for (const paragraph of paragraphs) {
    const parts = paragraph.text.length > size ? chunkText(paragraph.text, size, 0) : [paragraph.text];
    for (const part of parts) {
      if (buffer && (paragraph.section !== bufferSection || buffer.length + part.length + 2 > size)) emit();
      if (!buffer) bufferSection = paragraph.section;
      buffer = buffer ? `${buffer}\n\n${part}` : part;
    }
  }
  emit();
  return pieces;
}

/** Builds the index of one file: its pieces with their word counts, and the map the coach sees. */
export function indexDocument(doc: LibraryDocument): DocumentIndex {
  const parts = piecesOf(doc.text);
  const pieces = parts.map((part, order): Piece => {
    const terms = tokens(part.text);
    const tf = new Map<string, number>();
    for (const term of terms) tf.set(term, (tf.get(term) ?? 0) + 1);
    return { docId: doc.id, file: doc.name, section: part.section, order, text: part.text, tf, length: terms.length };
  });
  const sections = [...new Set(parts.map((part) => part.section).filter(Boolean))];
  const start = doc.text.replace(/\s+/g, ' ').trim().slice(0, 240);
  const map = `${sections.length > 0 ? `Sections: ${sections.slice(0, 40).join(' | ')}. ` : ''}Starts with: ${start}`;
  return { id: doc.id, name: doc.name, map: map.slice(0, MAP_CHARS), pieces };
}

const cache = new Map<string, DocumentIndex>();

/** The index of a file. It is built once, and kept while the file's text does not change. */
export function indexFor(doc: LibraryDocument): DocumentIndex {
  const key = `${doc.id}:${doc.text.length}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const built = indexDocument(doc);
  cache.set(key, built);
  return built;
}

/**
 * The weighted words of a question. A short follow-up ("explain that again") borrows the words of
 * the question before it, at half weight.
 */
export function queryTerms(question: string, earlier: ReadonlyArray<string> = []): Map<string, number> {
  const weights = new Map<string, number>();
  for (const term of tokens(question)) weights.set(term, 1);
  if (weights.size < 3 && earlier.length > 0) {
    for (const term of tokens(earlier[earlier.length - 1])) {
      if (!weights.has(term)) weights.set(term, 0.5);
    }
  }
  return weights;
}

const labelOf = (piece: Piece): string => `[${piece.file}${piece.section ? ` · ${piece.section}` : ''}]`;

/**
 * The passages for one question, ranked with BM25 across the chosen files. The result stays within
 * `budget` characters and always starts with the map of the files.
 */
export function retrieve(
  question: string,
  docs: ReadonlyArray<DocumentIndex>,
  earlier: ReadonlyArray<string> = [],
  budget = CONTEXT_CHARS,
): Retrieved {
  const usable = docs.filter((doc) => doc.pieces.length > 0);
  if (usable.length === 0) return { text: '', files: [], passages: 0 };

  const mapLimit = Math.max(120, Math.floor((budget * 0.25) / usable.length));
  const mapText = `Files and sections:\n${usable
    .map((doc) => `[${doc.name} · overview] ${doc.map.slice(0, mapLimit)}`)
    .join('\n')}`;
  const room = budget - mapText.length - SEPARATOR.length;

  const pieces = usable.flatMap((doc) => doc.pieces);
  const averageLength = pieces.reduce((sum, piece) => sum + piece.length, 0) / pieces.length || 1;
  const scores = new Map<Piece, number>();
  for (const [term, weight] of queryTerms(question, earlier)) {
    const withTerm = pieces.filter((piece) => piece.tf.has(term));
    if (withTerm.length === 0) continue;
    const idf = Math.log(1 + (pieces.length - withTerm.length + 0.5) / (withTerm.length + 0.5));
    for (const piece of withTerm) {
      const tf = piece.tf.get(term) ?? 0;
      const norm = tf + K1 * (1 - B + (B * piece.length) / averageLength);
      scores.set(piece, (scores.get(piece) ?? 0) + weight * idf * ((tf * (K1 + 1)) / norm));
    }
  }

  const chosen: Array<{ piece: Piece; body: string }> = [];
  let used = 0;
  const add = (piece: Piece, body: string): void => {
    const size = labelOf(piece).length + body.length + 2 + SEPARATOR.length;
    if (used + size > room) return;
    chosen.push({ piece, body });
    used += size;
  };

  const ranked = [...scores.entries()].filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]);
  for (const [piece] of ranked) add(piece, piece.text);

  if (chosen.length === 0) {
    // Nothing matches, or nothing fits: the start of each file, cut to the room that is left.
    for (const doc of usable) {
      const first = doc.pieces[0];
      const limit = room - used - labelOf(first).length - 2 - SEPARATOR.length;
      if (limit > 100) add(first, first.text.slice(0, limit));
    }
  }

  const ordered = usable.flatMap((doc) =>
    chosen.filter(({ piece }) => piece.docId === doc.id).sort((a, b) => a.piece.order - b.piece.order),
  );
  const blocks = ordered.map(({ piece, body }) => `${labelOf(piece)}\n${body}`);
  return {
    text: [mapText, ...blocks].join(SEPARATOR),
    files: [...new Set(ordered.map(({ piece }) => piece.file))],
    passages: ordered.length,
  };
}
