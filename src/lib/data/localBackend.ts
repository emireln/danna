// Offline backend: everything stays in this device's local storage. Accounts,
// friends and sharing need the Supabase backend, so those calls explain that.
import type {
  AnnouncementRow,
  AttemptRow,
  FriendRow,
  LessonProgressRow,
  PersonRow,
  ProfileRow,
  ReviewRow,
  ShareRow,
  Skill,
  TestRow,
  TutorRow,
} from '../types';
import type { DataBackend, NewAttempt, NewTest, ProfilePatch, SharePayload } from './backend';

const STORE_KEY = 'danna.local.v1';
const SOCIAL_MESSAGE = 'Friends and sharing need an online account. Sign in with Supabase to connect with people.';

interface LocalStore {
  profile: ProfileRow | null;
  attempts: AttemptRow[];
  skills: Partial<Record<Skill, number>>;
  lessons: LessonProgressRow[];
  reviews: ReviewRow[];
  tests: TestRow[];
  tutor: TutorRow[];
}

const emptyStore = (): LocalStore => ({
  profile: null,
  attempts: [],
  skills: {},
  lessons: [],
  reviews: [],
  tests: [],
  tutor: [],
});

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
    throw new Error('This device is out of local storage space. Free some space and try again.');
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
    created_at: nowIso(),
  };
}

const SEED_ANNOUNCEMENTS: AnnouncementRow[] = [
  {
    id: 'seed-banner',
    kind: 'banner',
    title: 'Plan your TOEFL score one lesson at a time',
    body: 'Take the diagnostic, follow the roadmap and check your progress every day.',
    version: null,
    image_url: null,
    cta_label: 'Start the diagnostic',
    cta_url: '/play/diagnostic',
    accent: 'blue',
    priority: 10,
    created_at: '2026-11-01T09:00:00Z',
  },
  {
    id: 'seed-release-010',
    kind: 'release_note',
    title: 'danna 0.1.0',
    body: [
      '- Roadmap with six units, lesson checkpoints and stars',
      '- Diagnostic test with an estimated TOEFL score and skill report',
      '- Self Study by section, mini mock tests and quick practice',
      '- Connect OpenAI, Anthropic, Gemini or OpenRouter to generate new tests and get feedback',
    ].join('\n'),
    version: '0.1.0',
    image_url: null,
    cta_label: null,
    cta_url: null,
    accent: 'blue',
    priority: 0,
    created_at: '2026-11-10T09:00:00Z',
  },
];

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
          throw new Error('Usernames use 3–20 lowercase letters, numbers or underscores.');
        }
        store.profile = { ...current, ...patch };
        return { ...store.profile };
      });
    },

    async listAttempts(limit = 60) {
      return withStore((store) => store.attempts.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit));
    },

    async getAttempt(id: string) {
      return withStore((store) => store.attempts.find((attempt) => attempt.id === id) ?? null);
    },

    async insertAttempt(row: NewAttempt) {
      return withStore((store) => {
        const attempt: AttemptRow = { ...row, id: newId(), user_id: store.profile?.id ?? 'local', created_at: nowIso() };
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
        const test: TestRow = { ...row, id: newId(), owner_id: store.profile?.id ?? 'local', created_at: nowIso() };
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
      throw new Error(SOCIAL_MESSAGE);
    },

    async answerFriend() {
      throw new Error(SOCIAL_MESSAGE);
    },

    async listShares(): Promise<ShareRow[]> {
      return [];
    },

    async sendShare(_payload: SharePayload) {
      throw new Error(SOCIAL_MESSAGE);
    },

    async markSharesSeen() {},

    async listAnnouncements() {
      return SEED_ANNOUNCEMENTS.slice();
    },

    async listTutor(limit = 40) {
      return withStore((store) => store.tutor.slice(-limit));
    },

    async addTutor(role, content) {
      return withStore((store) => {
        const message: TutorRow = { id: newId(), role, content: content.slice(0, 8000), created_at: nowIso() };
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
