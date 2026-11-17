// The rules of the exam page: the skills an exam asks for, the newest score in each skill, and how the exam's date
// reads. Plain functions, so the rules are tested without the screen.
import { getLocale } from './i18n';
import { SKILLS, type AttemptRow, type Skill } from './types';

// A TOEFL sitting tests these four. General English practises language too.
const TOEFL_SKILLS: readonly Skill[] = ['reading', 'listening', 'speaking', 'writing'];

/** The skills the exam asks for, in the order the page shows them. */
export function examSkills(toefl: boolean): Skill[] {
  return toefl ? [...TOEFL_SKILLS] : [...SKILLS];
}

/** The newest score the learner has in a skill. The attempts come newest first. Null when none has that skill. */
export function latestSkillScore(attempts: readonly AttemptRow[], skill: Skill): number | null {
  for (const attempt of attempts) {
    const score = attempt.skills?.[skill];
    if (typeof score === 'number' && Number.isFinite(score)) return Math.round(score);
  }
  return null;
}

/** The exam date the app shows: none while the learner has paused the exam. The date itself is kept. */
export function activeExamDate(profile: { exam_date: string | null; exam_paused?: boolean } | null | undefined): string | null {
  if (!profile || profile.exam_paused) return null;
  return profile.exam_date;
}

/** The exam's date written out in the app's language. It is read as a local day, so the date never shifts. */
export function examDateText(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(getLocale(), { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(year, month - 1, day),
  );
}
