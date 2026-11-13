// The extra practice of each unit: a second reading passage with questions, a second listening passage with
// questions, and two writing and two speaking tasks. It comes after the unit's practice (practice*.ts) and before
// its vocabulary. The sets are in extra-a1.ts to extra-toefl.ts. This file turns each set into lessons.
import { lesson, type Draft } from '../authoring';
import type { LessonDef } from '../roadmap';
import { EXTRA_A1 } from './extra-a1';
import { EXTRA_A2 } from './extra-a2';
import { EXTRA_B1 } from './extra-b1';
import { EXTRA_B2 } from './extra-b2';
import { EXTRA_C1 } from './extra-c1';
import { EXTRA_TOEFL } from './extra-toefl';

export interface ExtraSet {
  reading: { title: string; blurb: string; text: string; items: Draft[] };
  listening: { title: string; blurb: string; transcript: string; items: Draft[] };
  writing: { title: string; blurb: string; items: Draft[] };
  speaking: { title: string; blurb: string; items: Draft[] };
}

/** The lessons of one extra set, in order: reading, listening, writing and speaking. */
export function extraLessons(unitId: string, set: ExtraSet): LessonDef[] {
  // Each listening question carries the transcript, so it can be played, as in the practice lessons.
  const listening = set.listening.items.map((item) => (item.type === 'choice' ? { ...item, listen: set.listening.transcript } : item));
  return [
    lesson({
      id: `${unitId}-reading-2`,
      unitId,
      title: set.reading.title,
      blurb: set.reading.blurb,
      skill: 'reading',
      minutes: 7,
      passages: [{ id: `${unitId}-reading-two`, title: set.reading.title, text: set.reading.text }],
      items: set.reading.items,
    }),
    lesson({
      id: `${unitId}-listening-2`,
      unitId,
      title: set.listening.title,
      blurb: set.listening.blurb,
      skill: 'listening',
      minutes: 5,
      items: listening,
    }),
    lesson({
      id: `${unitId}-writing`,
      unitId,
      title: set.writing.title,
      blurb: set.writing.blurb,
      skill: 'writing',
      minutes: 12,
      items: set.writing.items,
    }),
    lesson({
      id: `${unitId}-speaking`,
      unitId,
      title: set.speaking.title,
      blurb: set.speaking.blurb,
      skill: 'speaking',
      minutes: 6,
      items: set.speaking.items,
    }),
  ];
}

const SETS: Record<string, ExtraSet> = {
  ...EXTRA_A1,
  ...EXTRA_A2,
  ...EXTRA_B1,
  ...EXTRA_B2,
  ...EXTRA_C1,
  ...EXTRA_TOEFL,
};

/** The extra lessons of a unit, or none when the unit has no extra set. */
export function extraFor(unitId: string): LessonDef[] {
  const set = SETS[unitId];
  return set ? extraLessons(unitId, set) : [];
}
