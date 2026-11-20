// The achievements (2.0.0). Each one is worked out from what the learner already has: the streak and the XP on the
// profile, the lessons finished, the runs saved (flashcard sessions, writing checks and role-play conversations),
// and the decks and saved words. Nothing is stored for them, so they always agree with the history.
import { FLASHCARD_REF, isLessonOrTest, ROLEPLAY_REF_PREFIX, WRITING_REF } from './quests';
import type { AttemptRow, LessonProgressRow, ProfileRow } from './types';

export interface AchievementStats {
  streak: number;
  xp: number;
  lessonsDone: number;
  lessonsAndTests: number;
  flashcardsStudied: number;
  writingChecks: number;
  roleplays: number;
  decks: number;
  savedWords: number;
}

export const ACHIEVEMENT_IDS = [
  'first-steps',
  'on-a-roll',
  'unstoppable',
  'thousand-club',
  'lesson-master',
  'deck-builder',
  'card-shark',
  'careful-writer',
  'word-collector',
  'conversationalist',
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

/** What each achievement needs, and the number that counts toward it. */
const GOALS: Record<AchievementId, { need: number; value: (stats: AchievementStats) => number }> = {
  'first-steps': { need: 1, value: (stats) => stats.lessonsAndTests },
  'on-a-roll': { need: 7, value: (stats) => stats.streak },
  unstoppable: { need: 30, value: (stats) => stats.streak },
  'thousand-club': { need: 1000, value: (stats) => stats.xp },
  'lesson-master': { need: 25, value: (stats) => stats.lessonsDone },
  'deck-builder': { need: 1, value: (stats) => stats.decks },
  'card-shark': { need: 100, value: (stats) => stats.flashcardsStudied },
  'careful-writer': { need: 5, value: (stats) => stats.writingChecks },
  'word-collector': { need: 10, value: (stats) => stats.savedWords },
  conversationalist: { need: 3, value: (stats) => stats.roleplays },
};

export interface Achievement {
  id: AchievementId;
  need: number;
  /** The count so far, never more than the need. */
  value: number;
  unlocked: boolean;
}

export function achievementsOf(stats: AchievementStats): Achievement[] {
  return ACHIEVEMENT_IDS.map((id) => {
    const goal = GOALS[id];
    const current = Math.max(0, Math.floor(goal.value(stats)));
    return { id, need: goal.need, value: Math.min(current, goal.need), unlocked: current >= goal.need };
  });
}

/** The numbers the achievements count, from the profile, the lessons and the runs saved so far. */
export function statsOf(input: {
  profile: Pick<ProfileRow, 'streak' | 'xp'> | null;
  lessons: readonly LessonProgressRow[];
  runs: readonly AttemptRow[];
  decks: number;
  savedWords: number;
}): AchievementStats {
  let flashcardsStudied = 0;
  let writingChecks = 0;
  let roleplays = 0;
  let lessonsAndTests = 0;
  for (const run of input.runs) {
    if (run.ref_id === FLASHCARD_REF) flashcardsStudied += run.answers.length;
    else if (run.ref_id === WRITING_REF) writingChecks += 1;
    else if (run.ref_id.startsWith(ROLEPLAY_REF_PREFIX)) roleplays += 1;
    if (isLessonOrTest(run)) lessonsAndTests += 1;
  }
  return {
    streak: input.profile?.streak ?? 0,
    xp: input.profile?.xp ?? 0,
    lessonsDone: input.lessons.filter((row) => Boolean(row.completed_at)).length,
    lessonsAndTests,
    flashcardsStudied,
    writingChecks,
    roleplays,
    decks: input.decks,
    savedWords: input.savedWords,
  };
}
