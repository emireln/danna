// Resolves the bundled lessons, unit checks, level tests, the TOEFL warm-up test and the placement test.
import { LEVELS, type Level, type Passage, type Question, type TestDef } from '../lib/types';
import { diagnosticTest, DIAGNOSTIC_ID } from './diagnostic';
import { TOEFL_UNITS, UNITS, type LessonDef, type UnitDef } from './roadmap';

export interface PathItem {
  lesson: LessonDef;
  checkpoint: boolean;
  unit: UnitDef;
}

/** A unit check takes the first four questions of each lesson in its unit, so it stays short. */
export function checkpointOf(unit: UnitDef): LessonDef {
  return {
    id: `${unit.id}-check`,
    unitId: unit.id,
    title: 'Unit check',
    blurb: 'Mixed questions from this unit.',
    skill: unit.lessons[0].skill,
    minutes: Math.max(6, unit.lessons.length * 3),
    passages: unit.lessons.flatMap((lesson) => lesson.passages),
    questions: unit.lessons.flatMap((lesson) => lesson.questions.slice(0, 4)),
  };
}

/** The general path: every lesson in order, with a unit check after each unit. */
export const PATH: PathItem[] = UNITS.flatMap((unit) => [
  ...unit.lessons.map((lesson) => ({ lesson, checkpoint: false, unit })),
  { lesson: checkpointOf(unit), checkpoint: true, unit },
]);

const TOEFL_LESSONS: LessonDef[] = TOEFL_UNITS.flatMap((unit) => unit.lessons);
// The warm-up test covers reading, listening, speaking and writing, so it leaves out the grammar drills.
const WARM_UP_LESSONS: LessonDef[] = TOEFL_LESSONS.filter((lesson) => !lesson.id.endsWith('-grammar'));

export function getLesson(id: string): LessonDef | undefined {
  return PATH.find((item) => item.lesson.id === id)?.lesson ?? TOEFL_LESSONS.find((lesson) => lesson.id === id);
}

export function lessonsForSkill(skill: LessonDef['skill']): LessonDef[] {
  return PATH.filter((item) => !item.checkpoint && item.lesson.skill === skill).map((item) => item.lesson);
}

/** The lessons of the TOEFL warm-up, in order. */
export function toeflLessons(): LessonDef[] {
  return TOEFL_LESSONS;
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

/** Takes questions in turns from each lesson, so a test covers all of them, up to the limit. */
function mixed(lessons: LessonDef[], limit: number): { questions: Question[]; passages: Passage[] } {
  const questions: Question[] = [];
  const rounds = Math.max(0, ...lessons.map((lesson) => lesson.questions.length));
  for (let round = 0; round < rounds && questions.length < limit; round += 1) {
    for (const lesson of lessons) {
      const question = lesson.questions[round];
      if (question && questions.length < limit) questions.push(question);
    }
  }
  const used = new Set(questions.flatMap((question) => (question.passageId ? [question.passageId] : [])));
  const passages = lessons.flatMap((lesson) => lesson.passages).filter((passage) => used.has(passage.id));
  return { questions, passages };
}

export const levelTestId = (level: Level): string => `mock-${level.toLowerCase()}`;
export const TOEFL_TEST_ID = 'mock-toefl';

/** One sitting that covers every lesson of a level. */
export function levelTest(level: Level): TestDef {
  const lessons = PATH.filter((item) => !item.checkpoint && item.unit.level === level).map((item) => item.lesson);
  const { questions, passages } = mixed(lessons, 20);
  return {
    id: levelTestId(level),
    title: `${level} level test`,
    subtitle: 'Questions from every lesson of this level',
    kind: 'mock',
    skill: 'mixed',
    minutes: Math.max(10, Math.round(questions.length * 0.8)),
    passages,
    questions,
  };
}

/** A TOEFL-style sitting: reading, listening, speaking and writing tasks. */
export function toeflTest(): TestDef {
  const { questions, passages } = mixed(WARM_UP_LESSONS, 18);
  return {
    id: TOEFL_TEST_ID,
    title: 'TOEFL warm-up test',
    subtitle: 'Reading, listening, speaking and writing tasks in one sitting',
    kind: 'mock',
    skill: 'mixed',
    minutes: 25,
    passages,
    questions,
  };
}

export const wordsTestId = (level: Level): string => `words-${level.toLowerCase()}`;

/** A vocabulary test for one level: the words of every unit of that level, taken in turns. */
export function wordsTest(level: Level): TestDef {
  const lessons = PATH.filter((item) => !item.checkpoint && item.unit.level === level && item.lesson.id.endsWith('-words')).map(
    (item) => item.lesson,
  );
  const { questions, passages } = mixed(lessons, 30);
  return {
    id: wordsTestId(level),
    title: `${level} vocabulary test`,
    subtitle: 'Words from every unit of this level',
    kind: 'mock',
    skill: 'language',
    minutes: Math.max(8, Math.round(questions.length * 0.6)),
    passages,
    questions,
  };
}

// Mock tests of two skills together: reading with listening, and writing with speaking. Each draws on the
// lessons of one level, or of the TOEFL track, in turns, like the level tests.
const SKILL_PAIRS = [
  { key: 'reading-listening', skills: ['reading', 'listening'], title: 'reading and listening mock', subtitle: 'Questions from the reading and listening lessons' },
  { key: 'writing-speaking', skills: ['writing', 'speaking'], title: 'writing and speaking mock', subtitle: 'Tasks from the writing and speaking lessons' },
] as const;

function pairTest(id: string, title: string, subtitle: string, lessons: LessonDef[]): TestDef {
  const { questions, passages } = mixed(lessons, 20);
  return {
    id,
    title,
    subtitle,
    kind: 'mock',
    skill: 'mixed',
    minutes: Math.max(10, Math.round(questions.length * 0.8)),
    passages,
    questions,
  };
}

/** The two-skill mock tests of one level: reading with listening, and writing with speaking. */
export function levelSkillTests(level: Level): TestDef[] {
  return SKILL_PAIRS.map((pair) => {
    const lessons = PATH.filter(
      (item) => !item.checkpoint && item.unit.level === level && (pair.skills as readonly string[]).includes(item.lesson.skill),
    ).map((item) => item.lesson);
    return pairTest(`mock-${level.toLowerCase()}-${pair.key}`, `${level} ${pair.title}`, pair.subtitle, lessons);
  });
}

/** The two-skill mock tests of the TOEFL warm-up track. */
export function toeflSkillTests(): TestDef[] {
  return SKILL_PAIRS.map((pair) =>
    pairTest(
      `mock-toefl-${pair.key}`,
      `TOEFL ${pair.title}`,
      pair.subtitle,
      TOEFL_LESSONS.filter((lesson) => (pair.skills as readonly string[]).includes(lesson.skill)),
    ),
  );
}

/** Every two-skill mock test: for each level, and for the TOEFL track. */
export function skillTests(): TestDef[] {
  return [...LEVELS.flatMap((level) => levelSkillTests(level)), ...toeflSkillTests()];
}

/** Resolves any bundled test id. Returns null for ids that are stored in Supabase. */
export function bundledTest(id: string): TestDef | null {
  if (id === DIAGNOSTIC_ID) return diagnosticTest();
  if (id === TOEFL_TEST_ID) return toeflTest();
  const level = LEVELS.find((item) => levelTestId(item) === id);
  if (level) return levelTest(level);
  const words = LEVELS.find((item) => wordsTestId(item) === id);
  if (words) return wordsTest(words);
  const pair = skillTests().find((test) => test.id === id);
  if (pair) return pair;
  const item = PATH.find((entry) => entry.lesson.id === id);
  if (item) return lessonTest(item.lesson, item.checkpoint);
  const toefl = TOEFL_LESSONS.find((lesson) => lesson.id === id);
  return toefl ? lessonTest(toefl, false) : null;
}

export { diagnosticTest, DIAGNOSTIC_ID };
export { UNITS, TOEFL_UNITS } from './roadmap';
export type { LessonDef, UnitDef } from './roadmap';
