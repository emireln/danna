// Finds the word under a click in the library reader (2.0.0). The browser says which character of which text node is
// under the pointer; the sentence is read from the text of the block around it. The page itself is not changed: the
// tapped word is marked with the CSS Custom Highlight API, where the browser has it, and the card names it in any case.
import { wordBounds, wordInText, type WordHit } from './define';

const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, pre, div';
const MARK = 'tapped-word';

export interface TappedWord {
  hit: WordHit;
  /** The word's place in its text node, for the mark on the page, or null when it cannot be placed. */
  range: Range | null;
}

interface CaretFinder {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
}

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const finder = document as Document & CaretFinder;
  const position = finder.caretPositionFromPoint?.(x, y);
  if (position) return { node: position.offsetNode, offset: position.offset };
  const range = finder.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

/** The word under a point of the screen, with its sentence, or null when the point is not on a word. */
export function tappedWord(x: number, y: number): TappedWord | null {
  const caret = caretAt(x, y);
  if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return null;
  const node = caret.node as Text;
  const block = node.parentElement?.closest(BLOCKS) ?? node.parentElement;
  if (!block) return null;
  const before = document.createRange();
  before.selectNodeContents(block);
  before.setEnd(node, caret.offset);
  const hit = wordInText(block.textContent ?? '', before.toString().length);
  if (!hit) return null;
  const local = wordBounds(node.data, caret.offset);
  let range: Range | null = null;
  if (local) {
    range = document.createRange();
    range.setStart(node, local.start);
    range.setEnd(node, local.end);
  }
  return { hit, range };
}

interface HighlightRegistry {
  highlights?: Map<string, unknown>;
}

type HighlightConstructor = new (...ranges: Range[]) => unknown;

/** Marks the tapped word on the page, or clears the mark when there is no range. Browsers without the API show no mark. */
export function markTapped(range: Range | null): void {
  if (typeof CSS === 'undefined') return;
  const registry = (CSS as unknown as HighlightRegistry).highlights;
  const Highlight = (globalThis as unknown as { Highlight?: HighlightConstructor }).Highlight;
  if (!registry || !Highlight) return;
  if (range) registry.set(MARK, new Highlight(range));
  else registry.delete(MARK);
}
