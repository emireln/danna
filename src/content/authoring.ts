// Helpers for the bundled lessons. A lesson is a list of items. The helpers number the items, give
// each one its lesson's skill, and build vocabulary items from a word list, so the lesson files stay
// short and consistent. Answer positions are fixed by a hash of the item, so they are never the same
// letter every time and never change between runs.
import type { Accent, Level, Passage, Question, Skill } from '../lib/types';
import type { LessonDef, UnitDef } from './roadmap';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** One item before its lesson gives it an id and a skill. */
export type Draft = DistributiveOmit<Question, 'id' | 'skill'>;

/** A vocabulary entry: the word, its meaning, and an example with the word in [brackets]. */
export type WordEntry = [word: string, meaning: string, example: string];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function placeCorrect(correct: string, wrong: string[], seed: string): { options: string[]; answer: number } {
  const answer = hash(seed) % (wrong.length + 1);
  const options = [...wrong];
  options.splice(answer, 0, correct);
  return { options, answer };
}

/** A multiple-choice item. `answer` is the index of the right option. */
export function mc(prompt: string, options: string[], answer: number, explanation?: string): Draft {
  return { type: 'choice', prompt, options, answer, explanation };
}

/** A grammar item: the sentence has a gap (___), and the correct form is placed among the others. */
export function pick(sentence: string, correct: string, wrong: string[], explanation?: string): Draft {
  const { options, answer } = placeCorrect(correct, wrong, sentence);
  return mc(sentence, options, answer, explanation);
}

/** A listening item: the transcript is read aloud before the question. */
export function listen(prompt: string, transcript: string, options: string[], answer: number, explanation?: string): Draft {
  return { type: 'choice', prompt, options, answer, explanation, listen: transcript };
}

/** Text with blanks written as {{word}}. The learner types each missing word. */
export function gap(text: string, explanation?: string): Draft {
  if (!/\{\{[^{}]+\}\}/.test(text)) throw new Error(`A gap item has no blank: ${text}`);
  return { type: 'cloze', prompt: 'Fill in the gaps.', text, explanation };
}

/** A sentence whose words are shuffled for the learner, who puts them back in order. */
export function order(answer: string, explanation?: string): Draft {
  return { type: 'reorder', prompt: 'Put the words in the right order.', answer, explanation };
}

export function write(prompt: string, minWords: number, rubric: string[]): Draft {
  return { type: 'writing', prompt, minWords, rubric };
}

export function speak(prompt: string, seconds: number, rubric: string[]): Draft {
  return { type: 'speaking', prompt, seconds, rubric };
}

export interface LessonInput {
  id: string;
  unitId: string;
  title: string;
  blurb: string;
  skill: Skill;
  minutes: number;
  passages?: Passage[];
  items: Draft[];
}

export function lesson(input: LessonInput): LessonDef {
  const passages = input.passages ?? [];
  // A lesson with one passage links every multiple-choice item to it.
  const onlyPassage = passages.length === 1 ? passages[0].id : undefined;
  return {
    id: input.id,
    unitId: input.unitId,
    title: input.title,
    blurb: input.blurb,
    skill: input.skill,
    minutes: input.minutes,
    passages,
    questions: input.items.map((item, index) => {
      const question = { ...item, id: `${input.id}-${index + 1}`, skill: input.skill };
      if (onlyPassage && question.type === 'choice' && !question.passageId) {
        return { ...question, passageId: onlyPassage } as Question;
      }
      return question as Question;
    }),
  };
}

/**
 * A vocabulary lesson. Every word gets a meaning question with three meanings from its neighbours
 * in the list, and the first four words also get a gap-fill from their example sentence.
 */
export function vocabulary(input: Omit<LessonInput, 'items' | 'skill'> & { words: WordEntry[] }): LessonDef {
  const meanings = input.words.map(([, meaning]) => meaning);
  const items: Draft[] = input.words.map(([word, meaning], index) => {
    const wrong = [1, 2, 3].map((step) => meanings[(index + step) % meanings.length]);
    const { options, answer } = placeCorrect(meaning, wrong, word);
    return mc(`What does “${word}” mean?`, options, answer);
  });
  input.words.slice(0, 4).forEach(([word, , example]) => {
    if (!example.includes(`[${word}]`)) throw new Error(`The example for “${word}” must contain [${word}].`);
    items.push(gap(example.replace(`[${word}]`, `{{${word}}}`)));
  });
  return lesson({ ...input, skill: 'language', items });
}

export interface UnitInput {
  id: string;
  title: string;
  blurb: string;
  level: Level;
  accent: Accent;
  lessons: LessonDef[];
}

export function unit(input: UnitInput): UnitDef {
  return { ...input, number: 0 };
}
