// Moves progress between this device and an account, in either direction.
// Nothing on the receiving side is lost: records are matched by id, numbers keep the higher
// value, and an existing picture or setup is kept. Running it twice changes nothing new.
import type { DataBackend } from './data/backend';
import type { LessonProgressRow, ReviewRow, Skill } from './types';

/** True when this side has anything worth copying. */
export async function hasLocalProgress(local: DataBackend): Promise<boolean> {
  const [profile, attempts, lessons, tests] = await Promise.all([
    local.getProfile(),
    local.listAttempts(1),
    local.listLessonProgress(),
    local.listMyTests(),
  ]);
  return Boolean(
    profile?.onboarding_done || profile?.avatar_updated_at || attempts.length > 0 || lessons.length > 0 || tests.length > 0,
  );
}

function later(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function earlier(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

export async function copyProgress(from: DataBackend, to: DataBackend): Promise<void> {
  const source = await from.getProfile();
  const target = await to.getProfile();

  if (source) {
    // The learning setup comes from the side that finished onboarding. An account that is already set up keeps its own.
    const setup = target && (target.onboarding_done || !source.onboarding_done) ? target : source;
    // A name the account owner chose stays. A name that is only the username (the sign-up default) does not count.
    const chosenName = target && target.display_name && target.display_name !== target.username ? target.display_name : '';
    const name = chosenName || (source.display_name && source.display_name !== 'Learner' ? source.display_name : target?.display_name || 'Learner');
    await to.updateProfile({
      display_name: name,
      avatar_color: setup.avatar_color,
      target_score: setup.target_score,
      exam_date: setup.exam_date,
      daily_minutes: setup.daily_minutes,
      level: setup.level,
      xp: Math.max(source.xp, target?.xp ?? 0),
      streak: Math.max(source.streak, target?.streak ?? 0),
      last_active: later(source.last_active, target?.last_active ?? null),
      onboarding_done: source.onboarding_done || Boolean(target?.onboarding_done),
    });

    // A picture comes across when the receiving side has none yet.
    if (source.avatar_updated_at && !target?.avatar_updated_at) {
      const picture = await from.getAvatar();
      if (picture) await to.setAvatar(picture);
    }
  }

  const ownAttempts = new Set((await to.listAttempts(500)).map((attempt) => attempt.id));
  for (const attempt of await from.listAttempts(500)) {
    if (ownAttempts.has(attempt.id)) continue;
    await to.insertAttempt({
      id: attempt.id,
      created_at: attempt.created_at,
      kind: attempt.kind,
      ref_id: attempt.ref_id,
      title: attempt.title,
      score_pct: attempt.score_pct,
      predicted: attempt.predicted,
      skills: attempt.skills,
      answers: attempt.answers,
      duration_s: attempt.duration_s,
    });
  }

  const ownSkills = await to.getSkillScores();
  const mergedSkills: Partial<Record<Skill, number>> = {};
  for (const [skill, score] of Object.entries(await from.getSkillScores()) as Array<[Skill, number]>) {
    mergedSkills[skill] = Math.max(score, ownSkills[skill] ?? 0);
  }
  if (Object.keys(mergedSkills).length > 0) await to.setSkillScores(mergedSkills);

  const ownLessons = new Map((await to.listLessonProgress()).map((row) => [row.lesson_id, row]));
  for (const row of await from.listLessonProgress()) {
    const own = ownLessons.get(row.lesson_id);
    if (!own) {
      await to.upsertLessonProgress(row);
      continue;
    }
    const merged: LessonProgressRow = {
      lesson_id: row.lesson_id,
      stars: Math.max(row.stars, own.stars),
      best_pct: Math.max(row.best_pct, own.best_pct),
      attempts: Math.max(row.attempts, own.attempts),
      completed_at: earlier(row.completed_at, own.completed_at),
    };
    if (
      merged.stars !== own.stars ||
      merged.best_pct !== own.best_pct ||
      merged.attempts !== own.attempts ||
      merged.completed_at !== own.completed_at
    ) {
      await to.upsertLessonProgress(merged);
    }
  }

  // Review items: the copy with more repetitions is the one that has been learned further.
  const ownReviews = new Map((await to.listReviewItems()).map((row) => [row.item_key, row]));
  const newerReviews: ReviewRow[] = [];
  for (const row of await from.listReviewItems()) {
    const own = ownReviews.get(row.item_key);
    if (!own || row.reps > own.reps) newerReviews.push(row);
  }
  await to.upsertReviewItems(newerReviews);

  const ownTests = new Set((await to.listMyTests()).map((test) => test.id));
  for (const test of await from.listMyTests()) {
    if (ownTests.has(test.id)) continue;
    await to.insertTest({
      id: test.id,
      created_at: test.created_at,
      title: test.title,
      description: test.description,
      kind: test.kind,
      skill: test.skill,
      level: test.level,
      minutes: test.minutes,
      content: test.content,
    });
  }

  // Coach conversation, in order, keeping each message's own id and time.
  const ownMessages = new Set((await to.listTutor(200)).map((message) => message.id));
  for (const message of await from.listTutor(200)) {
    if (ownMessages.has(message.id)) continue;
    await to.addTutor(message.role, message.content, { id: message.id, created_at: message.created_at });
  }
}
