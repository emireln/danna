// Practice for the general path and the TOEFL warm-up. After its own lessons, every unit gets three lessons: a
// grammar drill, a reading passage with questions, and a listening passage with questions. The general sets are in
// practice-a1.ts to practice-c1.ts and the TOEFL sets are in practice-toefl.ts. This file turns each set into lessons.
import { lesson, placeCorrect, type Draft } from '../authoring';
import type { LessonDef } from '../roadmap';
import { PRACTICE_A1 } from './practice-a1';
import { PRACTICE_A2 } from './practice-a2';
import { PRACTICE_B1 } from './practice-b1';
import { PRACTICE_B2 } from './practice-b2';
import { PRACTICE_C1 } from './practice-c1';
import { PRACTICE_TOEFL } from './practice-toefl';

export interface PracticeSet {
  grammar: { title: string; blurb: string; items: Draft[] };
  reading: { title: string; blurb: string; text: string; items: Draft[] };
  listening: { title: string; blurb: string; transcript: string; items: Draft[] };
}

/**
 * The reading and listening sets list the right answer first. This moves it to a position chosen by a hash of the
 * question, so the letter varies, as the grammar drills and the vocabulary lessons already do.
 */
function placeAnswer(item: Draft): Draft {
  if (item.type !== 'choice') return item;
  const correct = item.options[item.answer];
  const wrong = item.options.filter((_, index) => index !== item.answer);
  const placed = placeCorrect(correct, wrong, item.prompt);
  return { ...item, options: placed.options, answer: placed.answer };
}

/** The three practice lessons of one unit. Each listening question carries the transcript, so it can be played. */
export function practiceLessons(unitId: string, set: PracticeSet): LessonDef[] {
  const reading = set.reading.items.map(placeAnswer);
  const listening = set.listening.items.map((item) => {
    const placed = placeAnswer(item);
    return placed.type === 'choice' ? { ...placed, listen: set.listening.transcript } : placed;
  });
  return [
    lesson({
      id: `${unitId}-grammar`,
      unitId,
      title: set.grammar.title,
      blurb: set.grammar.blurb,
      skill: 'language',
      minutes: 5,
      items: set.grammar.items,
    }),
    lesson({
      id: `${unitId}-reading`,
      unitId,
      title: set.reading.title,
      blurb: set.reading.blurb,
      skill: 'reading',
      minutes: 6,
      passages: [{ id: `${unitId}-reading-text`, title: set.reading.title, text: set.reading.text }],
      items: reading,
    }),
    lesson({
      id: `${unitId}-listening`,
      unitId,
      title: set.listening.title,
      blurb: set.listening.blurb,
      skill: 'listening',
      minutes: 5,
      items: listening,
    }),
  ];
}

const SETS: Record<string, PracticeSet> = {
  ...PRACTICE_A1,
  ...PRACTICE_A2,
  ...PRACTICE_B1,
  ...PRACTICE_B2,
  ...PRACTICE_C1,
  ...PRACTICE_TOEFL,
};

/** The practice lessons of a unit, or none when the unit has no practice set. */
export function practiceFor(unitId: string): LessonDef[] {
  const set = SETS[unitId];
  return set ? practiceLessons(unitId, set) : [];
}
