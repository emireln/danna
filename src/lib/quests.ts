// The daily goal and the daily quests (2.0.0). Everything comes from the runs saved today, on this device or in the
// account, so the numbers match the history. Quests give no XP: the weekly league counts practice only.
import { localDate } from './progress';
import type { AttemptRow } from './types';

export const QUEST_LESSON_TARGET = 1;
export const QUEST_FLASHCARD_TARGET = 10;
export const QUEST_MINUTES_TARGET = 5;

/** A flashcard session is saved as a run with this reference. Each card graded is one answer. */
export const FLASHCARD_REF = 'flashcards';
/** A writing check is saved as a run with this reference. */
export const WRITING_REF = 'writing-check';
/** A role-play conversation is saved as a run whose reference starts with this. */
export const ROLEPLAY_REF_PREFIX = 'roleplay-';

/** A lesson or a test: a run that is not a review, a flashcard session, a writing check or a role-play. */
export function isLessonOrTest(attempt: AttemptRow): boolean {
  if (attempt.kind === 'review') return false;
  return attempt.ref_id !== FLASHCARD_REF && attempt.ref_id !== WRITING_REF && !attempt.ref_id.startsWith(ROLEPLAY_REF_PREFIX);
}

export interface DayActivity {
  /** Lessons and tests finished on the day. */
  lessonsAndTests: number;
  /** Flashcards graded on the day, one per card. */
  flashcards: number;
  /** Whole minutes practised on the day. */
  minutes: number;
}

/** What the learner did on one local day, given the runs saved so far. */
export function dayActivity(attempts: readonly AttemptRow[], day: string): DayActivity {
  let lessonsAndTests = 0;
  let flashcards = 0;
  let seconds = 0;
  for (const attempt of attempts) {
    if (localDate(new Date(attempt.created_at)) !== day) continue;
    seconds += Math.max(0, attempt.duration_s);
    if (attempt.ref_id === FLASHCARD_REF) flashcards += attempt.answers.length;
    else if (isLessonOrTest(attempt)) lessonsAndTests += 1;
  }
  return { lessonsAndTests, flashcards, minutes: Math.floor(seconds / 60) };
}

export type QuestId = 'lesson' | 'flashcards' | 'minutes';

export interface Quest {
  id: QuestId;
  target: number;
  /** Never more than the target. */
  progress: number;
  done: boolean;
}

function quest(id: QuestId, target: number, value: number): Quest {
  const progress = Math.min(target, Math.max(0, Math.floor(value)));
  return { id, target, progress, done: progress >= target };
}

/** The three daily quests, in the order the screen shows them. */
export function questsOf(activity: DayActivity): Quest[] {
  return [
    quest('lesson', QUEST_LESSON_TARGET, activity.lessonsAndTests),
    quest('flashcards', QUEST_FLASHCARD_TARGET, activity.flashcards),
    quest('minutes', QUEST_MINUTES_TARGET, activity.minutes),
  ];
}

/** The daily goal in minutes: the share reached (at most 100) and whether it is reached. A goal under one minute counts as one. */
export function goalOf(minutes: number, goal: number): { percent: number; done: boolean } {
  const target = Math.max(1, Math.round(goal));
  return {
    percent: Math.min(100, Math.max(0, Math.round((minutes / target) * 100))),
    done: minutes >= target,
  };
}
