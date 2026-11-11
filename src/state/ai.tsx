import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { bridge, type CompletionRequest, type CompletionResult } from '../lib/bridge';
import type { AIConnection, AISelection } from '../lib/types';

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
  refresh: () => Promise<void>;
  complete: (request: CompletionRequest) => Promise<CompletionResult>;
  transcribe: (audio: Blob) => Promise<string>;
}

const AIContext = createContext<AIApi | null>(null);

const DESKTOP_ONLY = 'AI features run in the danna desktop app, where your key is stored securely on this device.';

export function AIProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<AIConnection[]>([]);
  const [selection, setSelection] = useState<AISelection | null>(null);
  const [loaded, setLoaded] = useState(!bridge);

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
      refresh,
      complete,
      transcribe,
    }),
    [loaded, connections, selection, refresh, complete, transcribe],
  );

  return <AIContext.Provider value={api}>{children}</AIContext.Provider>;
}

export function useAI(): AIApi {
  const context = useContext(AIContext);
  if (!context) throw new Error('useAI must be used inside AIProvider.');
  return context;
}
