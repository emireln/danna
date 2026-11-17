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

/** Words that read badly as the last word of a chat's name. They are left off the end. */
const WEAK_ENDINGS = new Set([
  'a', 'an', 'the', 'of', 'to', 'for', 'with', 'and', 'or', 'in', 'on', 'at', 'by', 'from', 'about', 'is', 'are', 'was',
  'be', 'it', 'this', 'that', 'my', 'your', 'me', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'will', 'please',
]);

/**
 * A chat's name, taken from the learner's own first question: its first sentence, at most five words, in the same
 * language. No model writes the name, so it never comes out in another language. Empty when there are no words.
 */
export function titleFromQuestion(question: string): string {
  const sentence = question.replace(/\s+/g, ' ').trim().split(/[.?!…](?=\s|$)/)[0] ?? '';
  const words = sentence.replace(/[*_`#"“”‘’]/g, '').split(' ').filter(Boolean).slice(0, 5);
  while (words.length > 1 && WEAK_ENDINGS.has(words[words.length - 1].toLowerCase().replace(/[^\p{L}]/gu, ''))) words.pop();
  const name = words.join(' ').replace(/[\s,;:]+$/g, '');
  if (!/[\p{L}\p{N}]/u.test(name)) return '';
  return (name.charAt(0).toUpperCase() + name.slice(1)).slice(0, 60);
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

/** Questions the coach offers to start a chat. Some are picked at random each time, so every new chat starts differently. */
export const STARTERS: readonly string[] = [
  'Explain my weakest skill and what to do this week',
  'Quiz me on present perfect vs past simple',
  'Correct this sentence and explain the rule: She have went to school yesterday.',
  'Plan my next 15 minutes of study',
  'Give me five phrasal verbs for everyday conversation, with an example for each',
  'Explain when to use make and do, with examples',
  'Quiz me on prepositions of time: in, on and at',
  'Teach me five idioms I can use at work, and how to use them',
  'Help me practise the past continuous with a short story',
  'Explain the difference between much and many, with examples',
  'Give me a short text with three mistakes, and let me find them',
  'Give me a short reading about travel, then three questions about it',
  'Explain the first conditional with two example sentences',
  'Quiz me on modal verbs: can, could, must and should',
  'Practise small talk with me. Start with a question about my day.',
  'Teach me how to start and end a formal email in English',
  'Give me ten food words, with a sentence for each',
  'Explain the difference between since and for, with examples',
  'Help me describe my home with there is and there are',
  'Give me one listening tip I can practise for ten minutes a day',
  'Explain when to use a and an, with examples',
  'Write a short dialogue in a restaurant, then quiz me on its words',
  'What are the most common mistakes Portuguese speakers make in English?',
  'Give me a TOEFL-style question about the main idea of a short passage',
  'Teach me five words for feelings, with examples',
  'Explain the difference between say, tell and speak',
];

/** How many starter questions a new chat shows. */
export const STARTER_COUNT = 4;

/** A random pick of `count` items from the pool, in a random order. The pool itself is not changed. */
export function pickStarters<T>(pool: readonly T[], count: number, random: () => number = Math.random): T[] {
  const copy = [...pool];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy.slice(0, Math.max(0, count));
}
