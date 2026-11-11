// Moves progress between this device and an account. Items that already exist on the
// receiving side are left alone, so running it twice does not duplicate anything.
import type { DataBackend } from './data/backend';

export async function hasLocalProgress(local: DataBackend): Promise<boolean> {
  const [profile, attempts] = await Promise.all([local.getProfile(), local.listAttempts(1)]);
  return attempts.length > 0 || Boolean(profile?.onboarding_done);
}

export async function copyProgress(from: DataBackend, to: DataBackend): Promise<void> {
  const source = await from.getProfile();
  const target = await to.getProfile();

  if (source) {
    await to.updateProfile({
      display_name: source.display_name || target?.display_name || 'Learner',
      avatar_color: source.avatar_color,
      target_score: source.target_score,
      exam_date: source.exam_date,
      daily_minutes: source.daily_minutes,
      level: source.level,
      xp: Math.max(source.xp, target?.xp ?? 0),
      streak: Math.max(source.streak, target?.streak ?? 0),
      last_active: source.last_active ?? target?.last_active ?? null,
      onboarding_done: source.onboarding_done || Boolean(target?.onboarding_done),
    });
  }

  const existingAttempts = new Set((await to.listAttempts(500)).map((attempt) => attempt.id));
  for (const attempt of await from.listAttempts(500)) {
    if (existingAttempts.has(attempt.id)) continue;
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

  await to.setSkillScores(await from.getSkillScores());

  for (const row of await from.listLessonProgress()) {
    await to.upsertLessonProgress(row);
  }

  await to.upsertReviewItems(await from.listReviewItems());

  for (const test of await from.listMyTests()) {
    if (await to.getTest(test.id)) continue;
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
}
