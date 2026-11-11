// Offline data on the desktop. Every call goes to the local database file through
// the bridge. Friends and sharing are not part of offline use.
import type { DannaBridge } from '../bridge';
import { LOCAL_ANNOUNCEMENTS } from '../../content/announcements';
import type { AttemptRow, LessonProgressRow, ProfileRow, ReviewRow, Skill, TestRow, TutorRow } from '../types';
import type { DataBackend, NewAttempt, NewTest, ProfilePatch } from './backend';

const ONLINE_ONLY = 'This is available with an online account.';

export function createSqliteBackend(bridge: DannaBridge): DataBackend {
  const call = <T>(method: string, args: unknown[] = []): Promise<T> => bridge.local.call<T>(method, args);

  return {
    mode: 'local',

    getProfile: () => call<ProfileRow>('getProfile'),
    updateProfile: (patch: ProfilePatch) => call<ProfileRow>('updateProfile', [patch]),

    listAttempts: (limit = 60) => call<AttemptRow[]>('listAttempts', [limit]),
    getAttempt: (id: string) => call<AttemptRow | null>('getAttempt', [id]),
    insertAttempt: (row: NewAttempt) => call<AttemptRow>('insertAttempt', [row]),

    getSkillScores: () => call<Partial<Record<Skill, number>>>('getSkillScores'),
    setSkillScores: (scores) => call<void>('setSkillScores', [scores]),

    listLessonProgress: () => call<LessonProgressRow[]>('listLessonProgress'),
    upsertLessonProgress: (row: LessonProgressRow) => call<void>('upsertLessonProgress', [row]),

    listReviewItems: () => call<ReviewRow[]>('listReviewItems'),
    upsertReviewItems: (rows: ReviewRow[]) => call<void>('upsertReviewItems', [rows]),

    listMyTests: () => call<TestRow[]>('listMyTests'),
    getTest: (id: string) => call<TestRow | null>('getTest', [id]),
    insertTest: (row: NewTest) => call<TestRow>('insertTest', [row]),

    listFriends: async () => [],
    searchPeople: async () => [],
    requestFriend: async () => {
      throw new Error(ONLINE_ONLY);
    },
    answerFriend: async () => {
      throw new Error(ONLINE_ONLY);
    },
    listShares: async () => [],
    sendShare: async () => {
      throw new Error(ONLINE_ONLY);
    },
    markSharesSeen: async () => undefined,

    listAnnouncements: async () => LOCAL_ANNOUNCEMENTS.slice(),

    listTutor: (limit = 40) => call<TutorRow[]>('listTutor', [limit]),
    addTutor: (role, content) => call<TutorRow>('addTutor', [role, content]),
    clearTutor: () => call<void>('clearTutor'),
  };
}
