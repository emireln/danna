import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { bridge, type CompletionRequest, type CompletionResult } from '../lib/bridge';
import { tn } from '../lib/i18n';
import { syncAccountKeys, type KeySyncPort } from '../lib/keysync';
import type { AIConnection, AISelection, Provider } from '../lib/types';
import { openKey, sealKey } from '../lib/vault';
import { useAuth } from './auth';
import { useToast } from './toast';

interface AIApi {
  /** True inside the Electron app, where keys can be stored and used. */
  desktop: boolean;
  loaded: boolean;
  connections: AIConnection[];
  selection: AISelection | null;
  /** A model is selected and its key is connected. */
  ready: boolean;
  /** An OpenAI key is connected, which enables speech-to-text for speaking tasks. */
  canTranscribe: boolean;
  /** Signed in, with the vault open: keys added here are saved to the account, sealed. */
  accountKeys: boolean;
  /** Keys saved in the account that this device could not open. They must be added again. */
  unreadable: Provider[];
  syncing: boolean;
  refresh: () => Promise<void>;
  /** Brings this device's keys and the account's keys into step. It also runs on its own after sign-in. */
  syncNow: () => Promise<void>;
  /** Removes a key from the account first, then from this device. */
  removeKey: (provider: Provider) => Promise<void>;
  complete: (request: CompletionRequest) => Promise<CompletionResult>;
  transcribe: (audio: Blob) => Promise<string>;
}

const AIContext = createContext<AIApi | null>(null);

const DESKTOP_ONLY = 'AI features run in the danna desktop app, where your key is stored securely on this device.';

export function AIProvider({ children }: { children: ReactNode }) {
  const { notify } = useToast();
  const { status, mode, backend, vault } = useAuth();
  const [connections, setConnections] = useState<AIConnection[]>([]);
  const [selection, setSelection] = useState<AISelection | null>(null);
  const [loaded, setLoaded] = useState(!bridge);
  const [syncing, setSyncing] = useState(false);
  const [unreadable, setUnreadable] = useState<Provider[]>([]);
  const running = useRef(false);

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

  const syncNow = useCallback(async () => {
    const desktop = bridge;
    const account = backend;
    const vaultKey = vault;
    if (!desktop || !account || !vaultKey || mode !== 'supabase' || running.current) return;
    running.current = true;
    setSyncing(true);
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
    } finally {
      running.current = false;
      setSyncing(false);
      await refresh();
    }
  }, [backend, mode, vault, refresh, notify]);

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

  const transcribe = useCallback(async (audio: Blob) => {
    if (!bridge) throw new Error(DESKTOP_ONLY);
    const { text } = await bridge.ai.transcribe(await audio.arrayBuffer(), audio.type || 'audio/webm');
    return text;
  }, []);

  const api = useMemo<AIApi>(
    () => ({
      desktop: Boolean(bridge),
      loaded,
      connections,
      selection,
      ready: Boolean(selection && connections.some((connection) => connection.provider === selection.provider)),
      canTranscribe: connections.some((connection) => connection.provider === 'openai'),
      accountKeys,
      unreadable,
      syncing,
      refresh,
      syncNow,
      removeKey,
      complete,
      transcribe,
    }),
    [loaded, connections, selection, accountKeys, unreadable, syncing, refresh, syncNow, removeKey, complete, transcribe],
  );

  return <AIContext.Provider value={api}>{children}</AIContext.Provider>;
}

export function useAI(): AIApi {
  const context = useContext(AIContext);
  if (!context) throw new Error('useAI must be used inside AIProvider.');
  return context;
}
