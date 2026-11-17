// Typed access to the desktop bridge. In a plain browser `bridge` is null, and the
// features that need the desktop app say so in friendly words.
import type { AIConnection, AIModel, AISelection, ChatMessage, Provider } from './types';

export interface AppInfo {
  version: string;
  platform: string;
  packaged: boolean;
  secureStorage: boolean;
}

export interface KeysState {
  connections: AIConnection[];
  selection: AISelection | null;
}

export interface CompletionRequest {
  system?: string;
  messages: ChatMessage[];
  json?: boolean;
  maxTokens?: number;
}

export interface CompletionResult {
  text: string;
  provider: Provider;
  model: string;
}

/** A reply that was streamed. `text` is the whole reply, or what was written before the learner stopped it. */
export interface StreamedReply extends CompletionResult {
  /** The provider stopped because the reply ran out of room. */
  cut: boolean;
  /** The learner stopped the reply while it was written. */
  aborted: boolean;
}

/** One piece of a streamed reply, for the reply with this id. */
export interface ReplyChunk {
  id: string;
  text: string;
}

export interface WindowState {
  maximized: boolean;
}

export interface UpdateStatus {
  /** idle: nothing newer; available: a newer version can be downloaded; downloading: it is on its way; ready: it installs when danna restarts or closes. */
  state: 'idle' | 'available' | 'downloading' | 'ready';
  version: string | null;
}

/** The result of a natural voice request. Without a key for the voice, `unavailable` is true and the device voice reads. */
export interface SpeechReply {
  unavailable?: boolean;
  audio?: Uint8Array;
  mime?: string;
  provider?: string;
}

/** What a check for updates found: a newer version downloading or ready, none (idle), or the check could not be made. */
export interface UpdateCheck {
  state: 'idle' | 'available' | 'downloading' | 'ready' | 'unavailable' | 'failed';
  version: string | null;
}

export interface AppSettings {
  closeToTray: boolean;
  /** The language the app is shown in. Null follows the system language. */
  language: 'en' | 'pt' | null;
  /** The voice for listening: 'auto', 'device', or a named voice such as 'openai:coral'. */
  voice: string;
  /** How loud the listening voice is, from 0 to 100. */
  voiceVolume: number;
}

export interface DannaBridge {
  info: () => Promise<AppInfo>;
  keys: {
    state: () => Promise<KeysState>;
    add: (key: string) => Promise<KeysState & { provider: Provider; label: string; models: AIModel[] }>;
    remove: (provider: Provider) => Promise<KeysState>;
    models: (provider: Provider) => Promise<AIModel[]>;
    select: (provider: Provider, model: string) => Promise<AISelection>;
    /** The key itself, for sealing it into the account. Used only for keys this device has. */
    exportKey: (provider: Provider) => Promise<{ key: string }>;
    /** Stores a key that was opened from the account. It is marked as an account key. */
    importKey: (provider: Provider, key: string) => Promise<KeysState>;
    markAccount: (provider: Provider) => Promise<KeysState>;
    /** Removes the keys that came from the account, when the account is signed out of. */
    forgetAccount: () => Promise<KeysState>;
    /** Keeps the account's keys on this device as its own, when the device leaves the account. */
    releaseAccount: () => Promise<KeysState>;
  };
  ai: {
    complete: (request: CompletionRequest) => Promise<CompletionResult>;
    /** Streams a reply with this id. The pieces arrive through onChunk while it is written. */
    stream: (id: string, request: CompletionRequest) => Promise<StreamedReply>;
    /** Stops the reply with this id. The text written so far is kept. */
    stop: (id: string) => Promise<{ stopped: boolean }>;
    onChunk: (callback: (chunk: ReplyChunk) => void) => () => void;
    transcribe: (audio: ArrayBuffer, mime: string) => Promise<{ text: string }>;
    speak: (text: string, voice: string) => Promise<SpeechReply>;
  };
  local: {
    call: <T = unknown>(method: string, args?: unknown[]) => Promise<T>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    set: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  };
  /** Keeps the sign-in session encrypted on this device. */
  session: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<boolean>;
    remove: (key: string) => Promise<void>;
  };
  window: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<void>;
    close: () => Promise<void>;
    state: () => Promise<WindowState>;
    onState: (callback: (state: WindowState) => void) => () => void;
  };
  update: {
    status: () => Promise<UpdateStatus>;
    check: () => Promise<UpdateCheck>;
    download: () => Promise<void>;
    install: () => Promise<void>;
    onStatus: (callback: (status: UpdateStatus) => void) => () => void;
  };
  onNavigate: (callback: (path: string) => void) => () => void;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    danna?: DannaBridge;
  }
}

export const bridge: DannaBridge | null = typeof window !== 'undefined' && window.danna ? window.danna : null;

// Errors from the desktop side that are safe to show carry this marker.
const USER_MARK = '@@user@@';
const FALLBACK = 'Something went wrong. Please try again.';

/** An error whose message is written for the person. errorText shows it as it is. */
export function userError(message: string): Error {
  return new Error(`${USER_MARK}${message}`);
}

const PATTERNS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'That email and password do not match. Please try again.'],
  [/email not confirmed/i, 'Please confirm your email first. Check your inbox for the link.'],
  [/already registered|already been registered|user already exists/i, 'That email already has an account. Try signing in instead.'],
  [/at least 8 characters|password should be/i, 'Use a password with at least 8 characters.'],
  [/rate limit|too many requests|\b429\b/i, 'Too many attempts. Please wait a moment and try again.'],
  [/failed to fetch|network ?error|network request failed|timed? ?out|enotfound|econn|offline/i, 'We could not connect. Check your internet connection and try again.'],
  [/duplicate key|already taken|23505/i, 'That name is already taken. Try another one.'],
  [/maximum allowed size|payload too large|exceeded/i, 'That picture is too large. Choose a smaller one.'],
  [/mime type|not supported/i, 'That picture type cannot be saved. Try another one.'],
  [/reached the limit/i, 'You have reached the limit for this. Remove some items and try again.'],
  [/jwt|session (has )?expired|not authenticated|refresh token/i, 'Your session has ended. Please sign in again.'],
];

/** Turns any error into a short message a person can act on. Never shows internal details. */
export function errorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const marked = raw.indexOf(USER_MARK);
  if (marked !== -1) return raw.slice(marked + USER_MARK.length).trim() || FALLBACK;
  for (const [pattern, text] of PATTERNS) {
    if (pattern.test(raw)) return text;
  }
  return FALLBACK;
}
