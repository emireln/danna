// The device's own choices for sounds and reminders. They live in this app's local storage, so each device keeps its
// own: a sound or a reminder switched on a laptop does not switch on a phone.

export const SOUND_IDS = ['correct', 'wrong', 'complete', 'coach', 'reminder'] as const;
export type SoundId = (typeof SOUND_IDS)[number];

export interface SoundPrefs {
  /** The master switch: when it is off, no sound plays. */
  enabled: boolean;
  /** From 0 to 100. */
  volume: number;
  items: Record<SoundId, boolean>;
}

export const REMINDER_IDS = ['streak', 'goal', 'review', 'exam', 'comeback'] as const;
export type ReminderId = (typeof REMINDER_IDS)[number];

export interface ReminderPrefs {
  /** The master switch: when it is off, danna sends no notifications. */
  enabled: boolean;
  /** The time reminders may start, as HH:MM on this device's clock. */
  time: string;
  types: Record<ReminderId, boolean>;
}

/** What has been reminded, so that danna sends at most one reminder a day, and not the same kind again too soon. */
export interface ReminderHistory {
  lastDay: string | null;
  lastByKind: Partial<Record<ReminderId, string>>;
}

const SOUND_KEY = 'danna.sounds';
const REMINDER_KEY = 'danna.reminders';
const HISTORY_KEY = 'danna.reminders.history';

const DEFAULT_SOUNDS: SoundPrefs = {
  enabled: true,
  volume: 60,
  items: { correct: true, wrong: true, complete: true, coach: true, reminder: true },
};

const DEFAULT_REMINDERS: ReminderPrefs = {
  enabled: false,
  time: '19:00',
  types: { streak: true, goal: true, review: true, exam: true, comeback: true },
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function readJson<T>(key: string): Partial<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' ? (value as Partial<T>) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked. The choice then lasts until the app closes.
  }
}

export function readSoundPrefs(): SoundPrefs {
  const saved = readJson<SoundPrefs>(SOUND_KEY);
  const volume = typeof saved?.volume === 'number' && Number.isFinite(saved.volume) ? saved.volume : DEFAULT_SOUNDS.volume;
  return {
    enabled: typeof saved?.enabled === 'boolean' ? saved.enabled : DEFAULT_SOUNDS.enabled,
    volume: Math.min(100, Math.max(0, Math.round(volume))),
    items: { ...DEFAULT_SOUNDS.items, ...(saved?.items ?? {}) },
  };
}

export function writeSoundPrefs(prefs: SoundPrefs): void {
  writeJson(SOUND_KEY, prefs);
}

export function readReminderPrefs(): ReminderPrefs {
  const saved = readJson<ReminderPrefs>(REMINDER_KEY);
  return {
    enabled: typeof saved?.enabled === 'boolean' ? saved.enabled : DEFAULT_REMINDERS.enabled,
    time: typeof saved?.time === 'string' && TIME.test(saved.time) ? saved.time : DEFAULT_REMINDERS.time,
    types: { ...DEFAULT_REMINDERS.types, ...(saved?.types ?? {}) },
  };
}

export function writeReminderPrefs(prefs: ReminderPrefs): void {
  writeJson(REMINDER_KEY, prefs);
}

export function readReminderHistory(): ReminderHistory {
  const saved = readJson<ReminderHistory>(HISTORY_KEY);
  return {
    lastDay: typeof saved?.lastDay === 'string' ? saved.lastDay : null,
    lastByKind: saved?.lastByKind ?? {},
  };
}

export function writeReminderHistory(history: ReminderHistory): void {
  writeJson(HISTORY_KEY, history);
}
