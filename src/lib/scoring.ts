// Scores, TOEFL estimate and study plan. The estimate is a transparent
// approximation for practice, not an official ETS score.
import { SKILLS, SKILL_LABEL, type AnswerRecord, type Level, type Skill } from './types';

export type SkillMap = Partial<Record<Skill, number>>;

export function skillPercents(answers: AnswerRecord[]): SkillMap {
  const out: SkillMap = {};
  for (const skill of SKILLS) {
    const items = answers.filter((answer) => answer.skill === skill);
    if (items.length) {
      out[skill] = Math.round((items.reduce((sum, item) => sum + item.fraction, 0) / items.length) * 100);
    }
  }
  return out;
}

/** Equal weight per skill, so a short speaking task counts as much as the reading set. */
export function overallPercent(skills: SkillMap): number {
  const values = SKILLS.map((skill) => skills[skill]).filter((value): value is number => typeof value === 'number');
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export function toeflEstimate(percent: number): number {
  return Math.max(0, Math.min(120, Math.round(percent * 1.2)));
}

export function toeflRange(estimate: number): [number, number] {
  return [Math.max(0, estimate - 8), Math.min(120, estimate + 8)];
}

export function bandFor(percent: number): Level {
  if (percent < 20) return 'A1';
  if (percent < 35) return 'A2';
  if (percent < 60) return 'B1';
  if (percent < 78) return 'B2';
  return 'C1';
}

export function toneFor(score: number): 'excellent' | 'good' | 'needs-work' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  return 'needs-work';
}

export const TONE_LABEL = { excellent: 'Excellent', good: 'Good', 'needs-work': 'Needs work' } as const;

export function starsFor(percent: number): number {
  if (percent >= 100) return 3;
  if (percent >= 80) return 2;
  if (percent >= 50) return 1;
  return 0;
}

export interface PlanSlice {
  key: string;
  label: string;
  percent: number;
}

/** Spends more of the daily time on weaker skills. Shows the top three plus "Other". */
export function studyPlan(skills: SkillMap): PlanSlice[] {
  const weights = SKILLS.map((skill) => ({ skill, weight: 108 - (skills[skill] ?? 0) }));
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  const ranked = weights
    .map((item) => ({
      key: item.skill,
      label: SKILL_LABEL[item.skill],
      percent: Math.round((item.weight / total) * 100),
    }))
    .sort((a, b) => b.percent - a.percent);
  const top = ranked.slice(0, 3);
  const other = 100 - top.reduce((sum, item) => sum + item.percent, 0);
  return [...top, { key: 'other', label: 'Other', percent: other }];
}

export const XP = { correct: 10, attempt: 2, lesson: 20, checkpoint: 40, diagnostic: 50, review: 5 } as const;
