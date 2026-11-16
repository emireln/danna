// Unfinished lessons and tests are kept on this device, so a learner who leaves the page, for example to change an
// AI key, finds their answers when they come back. A draft is only a convenience: when the device cannot keep one,
// the session starts from its first question, as it always did.

/** Where drafts are kept. The browser's local storage has this shape. */
export interface DraftStore {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

/** A session in progress, as it is kept. The answers are the screen's own shapes, read back from the device. */
export interface SessionDraft {
  testId: string;
  /** The question the learner is on. */
  index: number;
  /** When the session started, so the timer carries on from where it was. */
  startedAt: number;
  items: Record<string, unknown>;
  results: Record<string, unknown>;
  revealed: Record<string, boolean>;
  blankMarks: Record<string, boolean[]>;
}

const PREFIX = 'danna:draft:';

/** The key of one learner's draft on one page, so two accounts on the same device never share a draft. */
export function draftKey(profileId: string, page: string): string {
  return `${PREFIX}${profileId}:${page}`;
}

/** This device's local storage, or null where the page cannot reach it. */
export function localDrafts(): DraftStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Some browsers refuse storage to a page. The session then keeps no draft.
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when a stored session can carry on: it is the same test, on a question that exists, with sane parts. */
export function isSessionDraft(value: unknown, testId: string, questionCount: number): value is SessionDraft {
  if (!isRecord(value)) return false;
  return (
    value.testId === testId &&
    Number.isInteger(value.index) &&
    (value.index as number) >= 0 &&
    (value.index as number) < questionCount &&
    typeof value.startedAt === 'number' &&
    Number.isFinite(value.startedAt) &&
    isRecord(value.items) &&
    isRecord(value.results) &&
    isRecord(value.revealed) &&
    isRecord(value.blankMarks)
  );
}

/** The draft kept under a key, or null when there is none, it cannot be read, or the check turns it down. */
export function readDraft<T>(store: DraftStore | null, key: string, accept: (value: unknown) => value is T): T | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    return accept(value) ? value : null;
  } catch {
    // A draft that is not valid JSON is ignored, and the page starts as if nothing was kept.
    return null;
  }
}

/** Keeps a draft. A full or refusing store is not an error: the page still works, it just is not kept. */
export function writeDraft(store: DraftStore | null, key: string, value: unknown): void {
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // Not kept this time.
  }
}

/** The session kept under a key, or null when there is none, it cannot be read, or it is not this test. */
export function readSessionDraft(store: DraftStore | null, key: string, testId: string, questionCount: number): SessionDraft | null {
  return readDraft(store, key, (value): value is SessionDraft => isSessionDraft(value, testId, questionCount));
}

/** Keeps a session. */
export function writeSessionDraft(store: DraftStore | null, key: string, draft: SessionDraft): void {
  writeDraft(store, key, draft);
}

/** Removes a draft, once its session is finished or started again. */
export function clearDraft(store: DraftStore | null, key: string): void {
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // Nothing to remove.
  }
}
