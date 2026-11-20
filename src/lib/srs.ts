// Spaced repetition for missed questions. A small SM-2 style scheduler.
import type { CardState, Question, ReviewPayload, ReviewRow, Skill } from './types';

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

/**
 * A short line that tells the person which question is waiting: the prompt, or the sentence with its gaps
 * shown, without giving the answer away. A broken item still gives a line.
 */
export function questionPreview(question: Question | undefined | null): string {
  if (!question || typeof question !== 'object') return 'Review question';
  if (question.type === 'cloze' && typeof question.text === 'string') {
    const gapped = question.text.replace(/\{\{[^{}]+\}\}/g, '___').replace(/\s+/g, ' ').trim();
    return gapped.length > 140 ? `${gapped.slice(0, 137)}…` : gapped;
  }
  if (question.type === 'reorder') return 'Put the words of this sentence in the right order.';
  const prompt = typeof question.prompt === 'string' ? question.prompt.trim() : '';
  return prompt || 'Review question';
}

// Flashcards (2.0.0): the four grades of a card, and the interval each one sets. The same scheduler family as the
// review above, simplified and documented in docs/v2/PLAN.md (F7). The rules are tested in tests/v2-decks.test.mjs.
export type Grade = 'again' | 'hard' | 'good' | 'easy';
export const GRADES: readonly Grade[] = ['again', 'hard', 'good', 'easy'];

export interface CardSchedule {
  state: CardState;
  ease: number;
  interval_days: number;
  reps: number;
  lapses: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The review state after one grade. A card is new or learning until it is first kept; a good answer or better
 * moves it to review. Again returns it in ten minutes. A card in review that is missed loses ease and half its
 * interval, and counts one lapse. Ease stays between 1.3 and 4, and an interval never passes 100 years.
 */
export function gradeCard(card: CardSchedule, grade: Grade, now: Date): CardSchedule & { due_at: string; last_review_at: string } {
  let { state, ease, interval_days: interval, reps, lapses } = card;
  let dueMs: number;
  if (grade === 'again') {
    lapses = state === 'review' ? lapses + 1 : lapses;
    ease = Math.max(1.3, round2(ease - 0.2));
    interval = state === 'review' ? Math.max(1, Math.round(interval * 0.5)) : 0;
    state = 'learning';
    reps = 0;
    dueMs = 10 * MINUTE;
  } else if (grade === 'hard') {
    ease = Math.max(1.3, round2(ease - 0.15));
    interval = state === 'review' ? Math.max(1, Math.round(interval * 1.2)) : 1;
    state = 'review';
    reps += 1;
    dueMs = interval * DAY;
  } else if (grade === 'good') {
    interval = state === 'review' ? Math.max(1, Math.round(interval * ease)) : 1;
    state = 'review';
    reps += 1;
    dueMs = interval * DAY;
  } else {
    ease = Math.min(4, round2(ease + 0.15));
    interval = state === 'review' ? Math.max(interval + 1, Math.round(interval * ease * 1.3)) : 4;
    state = 'review';
    reps += 1;
    dueMs = interval * DAY;
  }
  interval = Math.min(36500, interval);
  return {
    state,
    ease,
    interval_days: interval,
    reps,
    lapses,
    due_at: new Date(now.getTime() + dueMs).toISOString(),
    last_review_at: now.toISOString(),
  };
}

/** How long each grade would wait before the card returns, in milliseconds, in the order again, hard, good, easy. */
export function gradeWaits(card: CardSchedule, now: Date): Record<Grade, number> {
  const out = {} as Record<Grade, number>;
  for (const grade of GRADES) out[grade] = new Date(gradeCard(card, grade, now).due_at).getTime() - now.getTime();
  return out;
}
