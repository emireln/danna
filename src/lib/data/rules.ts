// The rules that keep stored values valid. The desktop database (electron/localdb.cjs) applies the same rules,
// and tests/data-parity.test.mjs checks that both sides give the same answers, so the browser preview behaves
// like the app. When a rule changes, change it in both places.
import { userError } from '../bridge';
import { GOALS, LEVELS, SKILLS, type AnswerRecord, type AttemptKind, type Goal, type Level, type LibraryKind, type ProfileRow, type Skill, type TutorAttachment } from '../types';

export const ATTEMPT_KINDS: readonly AttemptKind[] = ['diagnostic', 'lesson', 'checkpoint', 'mock', 'practice', 'review'];
export const TEST_SKILLS: ReadonlyArray<Skill | 'mixed'> = [...SKILLS, 'mixed'];
export const AVATAR_MAX_BYTES = 300 * 1024;
/** A banner is a wide WebP strip. It is kept under this size on this device and in the account. */
export const BANNER_MAX_BYTES = 480 * 1024;
export const MAX_ANSWERS = 300;
export const MAX_RESPONSE_LENGTH = 2000;
export const MAX_JSON_LENGTH = 200_000;
export const MIME_BY_KIND: Record<LibraryKind, string> = { pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown' };

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const USERNAME = /^[a-z0-9_]{3,20}$/;
const HTTPS_LINK = /^https:\/\/[^\s]+$/;

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

/** Only a real date and time is stored, always in the same format. Anything else gets the fallback. */
export function isoTime(value: unknown, fallback: string): string {
  const time = typeof value === 'string' && value ? new Date(value) : null;
  return time && Number.isFinite(time.getTime()) ? time.toISOString() : fallback;
}

export function optionalText(value: unknown): string | null {
  return value === undefined || value === null || value === '' ? null : String(value);
}

export const isSkill = (value: unknown): value is Skill => (SKILLS as readonly unknown[]).includes(value);
const isLevel = (value: unknown): value is Level => (LEVELS as readonly unknown[]).includes(value);
const isGoal = (value: unknown): value is Goal => (GOALS as readonly unknown[]).includes(value);

/** Only the five skills are kept, each as a whole number from 0 to 100. */
export function cleanSkills(scores: unknown): Partial<Record<Skill, number>> {
  const out: Partial<Record<Skill, number>> = {};
  if (!scores || typeof scores !== 'object') return out;
  const record = scores as Record<string, unknown>;
  for (const skill of SKILLS) {
    if (record[skill] !== undefined && record[skill] !== null) out[skill] = clampNumber(record[skill], 0, 100, 0);
  }
  return out;
}

function cleanResponse(value: unknown): AnswerRecord['response'] {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? clampNumber(value, -1, 1000, 0) : null;
  if (typeof value === 'string') return value.slice(0, MAX_RESPONSE_LENGTH);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => String(item ?? '').slice(0, 200));
  return null;
}

/** The answers of an attempt are kept as the interface sends them, but bounded in count and length. */
export function cleanAnswers(list: unknown): AnswerRecord[] {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_ANSWERS).flatMap((item): AnswerRecord[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const fraction = Number(record.fraction);
    return [
      {
        id: String(record.id ?? '').slice(0, 120),
        skill: isSkill(record.skill) ? record.skill : 'language',
        fraction: Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0,
        response: cleanResponse(record.response),
      },
    ];
  });
}

export interface CleanAttempt {
  kind: AttemptKind;
  ref_id: string;
  title: string;
  score_pct: number;
  predicted: number | null;
  skills: Partial<Record<Skill, number>>;
  answers: AnswerRecord[];
  duration_s: number;
  created_at: string;
}

export function cleanAttempt(input: Record<string, unknown>, now: string): CleanAttempt {
  const kind = ATTEMPT_KINDS.includes(input.kind as AttemptKind) ? (input.kind as AttemptKind) : 'practice';
  return {
    kind,
    ref_id: String(input.ref_id ?? '').slice(0, 120),
    title: String(input.title ?? 'Practice').slice(0, 200),
    score_pct: clampNumber(input.score_pct, 0, 100, 0),
    predicted: input.predicted === null || input.predicted === undefined ? null : clampNumber(input.predicted, 0, 120, 0),
    skills: cleanSkills(input.skills),
    answers: cleanAnswers(input.answers),
    duration_s: clampNumber(input.duration_s, 0, 86400, 0),
    created_at: isoTime(input.created_at, now),
  };
}

const PROFILE_FIELDS = [
  'username',
  'display_name',
  'avatar_color',
  'goal',
  'target_score',
  'exam_date',
  'daily_minutes',
  'level',
  'xp',
  'streak',
  'last_active',
  'onboarding_done',
] as const;

type ProfileField = (typeof PROFILE_FIELDS)[number];

function cleanProfileValue(key: ProfileField, value: unknown, current: ProfileRow): unknown {
  switch (key) {
    case 'username':
      if (!USERNAME.test(String(value))) throw userError('Usernames use 3 to 20 lowercase letters, numbers or underscores.');
      return String(value);
    case 'display_name':
      return String(value ?? '').slice(0, 40);
    case 'avatar_color':
      return HEX_COLOR.test(String(value)) ? String(value) : current.avatar_color;
    case 'target_score':
      return clampNumber(value, 60, 120, current.target_score);
    case 'daily_minutes':
      return clampNumber(value, 5, 180, current.daily_minutes);
    case 'level':
      return isLevel(value) ? value : current.level;
    case 'goal':
      return isGoal(value) ? value : current.goal;
    case 'xp':
      // XP only grows: a lower value from an old copy never takes points away.
      return Math.max(current.xp, clampNumber(value, 0, 10_000_000, current.xp));
    case 'streak':
      return clampNumber(value, 0, 36500, current.streak);
    case 'exam_date':
    case 'last_active':
      return DATE_PATTERN.test(String(value ?? '')) ? String(value) : null;
    case 'onboarding_done':
      return Boolean(value);
  }
}

/** The profile fields a patch changes, each checked against the current profile. */
export function cleanProfilePatch(current: ProfileRow, patch: unknown): Partial<ProfileRow> {
  const out: Record<string, unknown> = {};
  const source = patch && typeof patch === 'object' ? (patch as Record<string, unknown>) : {};
  for (const key of PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) out[key] = cleanProfileValue(key, source[key], current);
  }
  return out as Partial<ProfileRow>;
}

/** A review item needs its key and its question, or the review screen cannot show it. */
export function cleanReviewRow(row: Record<string, unknown>, now: string) {
  const key = typeof row.item_key === 'string' ? row.item_key.slice(0, 200) : '';
  const payload = row.payload;
  if (!key || !payload || typeof payload !== 'object' || !(payload as Record<string, unknown>).question) return null;
  const json = JSON.stringify(payload);
  if (json.length > MAX_JSON_LENGTH) return null;
  return {
    item_key: key,
    skill: isSkill(row.skill) ? row.skill : ('language' as Skill),
    payload: JSON.parse(json) as unknown,
    ease: Math.min(5, Math.max(1.3, Number(row.ease) || 2.5)),
    interval_days: clampNumber(row.interval_days, 0, 36500, 0),
    reps: clampNumber(row.reps, 0, 100000, 0),
    due_at: isoTime(row.due_at, now),
  };
}

export function cleanLessonRow(row: Record<string, unknown>) {
  const lessonId = typeof row.lesson_id === 'string' ? row.lesson_id.slice(0, 80) : '';
  if (!lessonId) throw userError('That lesson could not be saved.');
  return {
    lesson_id: lessonId,
    stars: clampNumber(row.stars, 0, 3, 0),
    best_pct: clampNumber(row.best_pct, 0, 100, 0),
    attempts: clampNumber(row.attempts, 0, 100000, 0),
    completed_at: optionalText(row.completed_at),
  };
}

export function cleanTestInput(input: Record<string, unknown>, now: string) {
  const content = JSON.stringify(input.content ?? { passages: [], questions: [] });
  if (content.length > MAX_JSON_LENGTH) throw userError('That practice set is too large to keep.');
  return {
    title: String(input.title ?? 'Practice set').slice(0, 120),
    description: String(input.description ?? '').slice(0, 300),
    kind: input.kind === 'custom' ? ('custom' as const) : ('ai' as const),
    skill: TEST_SKILLS.includes(input.skill as Skill | 'mixed') ? (input.skill as Skill | 'mixed') : ('mixed' as const),
    level: isLevel(input.level) ? input.level : ('B1' as const),
    minutes: clampNumber(input.minutes, 1, 240, 10),
    content: JSON.parse(content) as { passages: unknown[]; questions: unknown[] },
    created_at: isoTime(input.created_at, now),
  };
}

export function cleanTutorRole(role: unknown): 'user' | 'assistant' {
  return role === 'assistant' ? 'assistant' : 'user';
}

export const CHAT_TITLE_MAX = 120;
export const MAX_CHATS = 500;
export const MAX_ATTACHMENTS = 10;

/** A chat's name: one line of plain text, at most 120 characters. An empty name clears it. */
export function cleanChatTitle(title: unknown): string | null {
  const text = String(title ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CHAT_TITLE_MAX);
  return text || null;
}

const ATTACHMENT_KINDS: readonly TutorAttachment['kind'][] = ['image', 'document', 'library'];

/** The files that went with a message: name, kind and size only. At most ten are kept. */
export function cleanAttachments(value: unknown): TutorAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ATTACHMENTS).flatMap((item): TutorAttachment[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const name = String(record.name ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
    if (!name) return [];
    const kind = ATTACHMENT_KINDS.includes(record.kind as TutorAttachment['kind']) ? (record.kind as TutorAttachment['kind']) : 'document';
    return [{ name, kind, size: clampNumber(record.size, 0, 2 ** 40, 0) }];
  });
}

export function cleanLibraryLink(input: Record<string, unknown>) {
  const url = String(input.url || '');
  if (!HTTPS_LINK.test(url) || url.length > 2000) throw userError('Paste a web link that starts with https://.');
  return {
    url,
    title: String(input.title ?? '').slice(0, 200),
    platform: String(input.platform || 'other').slice(0, 40),
    category: String(input.category || 'General').slice(0, 40),
    note: String(input.note ?? '').slice(0, 500),
  };
}

/** A WebP file starts with RIFF, a size, then WEBP. */
export function isWebpBytes(bytes: Uint8Array): boolean {
  if (bytes.length <= 12) return false;
  const text = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  return text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP';
}
