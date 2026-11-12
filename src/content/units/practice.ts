// Practice for the general path. After its own lessons, every unit gets three lessons: a grammar drill,
// a reading passage with questions, and a listening passage with questions. The sets are in
// practice-a1.ts to practice-c1.ts. This file turns each set into lessons.
import { lesson, type Draft } from '../authoring';
import type { LessonDef } from '../roadmap';
import { PRACTICE_A1 } from './practice-a1';
import { PRACTICE_A2 } from './practice-a2';
import { PRACTICE_B1 } from './practice-b1';
import { PRACTICE_B2 } from './practice-b2';
import { PRACTICE_C1 } from './practice-c1';

export interface PracticeSet {
  grammar: { title: string; blurb: string; items: Draft[] };
  reading: { title: string; blurb: string; text: string; items: Draft[] };
  listening: { title: string; blurb: string; transcript: string; items: Draft[] };
}

/** The three practice lessons of one unit. Each listening question carries the transcript, so it can be played. */
export function practiceLessons(unitId: string, set: PracticeSet): LessonDef[] {
  const listening = set.listening.items.map((item) => (item.type === 'choice' ? { ...item, listen: set.listening.transcript } : item));
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
      items: set.reading.items,
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

const SETS: Record<string, PracticeSet> = { ...PRACTICE_A1, ...PRACTICE_A2, ...PRACTICE_B1, ...PRACTICE_B2, ...PRACTICE_C1 };

/** The practice lessons of a unit, or none when the unit has no practice set. */
export function practiceFor(unitId: string): LessonDef[] {
  const set = SETS[unitId];
  return set ? practiceLessons(unitId, set) : [];
}
