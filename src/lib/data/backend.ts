// The data contract shared by the online backend and the offline backend
// (this device only). Screens depend only on this file.
import type {
  AnnouncementRow,
  AttemptKind,
  AttemptRow,
  FriendRow,
  LessonProgressRow,
  PersonRow,
  ProfileRow,
  ReviewRow,
  ShareRow,
  Skill,
  TestContent,
  TestRow,
  TutorAttachment,
  TutorChatRow,
  TutorRow,
  LibraryFileRow,
  LibraryKind,
  LibraryLinkRow,
} from '../types';

export type BackendMode = 'supabase' | 'local';

export interface NewAttempt {
  id?: string;
  created_at?: string;
  kind: AttemptKind;
  ref_id: string;
  title: string;
  score_pct: number;
  predicted: number | null;
  skills: AttemptRow['skills'];
  answers: AttemptRow['answers'];
  duration_s: number;
}

export interface NewTest {
  id?: string;
  created_at?: string;
  title: string;
  description: string;
  kind: TestRow['kind'];
  skill: TestRow['skill'];
  level: TestRow['level'];
  minutes: number;
  content: TestContent;
}

export type ProfilePatch = Partial<
  Pick<
    ProfileRow,
    | 'username'
    | 'display_name'
    | 'avatar_color'
    | 'goal'
    | 'target_score'
    | 'exam_date'
    | 'daily_minutes'
    | 'level'
    | 'xp'
    | 'streak'
    | 'last_active'
    | 'onboarding_done'
  >
>;

export interface SharePayload {
  recipientId: string;
  kind: 'result' | 'test';
  attemptId?: string;
  testId?: string;
  note: string;
}

export interface NewLibraryFile {
  id?: string;
  created_at?: string;
  name: string;
  kind: LibraryKind;
  mime_type: string;
  /** The file's bytes. */
  blob: Blob;
  /** The text read from the file. The tutor uses it. */
  extracted_text: string;
  pages: number | null;
}

export interface NewLibraryLink {
  id?: string;
  created_at?: string;
  url: string;
  title: string;
  platform: string;
  category: string;
  note: string;
}

export interface LibraryLinkPatch {
  title?: string;
  category?: string;
  note?: string;
}

export interface DataBackend {
  readonly mode: BackendMode;
  getProfile(): Promise<ProfileRow | null>;
  updateProfile(patch: ProfilePatch): Promise<ProfileRow>;

  /** The person's own picture as WebP, or null. Its version is profile.avatar_updated_at. */
  getAvatar(): Promise<Blob | null>;
  /** Saves a WebP picture, or removes it with null. Returns the updated profile. */
  setAvatar(picture: Blob | null): Promise<ProfileRow>;
  /** A friend's picture by its storage path. Online accounts only. */
  fetchAvatar(path: string): Promise<Blob | null>;

  /** The newest attempts first, optionally only one kind of attempt. */
  listAttempts(limit?: number, kind?: AttemptKind): Promise<AttemptRow[]>;
  /** How many attempts of one kind exist, whatever the page size. */
  countAttempts(kind: AttemptKind): Promise<number>;
  getAttempt(id: string): Promise<AttemptRow | null>;
  insertAttempt(row: NewAttempt): Promise<AttemptRow>;

  getSkillScores(): Promise<Partial<Record<Skill, number>>>;
  setSkillScores(scores: Partial<Record<Skill, number>>): Promise<void>;

  listLessonProgress(): Promise<LessonProgressRow[]>;
  upsertLessonProgress(row: LessonProgressRow): Promise<void>;
  /** Several lessons in one save, all or nothing. Used when the level is set. */
  upsertLessonProgressMany(rows: LessonProgressRow[]): Promise<void>;

  listReviewItems(): Promise<ReviewRow[]>;
  upsertReviewItems(rows: ReviewRow[]): Promise<void>;

  listMyTests(): Promise<TestRow[]>;
  getTest(id: string): Promise<TestRow | null>;
  insertTest(row: NewTest): Promise<TestRow>;

  listFriends(): Promise<FriendRow[]>;
  searchPeople(query: string): Promise<PersonRow[]>;
  requestFriend(userId: string): Promise<void>;
  /** accept = true accepts a request; false removes a request or friendship. */
  answerFriend(friendshipId: string, accept: boolean): Promise<void>;

  listShares(): Promise<ShareRow[]>;
  sendShare(payload: SharePayload): Promise<void>;
  markSharesSeen(): Promise<void>;

  listAnnouncements(): Promise<AnnouncementRow[]>;

  listLibraryFiles(): Promise<LibraryFileRow[]>;
  /** The file's bytes for viewing, or null when they are not available. */
  getLibraryBlob(id: string): Promise<Blob | null>;
  /** The text read from the file. The tutor uses it. */
  getLibraryText(id: string): Promise<string>;
  addLibraryFile(input: NewLibraryFile): Promise<LibraryFileRow>;
  deleteLibraryFile(id: string): Promise<void>;

  listLibraryLinks(): Promise<LibraryLinkRow[]>;
  addLibraryLink(input: NewLibraryLink): Promise<LibraryLinkRow>;
  updateLibraryLink(id: string, patch: LibraryLinkPatch): Promise<LibraryLinkRow>;
  deleteLibraryLink(id: string): Promise<void>;

  /** The coach's chats, newest first. Archived chats are included. */
  listTutorChats(): Promise<TutorChatRow[]>;
  /** A new empty chat. record keeps an existing id and time, used when progress is copied between devices and accounts. */
  createTutorChat(record?: { id?: string; created_at?: string }): Promise<TutorChatRow>;
  /** Renames a chat. An empty title clears its name. */
  renameTutorChat(id: string, title: string): Promise<TutorChatRow>;
  setTutorChatArchived(id: string, archived: boolean): Promise<TutorChatRow>;
  /** Deletes a chat and every message in it. */
  deleteTutorChat(id: string): Promise<void>;
  /** The ids of the chats whose name or messages contain the text, without regard to case. */
  searchTutorChats(query: string): Promise<string[]>;
  /** The newest messages of one chat, in order. */
  listTutor(chatId: string, limit?: number): Promise<TutorRow[]>;
  /** record keeps an existing id and time, used when progress is copied between devices and accounts. */
  addTutor(
    chatId: string,
    role: TutorRow['role'],
    content: string,
    record?: { id?: string; created_at?: string; attachments?: TutorAttachment[] },
  ): Promise<TutorRow>;
}
