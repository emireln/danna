// Spaced repetition for missed questions. A small SM-2 style scheduler.
import type { Question, ReviewPayload, ReviewRow, Skill } from './types';

const MINUTE = 60_000;
const DAY = 86_400_000;

export function newReviewItem(key: string, skill: Skill, payload: ReviewPayload, now = new Date()): ReviewRow {
  return {
    item_key: key,
    skill,
    payload,
    ease: 2.5,
    interval_days: 0,
    reps: 0,
    due_at: new Date(now.getTime() + 10 * MINUTE).toISOString(),
  };
}

/** Quality 4 for a correct answer, 1 for a miss. A miss returns the item in ten minutes. */
export function scheduleReview(row: ReviewRow, correct: boolean, now = new Date()): ReviewRow {
  const quality = correct ? 4 : 1;
  let ease = row.ease;
  let reps = row.reps;
  let interval = row.interval_days;
  let due: Date;

  if (quality < 3) {
    reps = 0;
    interval = 0;
    due = new Date(now.getTime() + 10 * MINUTE);
  } else {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.max(1, Math.round(interval * ease));
    ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    due = new Date(now.getTime() + interval * DAY);
  }

  return {
    ...row,
    ease: Math.round(ease * 100) / 100,
    interval_days: interval,
    reps,
    due_at: due.toISOString(),
  };
}

export function isReviewable(question: Question): boolean {
  return question.type !== 'writing' && question.type !== 'speaking';
}
