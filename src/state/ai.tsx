import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { bridge, errorText, type CompletionRequest, type CompletionResult, type StreamedReply } from '../lib/bridge';
import { t, tn } from '../lib/i18n';
import { recordingToWav } from '../lib/audioWav';
import { syncAccountKeys, type KeySyncPort } from '../lib/keysync';
import type { AIConnection, AISelection, Provider } from '../lib/types';
import { openKey, sealKey } from '../lib/vault';
import { useAuth } from './auth';
import { useToast } from './toast';

/** A reply that is being written. Its pieces go to onDelta; `stop` ends it, and `done` resolves with the whole reply. */
export interface ReplyStream {
  id: string;
  stop: () => void;
  done: Promise<StreamedReply>;
}

interface AIApi {
  /** True inside the Electron app, where keys can be stored and used. */
  desktop: boolean;
  loaded: boolean;
  connections: AIConnection[];
  selection: AISelection | null;
  /** A model is selected and its key is connected. */
  ready: boolean;
  /** An OpenAI or Gemini key is connected, which enables speech-to-text for speaking tasks and the coach's microphone. */
  canTranscribe: boolean;
  /** Signed in, with the vault open: keys added here are saved to the account, sealed. */
  accountKeys: boolean;
  /** Signed in with the account, but the vault is not open on this device yet. The password opens it. */
  keysLocked: boolean;
  /** Why the last sync with the account failed, or null. */
  syncError: string | null;
  /** Keys saved in the account that this device could not open. They must be added again. */
  unreadable: Provider[];
  syncing: boolean;
  refresh: () => Promise<void>;
  /** Opens the account vault with the password, then the keys are brought into step. Throws if it cannot. */
  unlock: (password: string) => Promise<void>;
  /** Brings this device's keys and the account's keys into step. It also runs on its own after sign-in.
   *  Returns the reason it failed, or null. */
  syncNow: () => Promise<string | null>;
  /** Removes a key from the account first, then from this device. */
  removeKey: (provider: Provider) => Promise<void>;
  complete: (request: CompletionRequest) => Promise<CompletionResult>;
  /** Starts a reply that is written as it comes. onDelta receives each piece of text. */
  startReply: (request: CompletionRequest, onDelta: (piece: string) => void) => ReplyStream;
  transcribe: (audio: Blob) => Promise<string>;
}

const AIContext = createContext<AIApi | null>(null);

const DESKTOP_ONLY = 'AI features run in the Danna desktop app, where your key is stored securely on this device.';

export function AIProvider({ children }: { children: ReactNode }) {
  const { notify } = useToast();
  const { status, mode, backend, vault, unlockAccountKeys } = useAuth();
  const [connections, setConnections] = useState<AIConnection[]>([]);
  const [selection, setSelection] = useState<AISelection | null>(null);
  const [loaded, setLoaded] = useState(!bridge);
  const [syncing, setSyncing] = useState(false);
  const [unreadable, setUnreadable] = useState<Provider[]>([]);
  const running = useRef(false);
  const queued = useRef(false);
  const syncRef = useRef<() => Promise<string | null>>(async () => null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!bridge) return;
    try {
      const state = await bridge.keys.state();
      setConnections(state.connections);
      setSelection(state.selection);
    } catch (error) {
      console.error('Could not read AI connections', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accountKeys = Boolean(bridge && mode === 'supabase' && backend && vault);
  const keysLocked = Boolean(bridge && mode === 'supabase' && backend && !vault);

  const syncNow = useCallback(async (): Promise<string | null> => {
    const desktop = bridge;
    const account = backend;
    const vaultKey = vault;
    if (!desktop || !account || !vaultKey || mode !== 'supabase') return null;
    // A sync that is already running is followed by one more, so keys added meanwhile are saved too.
    if (running.current) {
      queued.current = true;
      return null;
    }
    running.current = true;
    setSyncing(true);
    let problem: string | null = null;
    try {
      const port: KeySyncPort = {
        listAccount: () => account.listAiKeys(),
        saveAccount: (row) => account.saveAiKey(row),
        connections: async () => (await desktop.keys.state()).connections,
        exportKey: async (provider) => (await desktop.keys.exportKey(provider)).key,
        importKey: async (provider, key) => {
          await desktop.keys.importKey(provider, key);
        },
        markAccount: async (provider) => {
          await desktop.keys.markAccount(provider);
        },
        removeLocal: async (provider) => {
          await desktop.keys.remove(provider);
        },
        seal: (provider, key) => sealKey(vaultKey, provider, key),
        open: (provider, sealed) => openKey(vaultKey, provider, sealed),
      };
      const report = await syncAccountKeys(port);
      setUnreadable(report.unreadable);
      // A key with no model chosen yet gets the newest model, so the assistant works on this device.
      const state = await desktop.keys.state();
      if (!state.selection && state.connections.length > 0) {
        const provider = state.connections[0].provider;
        const models = await desktop.keys.models(provider);
        if (models[0]) await desktop.keys.select(provider, models[0].id);
      }
      if (report.uploaded.length > 0) {
        const count = report.uploaded.length;
        notify(tn('{count} AI key saved to your account.', '{count} AI keys saved to your account.', count, { count }), 'ok');
      }
    } catch (error) {
      console.error('Could not sync the AI keys with your account', error);
      problem = errorText(error);
    } finally {
      running.current = false;
      setSyncing(false);
      setSyncError(problem);
      await refresh();
      if (queued.current) {
        queued.current = false;
        void syncRef.current();
      }
    }
    return problem;
  }, [backend, mode, vault, refresh, notify]);
  syncRef.current = syncNow;

  // Signing in (or opening the app signed in) brings the account's keys to this device.
  useEffect(() => {
    // It runs again only when the sign-in state, the account or the vault changes, not on every render.
    if (status === 'in' && accountKeys) void syncNow();
  }, [status, accountKeys, vault]);

  const removeKey = useCallback(
    async (provider: Provider) => {
      if (!bridge) return;
      // The account is changed first. If that fails, the key stays here, so it is not brought back later.
      if (accountKeys && backend) await backend.deleteAiKey(provider);
      await bridge.keys.remove(provider);
      await refresh();
    },
    [accountKeys, backend, refresh],
  );

  const complete = useCallback(async (request: CompletionRequest) => {
    if (!bridge) throw new Error(DESKTOP_ONLY);
    return bridge.ai.complete(request);
  }, []);

  // The pieces of each reply go to the caller that started it. A reply ends by taking its listener away.
  const replyListeners = useRef(new Map<string, (piece: string) => void>());
  useEffect(() => {
    if (!bridge) return undefined;
    return bridge.ai.onChunk(({ id, text }) => replyListeners.current.get(id)?.(text));
  }, []);

  const startReply = useCallback((request: CompletionRequest, onDelta: (piece: string) => void): ReplyStream => {
    const id = crypto.randomUUID();
    const channel = bridge;
    if (!channel) return { id, stop: () => undefined, done: Promise.reject(new Error(DESKTOP_ONLY)) };
    replyListeners.current.set(id, onDelta);
    const done = channel.ai.stream(id, request).finally(() => {
      replyListeners.current.delete(id);
    });
    return { id, stop: () => void channel.ai.stop(id), done };
  }, []);

  const transcribe = useCallback(async (audio: Blob) => {
    if (!bridge) throw new Error(DESKTOP_ONLY);
    // The recording goes as WAV, which both speech services take. The browser's own format does not reach Gemini.
    let wav: ArrayBuffer;
    try {
      wav = await recordingToWav(audio);
    } catch {
      throw new Error(t('That recording could not be read. Try again.'));
    }
    const { text } = await bridge.ai.transcribe(wav, 'audio/wav');
    return text;
  }, []);

  const api = useMemo<AIApi>(
    () => ({
      desktop: Boolean(bridge),
      loaded,
      connections,
      selection,
      ready: Boolean(selection && connections.some((connection) => connection.provider === selection.provider)),
      canTranscribe: connections.some((connection) => connection.provider === 'openai' || connection.provider === 'gemini'),
      accountKeys,
      keysLocked,
      syncError,
      unreadable,
      syncing,
      refresh,
      unlock: unlockAccountKeys,
      syncNow,
      removeKey,
      complete,
      startReply,
      transcribe,
    }),
    [
      loaded,
      connections,
      selection,
      accountKeys,
      keysLocked,
      syncError,
      unreadable,
      syncing,
      refresh,
      unlockAccountKeys,
      syncNow,
      removeKey,
      complete,
      transcribe,
    ],
  );

  return <AIContext.Provider value={api}>{children}</AIContext.Provider>;
}

export function useAI(): AIApi {
  const context = useContext(AIContext);
  if (!context) throw new Error('useAI must be used inside AIProvider.');
  return context;
}
