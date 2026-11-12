// The learning path. General English runs from A1 to C1 in units of lessons, and each unit ends with
// a check. The TOEFL warm-up is a separate track that can be used at any time.
import type { Accent, Level, Passage, Question, Skill } from '../lib/types';
import { A1_UNITS } from './units/a1';
import { A2_UNITS } from './units/a2';
import { B1_UNITS } from './units/b1';
import { B2_UNITS } from './units/b2';
import { C1_UNITS } from './units/c1';
import { TOEFL_UNITS as TOEFL_TRACK } from './units/toefl';
import { WORD_LESSONS } from './units/words';

export interface LessonDef {
  id: string;
  unitId: string;
  title: string;
  blurb: string;
  skill: Skill;
  minutes: number;
  passages: Passage[];
  questions: Question[];
}

export interface UnitDef {
  id: string;
  /** Position in its path, counted from 1. */
  number: number;
  title: string;
  blurb: string;
  level: Level;
  accent: Accent;
  lessons: LessonDef[];
}

const numbered = (units: UnitDef[]): UnitDef[] => units.map((unit, index) => ({ ...unit, number: index + 1 }));

/** Every unit ends with its vocabulary lesson (units/words.ts). */
const withWords = (units: UnitDef[]): UnitDef[] =>
  units.map((unit) => (WORD_LESSONS[unit.id] ? { ...unit, lessons: [...unit.lessons, WORD_LESSONS[unit.id]] } : unit));

/** General English, A1 to C1, in order. */
export const UNITS: UnitDef[] = numbered(withWords([...A1_UNITS, ...A2_UNITS, ...B1_UNITS, ...B2_UNITS, ...C1_UNITS]));

/** The optional TOEFL warm-up track. */
export const TOEFL_UNITS: UnitDef[] = numbered(withWords(TOEFL_TRACK));
