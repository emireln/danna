// Offline data in the browser preview only (the desktop app uses the SQLite file).
// Same behaviour, kept in this browser's storage.
import { LOCAL_ANNOUNCEMENTS } from '../../content/announcements';
import type { AttemptRow, FriendRow, LessonProgressRow, PersonRow, ProfileRow, ReviewRow, ShareRow, Skill, TestRow, TutorRow } from '../types';
import type { DataBackend, NewAttempt, NewTest, ProfilePatch, SharePayload } from './backend';

const STORE_KEY = 'danna.local.v1';
const ONLINE_ONLY = 'This is available with an online account.';

interface LocalStore {
  profile: ProfileRow | null;
  attempts: AttemptRow[];
  skills: Partial<Record<Skill, number>>;
  lessons: LessonProgressRow[];
  reviews: ReviewRow[];
  tests: TestRow[];
  tutor: TutorRow[];
  /** The profile picture as a WebP data URL, or null. */
  avatar?: { dataUrl: string } | null;
}

const emptyStore = (): LocalStore => ({
  profile: null,
  attempts: [],
  skills: {},
  lessons: [],
  reviews: [],
  tests: [],
  tutor: [],
  avatar: null,
});

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('This picture could not be saved on this device.'));
    reader.readAsDataURL(blob);
  });
}

function read(): LocalStore {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? { ...emptyStore(), ...(JSON.parse(raw) as Partial<LocalStore>) } : emptyStore();
  } catch {
    return emptyStore();
  }
}

function write(store: LocalStore): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    throw new Error('Not enough space on this device. Free some space and try again.');
  }
}

const nowIso = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

function defaultProfile(): ProfileRow {
  return {
    id: newId(),
    username: `learner${Math.floor(1000 + Math.random() * 9000)}`,
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
    created_at: nowIso(),
  };
}

export function createLocalBackend(): DataBackend {
  const withStore = <T>(fn: (store: LocalStore) => T): T => {
    const store = read();
    const result = fn(store);
    write(store);
    return result;
  };

  return {
    mode: 'local',

    async getProfile() {
      return withStore((store) => {
        if (!store.profile) store.profile = defaultProfile();
        return { ...store.profile };
      });
    },

    async updateProfile(patch: ProfilePatch) {
      return withStore((store) => {
        const current = store.profile ?? defaultProfile();
        if (patch.username !== undefined && !/^[a-z0-9_]{3,20}$/.test(patch.username)) {
          throw new Error('Usernames use 3 to 20 lowercase letters, numbers or underscores.');
        }
        store.profile = { ...current, ...patch };
        return { ...store.profile };
      });
    },

    async getAvatar() {
      const dataUrl = read().avatar?.dataUrl;
      if (!dataUrl) return null;
      return (await fetch(dataUrl)).blob();
    },

    async setAvatar(picture: Blob | null) {
      const dataUrl = picture ? await blobToDataUrl(picture) : null;
      return withStore((store) => {
        const current = store.profile ?? defaultProfile();
        store.avatar = dataUrl ? { dataUrl } : null;
        store.profile = { ...current, avatar_updated_at: dataUrl ? nowIso() : null };
        return { ...store.profile };
      });
    },

    async fetchAvatar() {
      return null;
    },

    async listAttempts(limit = 60) {
      return withStore((store) =>
        store.attempts
          .slice()
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, limit),
      );
    },

    async getAttempt(id: string) {
      return withStore((store) => store.attempts.find((attempt) => attempt.id === id) ?? null);
    },

    async insertAttempt(row: NewAttempt) {
      return withStore((store) => {
        const existing = row.id ? store.attempts.find((attempt) => attempt.id === row.id) : undefined;
        if (existing) return existing;
        const attempt: AttemptRow = {
          ...row,
          id: row.id ?? newId(),
          user_id: store.profile?.id ?? 'local',
          created_at: row.created_at ?? nowIso(),
        };
        store.attempts = [attempt, ...store.attempts].slice(0, 300);
        return attempt;
      });
    },

    async getSkillScores() {
      return withStore((store) => ({ ...store.skills }));
    },

    async setSkillScores(scores) {
      withStore((store) => {
        store.skills = { ...store.skills, ...scores };
      });
    },

    async listLessonProgress() {
      return withStore((store) => store.lessons.slice());
    },

    async upsertLessonProgress(row) {
      withStore((store) => {
        store.lessons = [...store.lessons.filter((item) => item.lesson_id !== row.lesson_id), row];
      });
    },

    async listReviewItems() {
      return withStore((store) => store.reviews.slice());
    },

    async upsertReviewItems(rows) {
      withStore((store) => {
        const keys = new Set(rows.map((row) => row.item_key));
        store.reviews = [...store.reviews.filter((item) => !keys.has(item.item_key)), ...rows];
      });
    },

    async listMyTests() {
      return withStore((store) => store.tests.slice());
    },

    async getTest(id: string) {
      return withStore((store) => store.tests.find((test) => test.id === id) ?? null);
    },

    async insertTest(row: NewTest) {
      return withStore((store) => {
        const existing = row.id ? store.tests.find((test) => test.id === row.id) : undefined;
        if (existing) return existing;
        const test: TestRow = {
          ...row,
          id: row.id ?? newId(),
          owner_id: store.profile?.id ?? 'local',
          created_at: row.created_at ?? nowIso(),
        };
        store.tests = [test, ...store.tests];
        return test;
      });
    },

    async listFriends(): Promise<FriendRow[]> {
      return [];
    },

    async searchPeople(): Promise<PersonRow[]> {
      return [];
    },

    async requestFriend() {
      throw new Error(ONLINE_ONLY);
    },

    async answerFriend() {
      throw new Error(ONLINE_ONLY);
    },

    async listShares(): Promise<ShareRow[]> {
      return [];
    },

    async sendShare(_payload: SharePayload) {
      throw new Error(ONLINE_ONLY);
    },

    async markSharesSeen() {},

    async listAnnouncements() {
      return LOCAL_ANNOUNCEMENTS.slice();
    },

    async listTutor(limit = 40) {
      return withStore((store) => store.tutor.slice(-limit));
    },

    async addTutor(role, content, record) {
      return withStore((store) => {
        const message: TutorRow = {
          id: record?.id ?? newId(),
          role,
          content: content.slice(0, 8000),
          created_at: record?.created_at ?? nowIso(),
        };
        store.tutor = [...store.tutor, message].slice(-200);
        return message;
      });
    },

    async clearTutor() {
      withStore((store) => {
        store.tutor = [];
      });
    },
  };
}
