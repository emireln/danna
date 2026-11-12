// Offline data on the desktop. Every call goes to the local database file through
// the bridge. Friends and sharing are not part of offline use.
import type { DannaBridge } from '../bridge';
import { LOCAL_ANNOUNCEMENTS } from '../../content/announcements';
import type { AttemptKind, AttemptRow, LessonProgressRow, LibraryFileRow, LibraryLinkRow, ProfileRow, ReviewRow, Skill, TestRow, TutorRow } from '../types';
import type { DataBackend, LibraryLinkPatch, NewAttempt, NewLibraryFile, NewLibraryLink, NewTest, ProfilePatch } from './backend';

const ONLINE_ONLY = 'This is available with an online account.';

export function createSqliteBackend(bridge: DannaBridge): DataBackend {
  const call = <T>(method: string, args: unknown[] = []): Promise<T> => bridge.local.call<T>(method, args);

  return {
    mode: 'local',

    getProfile: () => call<ProfileRow>('getProfile'),
    updateProfile: (patch: ProfilePatch) => call<ProfileRow>('updateProfile', [patch]),

    getAvatar: async () => {
      const bytes = await call<Uint8Array | null>('getAvatar');
      return bytes ? new Blob([Uint8Array.from(bytes)], { type: 'image/webp' }) : null;
    },
    setAvatar: async (picture: Blob | null) => {
      if (!picture) return call<ProfileRow>('clearAvatar');
      return call<ProfileRow>('setAvatar', [await picture.arrayBuffer()]);
    },
    fetchAvatar: async () => null,

    listAttempts: (limit = 60, kind?: AttemptKind) => call<AttemptRow[]>('listAttempts', [limit, kind]),
    countAttempts: (kind: AttemptKind) => call<number>('countAttempts', [kind]),
    getAttempt: (id: string) => call<AttemptRow | null>('getAttempt', [id]),
    insertAttempt: (row: NewAttempt) => call<AttemptRow>('insertAttempt', [row]),

    getSkillScores: () => call<Partial<Record<Skill, number>>>('getSkillScores'),
    setSkillScores: (scores) => call<void>('setSkillScores', [scores]),

    listLessonProgress: () => call<LessonProgressRow[]>('listLessonProgress'),
    upsertLessonProgress: (row: LessonProgressRow) => call<void>('upsertLessonProgress', [row]),
    upsertLessonProgressMany: (rows: LessonProgressRow[]) => call<void>('upsertLessonProgressMany', [rows]),

    listReviewItems: () => call<ReviewRow[]>('listReviewItems'),
    upsertReviewItems: (rows: ReviewRow[]) => call<void>('upsertReviewItems', [rows]),

    listMyTests: () => call<TestRow[]>('listMyTests'),
    getTest: (id: string) => call<TestRow | null>('getTest', [id]),
    insertTest: (row: NewTest) => call<TestRow>('insertTest', [row]),

    listLibraryFiles: () => call<LibraryFileRow[]>('listLibraryFiles'),
    getLibraryBlob: async (id: string) => {
      const bytes = await call<Uint8Array | null>('getLibraryFileData', [id]);
      return bytes ? new Blob([Uint8Array.from(bytes)]) : null;
    },
    getLibraryText: (id: string) => call<string>('getLibraryText', [id]),
    addLibraryFile: async (input: NewLibraryFile) => {
      const data = await input.blob.arrayBuffer();
      return call<LibraryFileRow>('insertLibraryFile', [
        {
          id: input.id,
          created_at: input.created_at,
          name: input.name,
          kind: input.kind,
          mime_type: input.mime_type,
          pages: input.pages,
          extracted_text: input.extracted_text,
          data,
        },
      ]);
    },
    deleteLibraryFile: (id: string) => call<void>('deleteLibraryFile', [id]),
    listLibraryLinks: () => call<LibraryLinkRow[]>('listLibraryLinks'),
    addLibraryLink: (input: NewLibraryLink) => call<LibraryLinkRow>('insertLibraryLink', [input]),
    updateLibraryLink: (id: string, patch: LibraryLinkPatch) => call<LibraryLinkRow>('updateLibraryLink', [id, patch]),
    deleteLibraryLink: (id: string) => call<void>('deleteLibraryLink', [id]),

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
    addTutor: (role, content, record) => call<TutorRow>('addTutor', [role, content, record?.id, record?.created_at]),
    clearTutor: () => call<void>('clearTutor'),
  };
}
