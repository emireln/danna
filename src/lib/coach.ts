// The coach's chats and files: the rules for chat names, the files that can be sent, and the limits.
// Pure functions, so the tests can check them without a browser.
import type { ChatImage, TutorAttachment } from './types';

/** Files one message can carry. Library files that are mentioned count too. */
export const MAX_FILES = 10;
/** The largest file that can be sent. */
export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
/** The text read from one document. A longer document is cut, and the passages that match the question are sent. */
export const DOCUMENT_TEXT_LIMIT = 200_000;
/** The longest side of a picture after it is made smaller for sending. */
export const IMAGE_MAX_SIDE = 1600;

/** Asks the model for a short name for a chat. The name is written in the language of the first message. */
export const TITLE_SYSTEM = [
  'You name a chat. Write a title of four or five words for a conversation that starts with the message you receive.',
  'Write the title in the language of that message. Reply with the title only: no quotes, no full stop, no emoji.',
].join(' ');

/** The first words of the first question, used when the model cannot name the chat. Empty when there are no words. */
export function fallbackTitle(question: string): string {
  return question
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 5)
    .join(' ')
    .replace(/[.?!…:;,]+$/g, '')
    .slice(0, 60);
}

/** The name the model wrote, cleaned to one line of two to five words. Falls back to the question's first words. */
export function cleanTitle(raw: string, question: string): string {
  const words = raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/^[\s"'“”‘’`*#]+|[\s"'“”‘’`*#.!?:;]+$/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < 2) return fallbackTitle(question);
  return words.slice(0, 5).join(' ').slice(0, 60);
}

export type FileKind = 'image' | 'pdf' | 'text';

/** The kind of a file the coach accepts, or null for any other file. */
export function fileKind(file: { name: string; type: string }): FileKind | null {
  const name = file.name.toLowerCase();
  if (/^image\/(png|jpeg|webp|gif)$/.test(file.type) || /\.(png|jpe?g|webp|gif)$/.test(name)) return 'image';
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (file.type === 'text/plain' || file.type === 'text/markdown' || /\.(txt|md|markdown)$/.test(name)) return 'text';
  return null;
}

/** A file that is waiting to be sent with the next message. */
export interface PendingPicture {
  key: string;
  kind: 'image';
  name: string;
  size: number;
  image: ChatImage;
  /** A small copy for the chip, as a data URL. */
  preview: string;
}

export interface PendingDocument {
  key: string;
  kind: 'document';
  name: string;
  size: number;
  /** The text of the file, read in the browser. */
  text: string;
}

export interface PendingLibrary {
  key: string;
  kind: 'library';
  name: string;
  size: number;
  /** The id of the library file, whose text the coach reads when the message is sent. */
  fileId: string;
}

export type PendingFile = PendingPicture | PendingDocument | PendingLibrary;

/** What a message keeps of its files: names, kinds and sizes. The contents are not kept. */
export function attachmentsOf(files: PendingFile[]): TutorAttachment[] {
  return files.map((file) => ({ name: file.name, kind: file.kind, size: file.size }));
}
