// Small constructors so the bundled content stays compact and consistent.
import type {
  ChoiceQuestion,
  ClozeQuestion,
  Passage,
  ReorderQuestion,
  Skill,
  SpeakingQuestion,
  WritingQuestion,
} from '../lib/types';

interface Extra {
  passageId?: string;
  listen?: string;
}

export const choice = (
  id: string,
  skill: Skill,
  prompt: string,
  options: string[],
  answer: number,
  explanation?: string,
  extra: Extra = {},
): ChoiceQuestion => ({ id, type: 'choice', skill, prompt, options, answer, explanation, ...extra });

export const cloze = (id: string, skill: Skill, prompt: string, text: string, explanation?: string): ClozeQuestion => ({
  id,
  type: 'cloze',
  skill,
  prompt,
  text,
  explanation,
});

export const reorder = (id: string, prompt: string, answer: string, explanation?: string): ReorderQuestion => ({
  id,
  type: 'reorder',
  skill: 'language',
  prompt,
  answer,
  explanation,
});

export const writing = (
  id: string,
  prompt: string,
  minWords: number,
  rubric: string[],
  passage?: Passage,
): WritingQuestion => ({ id, type: 'writing', skill: 'writing', prompt, minWords, rubric, passageId: passage?.id });

export const speaking = (id: string, prompt: string, seconds: number, rubric: string[]): SpeakingQuestion => ({
  id,
  type: 'speaking',
  skill: 'speaking',
  prompt,
  seconds,
  rubric,
});
