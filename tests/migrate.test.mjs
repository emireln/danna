// Tests the progress copy rules (src/lib/migrate.ts) with in-memory stand-ins for the two sides.
// Run with: npm run test:sync
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyProgress, hasLocalProgress } from '../src/lib/migrate.ts';

const NOW = '2026-11-10T10:00:00.000Z';

function profileRow(overrides = {}) {
  return {
    id: 'p1',
    username: 'learner',
    display_name: 'Learner',
    avatar_color: '#2f6bff',
    target_score: 100,
    exam_date: null,
    daily_minutes: 15,
    level: 'B1',
    xp: 0,
    streak: 0,
    last_active: null,
    onboarding_done: false,
    avatar_path: null,
    avatar_updated_at: null,
    created_at: NOW,
    ...overrides,
  };
}

// Implements the parts of DataBackend that the copy uses. Behaves like the real backends:
// a record with an existing id is not inserted twice.
function memory(seed = {}) {
  const store = {
    profile: profileRow(seed.profile),
    attempts: seed.attempts ?? [],
    skills: seed.skills ?? {},
    lessons: seed.lessons ?? [],
    reviews: seed.reviews ?? [],
    tests: seed.tests ?? [],
    tutor: seed.tutor ?? [],
    picture: seed.picture ?? null,
  };
  return {
    store,
    mode: 'local',
    async getProfile() {
      return { ...store.profile };
    },
    async updateProfile(patch) {
      store.profile = { ...store.profile, ...patch };
      return { ...store.profile };
    },
    async getAvatar() {
      return store.picture;
    },
    async setAvatar(picture) {
      store.picture = picture;
      store.profile = { ...store.profile, avatar_updated_at: picture ? NOW : null };
      return { ...store.profile };
    },
    async fetchAvatar() {
      return null;
    },
    async listAttempts(limit = 60) {
      return store.attempts.slice(0, limit).map((row) => ({ ...row }));
    },
    async insertAttempt(row) {
      if (!store.attempts.some((item) => item.id === row.id)) {
        store.attempts.push({ user_id: store.profile.id, created_at: NOW, ...row });
      }
      return store.attempts.find((item) => item.id === row.id);
    },
    async getSkillScores() {
      return { ...store.skills };
    },
    async setSkillScores(scores) {
      store.skills = { ...store.skills, ...scores };
    },
    async listLessonProgress() {
      return store.lessons.map((row) => ({ ...row }));
    },
    async upsertLessonProgress(row) {
      store.lessons = [...store.lessons.filter((item) => item.lesson_id !== row.lesson_id), { ...row }];
    },
    async listReviewItems() {
      return store.reviews.map((row) => ({ ...row }));
    },
    async upsertReviewItems(rows) {
      if (rows.length === 0) return;
      const keys = new Set(rows.map((row) => row.item_key));
      store.reviews = [...store.reviews.filter((row) => !keys.has(row.item_key)), ...rows.map((row) => ({ ...row }))];
    },
    async listMyTests() {
      return store.tests.map((row) => ({ ...row }));
    },
    async insertTest(row) {
      if (!store.tests.some((item) => item.id === row.id)) {
        store.tests.push({ owner_id: store.profile.id, created_at: NOW, ...row });
      }
      return store.tests.find((item) => item.id === row.id);
    },
    async listTutor(limit = 40) {
      return store.tutor.slice(-limit).map((row) => ({ ...row }));
    },
    async addTutor(role, content, record) {
      const row = { id: record?.id ?? `m${store.tutor.length + 1}`, role, content, created_at: record?.created_at ?? NOW };
      store.tutor.push(row);
      return row;
    },
  };
}

function deviceWithProgress() {
  return memory({
    profile: {
      onboarding_done: true,
      target_score: 90,
      daily_minutes: 20,
      level: 'B2',
      xp: 120,
      streak: 4,
      last_active: '2026-11-09',
      display_name: 'Maya',
      avatar_color: '#13b5a4',
      avatar_updated_at: NOW,
    },
    attempts: [
      {
        id: 'a1',
        kind: 'diagnostic',
        ref_id: '',
        title: 'Diagnostic',
        score_pct: 70,
        predicted: 84,
        skills: { reading: 70 },
        answers: [],
        duration_s: 900,
        created_at: '2026-11-08T09:00:00.000Z',
      },
    ],
    skills: { reading: 70, listening: 55 },
    lessons: [{ lesson_id: 'u1-l1', stars: 2, best_pct: 90, attempts: 3, completed_at: '2026-11-08T09:30:00.000Z' }],
    reviews: [{ item_key: 'r1', skill: 'reading', payload: { question: { id: 'q' } }, ease: 2.5, interval_days: 1, reps: 5, due_at: NOW }],
    tests: [{ id: 't1', title: 'My set', description: '', kind: 'ai', skill: 'reading', level: 'B1', minutes: 10, content: { passages: [], questions: [] } }],
    tutor: [{ id: 'm1', role: 'user', content: 'Hello', created_at: '2026-11-08T09:10:00.000Z' }],
    picture: new Blob(['device-picture'], { type: 'image/webp' }),
  });
}

test('an empty account receives everything, and a second copy adds nothing', async () => {
  const device = deviceWithProgress();
  const account = memory({ profile: { id: 'p2', username: 'maya_k', display_name: 'maya_k' } });

  await copyProgress(device, account);
  await copyProgress(device, account);

  assert.equal(account.store.attempts.length, 1);
  assert.equal(account.store.tests.length, 1);
  assert.equal(account.store.reviews.length, 1);
  assert.equal(account.store.tutor.length, 1);
  assert.equal(account.store.tutor[0].id, 'm1', 'coach messages keep their ids');
  assert.equal(account.store.tutor[0].created_at, '2026-11-08T09:10:00.000Z', 'and their times');
  assert.equal(account.store.lessons[0].stars, 2);
  assert.equal(account.store.skills.listening, 55);
  assert.equal(account.store.profile.onboarding_done, true);
  assert.equal(account.store.profile.target_score, 90, 'an unfinished account takes the device setup');
  assert.equal(account.store.profile.xp, 120);
  assert.equal(account.store.profile.display_name, 'Maya');
  assert.ok(account.store.picture, 'the picture comes across when the account has none');
});

test('an account that already has data keeps its own setup, name, picture and higher numbers', async () => {
  const device = deviceWithProgress();
  const accountPicture = new Blob(['account-picture'], { type: 'image/webp' });
  const account = memory({
    profile: {
      id: 'p3',
      username: 'maya_k',
      display_name: 'Maya K',
      onboarding_done: true,
      target_score: 110,
      xp: 300,
      streak: 9,
      avatar_updated_at: NOW,
    },
    lessons: [{ lesson_id: 'u1-l1', stars: 3, best_pct: 80, attempts: 1, completed_at: '2026-11-07T08:00:00.000Z' }],
    skills: { reading: 90 },
    reviews: [{ item_key: 'r1', skill: 'reading', payload: {}, ease: 2.5, interval_days: 3, reps: 2, due_at: NOW }],
    picture: accountPicture,
  });

  await copyProgress(device, account);

  assert.equal(account.store.profile.target_score, 110, 'the finished setup of the account stays');
  assert.equal(account.store.profile.display_name, 'Maya K', 'a chosen name stays');
  assert.equal(account.store.profile.xp, 300, 'XP never goes down');
  assert.equal(account.store.profile.streak, 9);
  assert.equal(account.store.picture, accountPicture, 'the account keeps its own picture');
  assert.equal(account.store.lessons[0].stars, 3, 'stars keep the higher value');
  assert.equal(account.store.lessons[0].best_pct, 90, 'best score keeps the higher value');
  assert.equal(account.store.lessons[0].attempts, 3);
  assert.equal(account.store.lessons[0].completed_at, '2026-11-07T08:00:00.000Z', 'the first completion is kept');
  assert.equal(account.store.skills.reading, 90);
  assert.equal(account.store.reviews[0].reps, 5, 'the review item learned further wins');
});

test('a device with nothing to copy is recognised, and a picture alone counts as progress', async () => {
  assert.equal(await hasLocalProgress(memory()), false);
  assert.equal(await hasLocalProgress(deviceWithProgress()), true);

  const pictureOnly = memory({ profile: { avatar_updated_at: NOW }, picture: new Blob(['x'], { type: 'image/webp' }) });
  assert.equal(await hasLocalProgress(pictureOnly), true);
});
