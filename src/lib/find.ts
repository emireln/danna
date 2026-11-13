// Find in a file, like the Find box of Notepad: where the words are, with or without regard to case. Pure
// functions, so the tests can check them without a browser.

/** The most matches one search lists. A very common word in a long text stops here. */
export const MAX_MATCHES = 1000;

/** Where a match starts and ends in the text. */
export type Range = [start: number, end: number];

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The matches of the query, left to right and without overlaps. An empty query finds nothing. */
export function findRanges(text: string, query: string, matchCase = false): Range[] {
  if (!query) return [];
  const pattern = new RegExp(escapeRegExp(query), matchCase ? 'g' : 'gi');
  const ranges: Range[] = [];
  for (const found of text.matchAll(pattern)) {
    const start = found.index ?? 0;
    ranges.push([start, start + found[0].length]);
    if (ranges.length >= MAX_MATCHES) break;
  }
  return ranges;
}

/** A piece of the text: either a match or the words between matches. The pieces join back into the text. */
export interface Span {
  text: string;
  hit: boolean;
}

/** The text cut at its matches, so each match can be shown on its own. */
export function splitHits(text: string, query: string, matchCase = false): Span[] {
  const spans: Span[] = [];
  let at = 0;
  for (const [start, end] of findRanges(text, query, matchCase)) {
    if (start > at) spans.push({ text: text.slice(at, start), hit: false });
    spans.push({ text: text.slice(start, end), hit: true });
    at = end;
  }
  if (at < text.length) spans.push({ text: text.slice(at), hit: false });
  return spans;
}

/** One match in a PDF: the number of the page it is on, counted from 1. */
export interface PageHit {
  page: number;
}

/** The matches across the pages of a PDF, in page order. The text of page 1 is pages[0]. */
export function pageHits(pages: readonly string[], query: string, matchCase = false): PageHit[] {
  const hits: PageHit[] = [];
  pages.forEach((text, index) => {
    const count = findRanges(text, query, matchCase).length;
    for (let number = 0; number < count && hits.length < MAX_MATCHES; number += 1) hits.push({ page: index + 1 });
  });
  return hits;
}
