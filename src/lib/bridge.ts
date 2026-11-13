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

export interface WindowState {
  maximized: boolean;
}

export interface UpdateStatus {
  /** idle: nothing newer; downloading: a newer version is on its way; ready: it installs when danna closes. */
  state: 'idle' | 'downloading' | 'ready';
  version: string | null;
}

export interface AppSettings {
  closeToTray: boolean;
  /** The language the app is shown in. Null follows the system language. */
  language: 'en' | 'pt' | null;
}

export interface DannaBridge {
  info: () => Promise<AppInfo>;
  keys: {
    state: () => Promise<KeysState>;
    add: (key: string) => Promise<KeysState & { provider: Provider; label: string; models: AIModel[] }>;
    remove: (provider: Provider) => Promise<KeysState>;
    models: (provider: Provider) => Promise<AIModel[]>;
    select: (provider: Provider, model: string) => Promise<AISelection>;
  };
  ai: {
    complete: (request: CompletionRequest) => Promise<CompletionResult>;
    transcribe: (audio: ArrayBuffer, mime: string) => Promise<{ text: string }>;
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
