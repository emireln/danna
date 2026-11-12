// My library: the parts that do not touch the screen or the database. File kinds and limits. The
// text cutting and the passages the coach reads are in retrieval.ts.
import type { LibraryKind } from './types';

export const LIBRARY_MAX_BYTES = 20 * 1024 * 1024;
export const LIBRARY_TEXT_LIMIT = 400_000;

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
