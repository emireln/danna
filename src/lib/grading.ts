// Deterministic grading for every question type that does not need AI.
import type { ChoiceQuestion, ClozeQuestion, ReorderQuestion } from './types';

export type ClozeSegment = { kind: 'text'; value: string } | { kind: 'blank'; index: number; answer: string; reveal: number };

const BLANK = /\{\{([^{}:]+?)(?::(\d+))?\}\}/g;

export function normalizeWord(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9']/g, '');
}

export function parseCloze(text: string): ClozeSegment[] {
  const segments: ClozeSegment[] = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(BLANK)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ kind: 'text', value: text.slice(last, start) });
    const answer = match[1].trim();
    const reveal = Math.max(0, Math.min(Number(match[2] ?? 0) || 0, answer.length - 1));
    segments.push({ kind: 'blank', index, answer, reveal });
    index += 1;
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) });
  return segments;
}

export function clozeAnswers(text: string): string[] {
  return parseCloze(text).flatMap((segment) => (segment.kind === 'blank' ? [segment.answer] : []));
}

export function gradeChoice(question: ChoiceQuestion, response: number | null): number {
  return response === question.answer ? 1 : 0;
}

/** Returns the fraction of blanks filled correctly and which blanks were right. */
export function gradeCloze(question: ClozeQuestion, response: string[]): { fraction: number; correct: boolean[] } {
  const answers = clozeAnswers(question.text);
  const correct = answers.map((answer, index) => normalizeWord(response[index] ?? '') === normalizeWord(answer));
  const hits = correct.filter(Boolean).length;
  return { fraction: answers.length ? hits / answers.length : 0, correct };
}

export function gradeReorder(question: ReorderQuestion, response: string[]): number {
  const expected = question.answer.split(/\s+/).map(normalizeWord).filter(Boolean);
  const actual = response.map(normalizeWord).filter(Boolean);
  const same = expected.length === actual.length && expected.every((word, index) => word === actual[index]);
  return same ? 1 : 0;
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Shuffles the words of a sentence, deterministically per question, never in the original order. */
export function shuffleWords(sentence: string, seed: string): string[] {
  const words = sentence.split(/\s+/).filter(Boolean);
  let state = hash(seed) || 1;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const out = words.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (words.length > 1 && out.join(' ') === words.join(' ')) out.reverse();
  return out;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
