// The overall report: how the learner's skills, sessions and lessons add up across the app. Plain functions, so the
// rules are tested without the screen.
import type { SkillMap } from './scoring';
import { SKILLS, type AttemptRow, type LessonProgressRow, type Skill } from './types';

/** A skill at or above this score is a strength. */
export const STRONG_FROM = 70;
/** A skill below this score, or not practised yet, is a weakness to work on. */
export const WEAK_BELOW = 60;
/** How many strengths and weaknesses the report names. */
export const REPORT_LIST_SIZE = 2;

export interface SkillLine {
  skill: Skill;
  /** The newest score in the skill, rounded, or null when the skill has not been practised yet. */
  score: number | null;
}

export interface OverallReport {
  /** All five skills, in the order the app shows them. */
  skills: SkillLine[];
  /** The best skills, best first. */
  strengths: SkillLine[];
  /** The weakest skills first: the ones not practised yet come first. */
  weaknesses: SkillLine[];
  sessions: number;
  practiceMinutes: number;
  /** The average score of the sessions, or null when there are none. */
  averageScore: number | null;
  lessonsDone: number;
  stars: number;
}

export function overallReport(input: {
  skills: SkillMap;
  attempts: Pick<AttemptRow, 'score_pct' | 'duration_s'>[];
  lessons: Pick<LessonProgressRow, 'stars'>[];
}): OverallReport {
  const skills: SkillLine[] = SKILLS.map((skill) => {
    const value = input.skills[skill];
    return { skill, score: typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null };
  });
  const strengths = skills
    .filter((line) => line.score !== null && line.score >= STRONG_FROM)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, REPORT_LIST_SIZE);
  const weaknesses = skills
    .filter((line) => line.score === null || line.score < WEAK_BELOW)
    .sort((a, b) => (a.score ?? -1) - (b.score ?? -1))
    .slice(0, REPORT_LIST_SIZE);
  const totalSeconds = input.attempts.reduce((sum, attempt) => sum + (attempt.duration_s || 0), 0);
  const scored = input.attempts.filter((attempt) => Number.isFinite(attempt.score_pct));
  const averageScore = scored.length
    ? Math.round(scored.reduce((sum, attempt) => sum + attempt.score_pct, 0) / scored.length)
    : null;
  return {
    skills,
    strengths,
    weaknesses,
    sessions: input.attempts.length,
    practiceMinutes: Math.round(totalSeconds / 60),
    averageScore,
    lessonsDone: input.lessons.filter((lesson) => lesson.stars > 0).length,
    stars: input.lessons.reduce((sum, lesson) => sum + lesson.stars, 0),
  };
}
