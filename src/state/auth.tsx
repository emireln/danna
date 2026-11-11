import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSupabase, requireSupabase } from '../lib/supabase';
import { backendFor, readStoredMode, storeMode } from '../lib/session';
import type { BackendMode, DataBackend } from '../lib/data/backend';
import { copyProgress } from '../lib/migrate';

type Status = 'loading' | 'out' | 'in';

interface AuthApi {
  status: Status;
  mode: BackendMode | null;
  backend: DataBackend | null;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<{ confirmEmail: boolean }>;
  useOffline: () => void;
  /** Leaves the online account for this device. keepCopy copies progress first. */
  moveToDevice: (keepCopy: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [mode, setMode] = useState<BackendMode | null>(null);
  const [backend, setBackend] = useState<DataBackend | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const enter = useCallback((next: BackendMode, who: string | null) => {
    setBackend(backendFor(next));
    setMode(next);
    setEmail(who);
    setStatus('in');
  }, []);

  const leave = useCallback(() => {
    setBackend(null);
    setMode(null);
    setEmail(null);
    setStatus('out');
  }, []);

  useEffect(() => {
    let active = true;
    const sb = getSupabase();
    const stored = readStoredMode();

    if (stored === 'local') {
      enter('local', null);
    } else if (stored === 'supabase' && sb) {
      sb.auth.getSession().then(({ data }) => {
        if (!active) return;
        if (data.session) enter('supabase', data.session.user.email ?? null);
        else leave();
      });
    } else {
      leave();
    }

    const subscription = sb?.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT' && readStoredMode() === 'supabase') {
        storeMode(null);
        leave();
      } else if (event === 'SIGNED_IN' && session && readStoredMode() === 'supabase') {
        enter('supabase', session.user.email ?? null);
      }
    });

    return () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, [enter, leave]);

  const signIn = useCallback(
    async (address: string, password: string) => {
      const sb = requireSupabase();
      const { data, error } = await sb.auth.signInWithPassword({ email: address.trim(), password });
      if (error) throw error;
      storeMode('supabase');
      enter('supabase', data.user?.email ?? address.trim());
    },
    [enter],
  );

  const signUp = useCallback(
    async (address: string, password: string, username: string) => {
      const sb = requireSupabase();
      const { data, error } = await sb.auth.signUp({
        email: address.trim(),
        password,
        options: { data: { username, display_name: username } },
      });
      if (error) throw error;
      if (!data.session) return { confirmEmail: true };
      storeMode('supabase');
      enter('supabase', data.user?.email ?? address.trim());
      return { confirmEmail: false };
    },
    [enter],
  );

  const useOffline = useCallback(() => {
    storeMode('local');
    enter('local', null);
  }, [enter]);

  const moveToDevice = useCallback(
    async (keepCopy: boolean) => {
      if (keepCopy && mode === 'supabase' && backend) {
        await copyProgress(backend, backendFor('local'));
      }
      // Set the mode first so the session change below is not read as a sign-out.
      storeMode('local');
      const sb = getSupabase();
      if (sb) await sb.auth.signOut().catch(() => undefined);
      enter('local', null);
    },
    [backend, mode, enter],
  );

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (sb && readStoredMode() === 'supabase') await sb.auth.signOut().catch(() => undefined);
    storeMode(null);
    leave();
  }, [leave]);

  const api = useMemo<AuthApi>(
    () => ({ status, mode, backend, email, signIn, signUp, useOffline, moveToDevice, signOut }),
    [status, mode, backend, email, signIn, signUp, useOffline, moveToDevice, signOut],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
