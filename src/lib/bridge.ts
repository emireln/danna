// Typed access to the Electron preload bridge. In a plain browser (for example
// `npm run web`) `bridge` is null and AI features show a clear message instead.
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
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    danna?: DannaBridge;
  }
}

export const bridge: DannaBridge | null = typeof window !== 'undefined' && window.danna ? window.danna : null;

/** Removes Electron's IPC prefixes so people see the plain message. */
export function errorText(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Something went wrong. Please try again.';
  return raw.replace(/^Error invoking remote method '[^']+': /, '').replace(/^Error: /, '');
}
