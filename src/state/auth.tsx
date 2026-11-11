import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSupabase, requireSupabase } from '../lib/supabase';
import { backendFor, readStoredMode, storeMode } from '../lib/session';
import type { BackendMode, DataBackend } from '../lib/data/backend';

type Status = 'loading' | 'out' | 'in';

interface AuthApi {
  status: Status;
  mode: BackendMode | null;
  backend: DataBackend | null;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<{ confirmEmail: boolean }>;
  useOffline: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'The email or password is not right.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first. Check your inbox for the link.';
  if (/already registered|already been registered/i.test(message)) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (/password/i.test(message) && /characters|least/i.test(message)) return 'Use a password with at least 8 characters.';
  return message;
}

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
      if (event === 'SIGNED_OUT') {
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
      if (error) throw new Error(friendlyAuthError(error.message));
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
      if (error) throw new Error(friendlyAuthError(error.message));
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

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (sb && readStoredMode() === 'supabase') await sb.auth.signOut();
    storeMode(null);
    leave();
  }, [leave]);

  const api = useMemo<AuthApi>(
    () => ({ status, mode, backend, email, signIn, signUp, useOffline, signOut }),
    [status, mode, backend, email, signIn, signUp, useOffline, signOut],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
