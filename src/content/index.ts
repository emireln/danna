// Resolves bundled lessons, checkpoints and mock tests.
import type { TestDef } from '../lib/types';
import { diagnosticTest, DIAGNOSTIC_ID } from './diagnostic';
import { UNITS, type LessonDef, type UnitDef } from './roadmap';

export const MINI_MOCK_ID = 'bundle-mini-mock';

export interface PathItem {
  lesson: LessonDef;
  checkpoint: boolean;
  unit: UnitDef;
}

/** A unit check uses every question from the unit's lessons. */
export function checkpointOf(unit: UnitDef): LessonDef {
  return {
    id: `${unit.id}-check`,
    unitId: unit.id,
    title: 'Unit check',
    blurb: `Mixed questions from ${unit.title.toLowerCase()}.`,
    skill: unit.lessons[0].skill,
    minutes: Math.max(6, unit.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0)),
    passages: unit.lessons.flatMap((lesson) => lesson.passages),
    questions: unit.lessons.flatMap((lesson) => lesson.questions),
  };
}

/** The linear roadmap: every unit's lessons followed by its check. */
export const PATH: PathItem[] = UNITS.flatMap((unit) => [
  ...unit.lessons.map((lesson) => ({ lesson, checkpoint: false, unit })),
  { lesson: checkpointOf(unit), checkpoint: true, unit },
]);

export function getLesson(id: string): LessonDef | undefined {
  return PATH.find((item) => item.lesson.id === id)?.lesson;
}

export function lessonsForSkill(skill: LessonDef['skill']): LessonDef[] {
  return PATH.filter((item) => !item.checkpoint && item.lesson.skill === skill).map((item) => item.lesson);
}

function lessonTest(lesson: LessonDef, checkpoint: boolean): TestDef {
  return {
    id: lesson.id,
    title: lesson.title,
    subtitle: lesson.blurb,
    kind: checkpoint ? 'checkpoint' : 'lesson',
    skill: checkpoint ? 'mixed' : lesson.skill,
    minutes: lesson.minutes,
    passages: lesson.passages,
    questions: lesson.questions,
  };
}

export function miniMock(): TestDef {
  const reading = getLesson('u4-l1');
  const listening = getLesson('u5-l1');
  const speaking = getLesson('u6-l1');
  const writing = getLesson('u6-l3');
  if (!reading || !listening || !speaking || !writing) throw new Error('The bundled mock test is incomplete.');
  return {
    id: MINI_MOCK_ID,
    title: 'Mini mock test 1',
    subtitle: 'Reading, listening, speaking and writing in one sitting',
    kind: 'mock',
    skill: 'mixed',
    minutes: 14,
    passages: reading.passages,
    questions: [...reading.questions, ...listening.questions, speaking.questions[0], writing.questions[0]],
  };
}

/** Resolves any bundled test id. Returns null for ids that are stored in Supabase. */
export function bundledTest(id: string): TestDef | null {
  if (id === DIAGNOSTIC_ID) return diagnosticTest();
  if (id === MINI_MOCK_ID) return miniMock();
  const item = PATH.find((entry) => entry.lesson.id === id);
  return item ? lessonTest(item.lesson, item.checkpoint) : null;
}

export { diagnosticTest, DIAGNOSTIC_ID };
export { UNITS } from './roadmap';
export type { LessonDef, UnitDef } from './roadmap';
