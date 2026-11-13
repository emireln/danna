// Offline data in the browser preview only (the desktop app uses the SQLite file). The rules are the same as
// the desktop database (see ./rules.ts), so the preview and the app give the same answers.
import { LOCAL_ANNOUNCEMENTS } from '../../content/announcements';
import { userError } from '../bridge';
import type { AttemptKind, AttemptRow, FriendRow, LessonProgressRow, LibraryLinkRow, PersonRow, ProfileRow, ReviewRow, ShareRow, Skill, TestRow, TutorChatRow, TutorRow } from '../types';
import type { DataBackend, LibraryLinkPatch, NewAttempt, NewLibraryLink, NewTest, ProfilePatch, SharePayload } from './backend';
import {
  ATTEMPT_KINDS,
  AVATAR_MAX_BYTES,
  cleanAttempt,
  cleanLessonRow,
  cleanLibraryLink,
  cleanProfilePatch,
  cleanReviewRow,
  cleanSkills,
  cleanTestInput,
  cleanAttachments,
  cleanChatTitle,
  cleanTutorRole,
  clampNumber,
  isWebpBytes,
  isoTime,
  MAX_CHATS,
} from './rules';

const STORE_KEY = 'danna.local.v1';
const ONLINE_ONLY = 'This is available with an online account.';
// The browser keeps its copy in a small store, so only the newest items are kept here. The app keeps them all.
const MAX_ATTEMPTS = 300;
const MAX_TUTOR = 1000;

interface LocalStore {
  profile: ProfileRow | null;
  attempts: AttemptRow[];
  skills: Partial<Record<Skill, number>>;
  lessons: LessonProgressRow[];
  reviews: ReviewRow[];
  tests: TestRow[];
  tutor: TutorRow[];
  tutorChats: TutorChatRow[];
  /** The profile picture as a WebP data URL, or null. */
  avatar?: { dataUrl: string } | null;
  libraryLinks?: LibraryLinkRow[];
}

const emptyStore = (): LocalStore => ({
  profile: null,
  attempts: [],
  skills: {},
  lessons: [],
  reviews: [],
  tests: [],
  tutor: [],
  tutorChats: [],
  avatar: null,
});

function read(): LocalStore {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? upgradeChats({ ...emptyStore(), ...(JSON.parse(raw) as Partial<LocalStore>) }) : emptyStore();
  } catch {
    return emptyStore();
  }
}

/** Messages kept before chats existed go into one chat, so nothing is lost. */
function upgradeChats(store: LocalStore): LocalStore {
  store.tutorChats = Array.isArray(store.tutorChats) ? store.tutorChats : [];
  const orphans = (Array.isArray(store.tutor) ? store.tutor : []).filter((message) => !message.chat_id);
  if (orphans.length > 0) {
    const times = orphans.map((message) => message.created_at).sort();
    const chat: TutorChatRow = { id: crypto.randomUUID(), title: null, archived: false, created_at: times[0], updated_at: times[times.length - 1] };
    store.tutorChats = [...store.tutorChats, chat];
    store.tutor = store.tutor.map((message) => ({ ...message, chat_id: message.chat_id ?? chat.id, attachments: message.attachments ?? [] }));
  }
  store.tutor = (store.tutor ?? []).map((message) => ({ ...message, attachments: message.attachments ?? [] }));
  return store;
}

function findChat(store: LocalStore, id: string): TutorChatRow {
  const chat = store.tutorChats.find((item) => item.id === id);
  if (!chat) throw userError('This chat could not be found.');
  return chat;
}

function write(store: LocalStore): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    throw userError('Not enough space on this device. Free some space and try again.');
  }
}

const nowIso = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function defaultProfile(): ProfileRow {
  return {
    id: newId(),
    username: `learner${Math.floor(1000 + Math.random() * 9000)}`,
    display_name: 'Learner',
    avatar_color: '#2f6bff',
    goal: 'english',
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
        store.profile = { ...current, ...cleanProfilePatch(current, patch) };
        return { ...store.profile };
      });
    },

    async getAvatar() {
      const dataUrl = read().avatar?.dataUrl;
      if (!dataUrl) return null;
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      return new Blob([Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))], { type: 'image/webp' });
    },

    async setAvatar(picture: Blob | null) {
      if (!picture) {
        return withStore((store) => {
          const current = store.profile ?? defaultProfile();
          store.avatar = null;
          store.profile = { ...current, avatar_updated_at: null };
          return { ...store.profile };
        });
      }
      const bytes = new Uint8Array(await picture.arrayBuffer());
      if (bytes.length === 0 || bytes.length > AVATAR_MAX_BYTES) throw userError('That picture is too large. Choose a smaller one.');
      if (!isWebpBytes(bytes)) throw userError('That picture could not be saved. Try another one.');
      const dataUrl = `data:image/webp;base64,${bytesToBase64(bytes)}`;
      return withStore((store) => {
        const current = store.profile ?? defaultProfile();
        store.avatar = { dataUrl };
        store.profile = { ...current, avatar_updated_at: nowIso() };
        return { ...store.profile };
      });
    },

    async fetchAvatar() {
      return null;
    },

    async listAttempts(limit = 60, kind?: AttemptKind) {
      return withStore((store) => {
        const filter = kind && ATTEMPT_KINDS.includes(kind) ? kind : null;
        return store.attempts
          .filter((attempt) => filter === null || attempt.kind === filter)
          .slice()
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, clampNumber(limit, 1, 500, 60));
      });
    },

    async countAttempts(kind: AttemptKind) {
      return withStore((store) => (ATTEMPT_KINDS.includes(kind) ? store.attempts.filter((attempt) => attempt.kind === kind).length : 0));
    },

    async getAttempt(id: string) {
      return withStore((store) => store.attempts.find((attempt) => attempt.id === id) ?? null);
    },

    async insertAttempt(row: NewAttempt) {
      return withStore((store) => {
        const existing = row.id ? store.attempts.find((attempt) => attempt.id === row.id) : undefined;
        if (existing) return existing;
        const profile = store.profile ?? defaultProfile();
        store.profile = profile;
        const attempt: AttemptRow = {
          id: row.id || newId(),
          user_id: profile.id,
          ...cleanAttempt(row as unknown as Record<string, unknown>, nowIso()),
        };
        store.attempts = [attempt, ...store.attempts].slice(0, MAX_ATTEMPTS);
        return attempt;
      });
    },

    async getSkillScores() {
      return withStore((store) => ({ ...store.skills }));
    },

    async setSkillScores(scores) {
      withStore((store) => {
        store.skills = { ...store.skills, ...cleanSkills(scores) };
      });
    },

    async listLessonProgress() {
      return withStore((store) =>
        store.lessons.map((row) => ({
          lesson_id: row.lesson_id,
          stars: row.stars,
          best_pct: row.best_pct,
          attempts: row.attempts,
          completed_at: row.completed_at,
        })),
      );
    },

    async upsertLessonProgress(row) {
      withStore((store) => {
        const clean = cleanLessonRow(row as unknown as Record<string, unknown>);
        store.lessons = [...store.lessons.filter((item) => item.lesson_id !== clean.lesson_id), clean];
      });
    },

    async upsertLessonProgressMany(rows) {
      // Every row is checked before anything is written, so a refused row leaves the store as it was.
      const cleaned = rows.slice(0, 500).map((row) => cleanLessonRow(row as unknown as Record<string, unknown>));
      withStore((store) => {
        const ids = new Set(cleaned.map((row) => row.lesson_id));
        store.lessons = [...store.lessons.filter((item) => !ids.has(item.lesson_id)), ...cleaned];
      });
    },

    async listReviewItems() {
      return withStore((store) => store.reviews.slice());
    },

    async upsertReviewItems(rows) {
      withStore((store) => {
        for (const raw of rows) {
          const clean = cleanReviewRow(raw as unknown as Record<string, unknown>, nowIso());
          if (!clean) continue;
          store.reviews = [...store.reviews.filter((item) => item.item_key !== clean.item_key), clean as unknown as ReviewRow];
        }
      });
    },

    async listMyTests() {
      return withStore((store) => store.tests.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },

    async getTest(id: string) {
      return withStore((store) => store.tests.find((test) => test.id === id) ?? null);
    },

    async insertTest(row: NewTest) {
      return withStore((store) => {
        const existing = row.id ? store.tests.find((test) => test.id === row.id) : undefined;
        if (existing) return existing;
        const profile = store.profile ?? defaultProfile();
        store.profile = profile;
        const test = {
          id: row.id || newId(),
          owner_id: profile.id,
          ...cleanTestInput(row as unknown as Record<string, unknown>, nowIso()),
        } as unknown as TestRow;
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
      throw userError(ONLINE_ONLY);
    },

    async answerFriend() {
      throw userError(ONLINE_ONLY);
    },

    async listShares(): Promise<ShareRow[]> {
      return [];
    },

    async sendShare(_payload: SharePayload) {
      throw userError(ONLINE_ONLY);
    },

    async markSharesSeen() {},

    async listAnnouncements() {
      return LOCAL_ANNOUNCEMENTS.slice();
    },

    // The browser preview keeps links only. Files live in the desktop app or in an online account.
    async listLibraryFiles() {
      return [];
    },

    async getLibraryBlob() {
      return null;
    },

    async getLibraryText() {
      return '';
    },

    async addLibraryFile() {
      throw userError('Files are kept in the desktop app or in your online account.');
    },

    async deleteLibraryFile() {},

    async listLibraryLinks() {
      return withStore((store) =>
        (store.libraryLinks ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)),
      );
    },

    async addLibraryLink(input: NewLibraryLink) {
      return withStore((store) => {
        const links = store.libraryLinks ?? [];
        const existing = input.id ? links.find((link) => link.id === input.id) : undefined;
        if (existing) return existing;
        const clean = cleanLibraryLink(input as unknown as Record<string, unknown>);
        const link: LibraryLinkRow = {
          id: input.id || newId(),
          ...clean,
          created_at: isoTime(input.created_at, nowIso()),
          updated_at: nowIso(),
        };
        store.libraryLinks = [link, ...links];
        return link;
      });
    },

    async updateLibraryLink(id: string, patchInput: LibraryLinkPatch) {
      return withStore((store) => {
        const patch: LibraryLinkPatch = patchInput && typeof patchInput === 'object' ? patchInput : {};
        const link = (store.libraryLinks ?? []).find((item) => item.id === id);
        if (!link) throw userError('That link is no longer in your library.');
        Object.assign(link, {
          title: patch.title === undefined ? link.title : String(patch.title ?? '').slice(0, 200),
          category: patch.category === undefined ? link.category : String(patch.category || 'General').slice(0, 40),
          note: patch.note === undefined ? link.note : String(patch.note ?? '').slice(0, 500),
          updated_at: nowIso(),
        });
        return { ...link };
      });
    },

    async deleteLibraryLink(id: string) {
      withStore((store) => {
        store.libraryLinks = (store.libraryLinks ?? []).filter((link) => link.id !== id);
      });
    },

    async listTutorChats() {
      return withStore((store) =>
        store.tutorChats
          .slice()
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .map((chat) => ({ ...chat })),
      );
    },

    async createTutorChat(record) {
      return withStore((store) => {
        const existing = record?.id ? store.tutorChats.find((chat) => chat.id === record.id) : undefined;
        if (existing) return { ...existing };
        const time = isoTime(record?.created_at, nowIso());
        const chat: TutorChatRow = { id: record?.id || newId(), title: null, archived: false, created_at: time, updated_at: time };
        if (store.tutorChats.length >= MAX_CHATS) throw userError('You have reached the limit for chats. Delete some chats and try again.');
        store.tutorChats = [chat, ...store.tutorChats];
        return { ...chat };
      });
    },

    async renameTutorChat(id, title) {
      return withStore((store) => {
        const chat = findChat(store, id);
        chat.title = cleanChatTitle(title);
        return { ...chat };
      });
    },

    async setTutorChatArchived(id, archived) {
      return withStore((store) => {
        const chat = findChat(store, id);
        chat.archived = Boolean(archived);
        return { ...chat };
      });
    },

    async deleteTutorChat(id) {
      withStore((store) => {
        findChat(store, id);
        store.tutorChats = store.tutorChats.filter((chat) => chat.id !== id);
        store.tutor = store.tutor.filter((message) => message.chat_id !== id);
      });
    },

    async searchTutorChats(query) {
      const needle = String(query ?? '').trim().toLowerCase();
      return withStore((store) => {
        const ids = new Set<string>();
        for (const chat of store.tutorChats) {
          if (!needle || (chat.title ?? '').toLowerCase().includes(needle)) ids.add(chat.id);
        }
        if (needle) {
          for (const message of store.tutor) {
            if (message.chat_id && message.content.toLowerCase().includes(needle)) ids.add(message.chat_id);
          }
        }
        return [...ids];
      });
    },

    async listTutor(chatId, limit = 40) {
      return withStore((store) =>
        store.tutor
          .filter((message) => message.chat_id === chatId)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .slice(-clampNumber(limit, 1, 200, 40))
          .map((message) => ({ ...message })),
      );
    },

    async addTutor(chatId, role, content, record) {
      return withStore((store) => {
        const chat = findChat(store, chatId);
        // A message that is already there keeps its first copy, as the app does.
        const existing = record?.id ? store.tutor.find((item) => item.id === record.id) : undefined;
        if (existing) return { ...existing };
        const message: TutorRow = {
          id: record?.id || newId(),
          chat_id: chatId,
          role: cleanTutorRole(role),
          content: String(content ?? '').slice(0, 8000),
          attachments: cleanAttachments(record?.attachments),
          created_at: isoTime(record?.created_at, nowIso()),
        };
        store.tutor = [...store.tutor, message].slice(-MAX_TUTOR);
        chat.updated_at = nowIso();
        return { ...message };
      });
    },
  };
}
