import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSupabase, requireSupabase } from '../lib/supabase';
import { backendFor, readStoredMode, storeMode } from '../lib/session';
import type { BackendMode, DataBackend } from '../lib/data/backend';
import { copyProgress } from '../lib/migrate';
import { bridge, errorText } from '../lib/bridge';
import { deriveVault, exportVault, fromBase64, importVault, newSalt, toBase64, VAULT_STORAGE_KEY } from '../lib/vault';

type Status = 'loading' | 'out' | 'in';

interface AuthApi {
  status: Status;
  mode: BackendMode | null;
  backend: DataBackend | null;
  email: string | null;
  /** The key that seals this account's AI keys. Null until the account is signed in on this device. */
  vault: CryptoKey | null;
  /** Why the vault could not be opened on this device, or null. Signing in still works. */
  vaultError: string | null;
  /** Opens the vault with the account password, so this device can save and read the AI keys. Throws if it cannot. */
  unlockAccountKeys: (password: string) => Promise<void>;
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
  const [vault, setVault] = useState<CryptoKey | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);

  const enter = useCallback((next: BackendMode, who: string | null) => {
    setBackend(backendFor(next));
    setMode(next);
    setEmail(who);
    setStatus('in');
  }, []);

  // A restart reads the vault from the encrypted session store, so the password is not asked again.
  // A password that was typed in this session is newer than the stored copy, so it is kept.
  const loadStoredVault = useCallback(async () => {
    if (!bridge) return;
    try {
      const stored = await bridge.session.get(VAULT_STORAGE_KEY);
      if (stored) {
        const key = await importVault(stored);
        setVault((current) => current ?? key);
      }
    } catch (error) {
      console.error('Could not open the account vault on this device', error);
    }
  }, []);

  // Signing in is the moment the password is known, so the vault is made here and kept on this device.
  // It throws when the vault cannot be opened, so the caller can say why.
  const unlockVault = useCallback(async (password: string) => {
    const account = backendFor('supabase');
    const profile = await account.getProfile();
    // Without a profile there is no salt to read. Making a new one here would replace the salt the keys need.
    if (!profile) throw new Error('Your account profile could not be found. Try again in a moment.');
    let salt = profile.ai_salt ? fromBase64(profile.ai_salt) : null;
    if (!salt) {
      salt = newSalt();
      await account.updateProfile({ ai_salt: toBase64(salt) });
    }
    const key = await deriveVault(password, salt);
    if (bridge) await bridge.session.set(VAULT_STORAGE_KEY, await exportVault(key));
    setVault(key);
    setVaultError(null);
  }, []);

  // Sign-in has worked by now, so a vault problem is kept for the Settings screen instead of being thrown.
  const openVault = useCallback(
    async (password: string) => {
      try {
        await unlockVault(password);
      } catch (error) {
        console.error('Could not open the account vault', error);
        setVault(null);
        setVaultError(errorText(error));
      }
    },
    [unlockVault],
  );

  const leave = useCallback(() => {
    setBackend(null);
    setMode(null);
    setEmail(null);
    setVault(null);
    setVaultError(null);
    setStatus('out');
    // The keys stay saved in the account. This device forgets its copies of them.
    if (bridge) {
      void bridge.keys.forgetAccount().catch(() => undefined);
      void bridge.session.remove(VAULT_STORAGE_KEY).catch(() => undefined);
    }
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
        if (data.session) {
          enter('supabase', data.session.user.email ?? null);
          void loadStoredVault();
        } else {
          leave();
        }
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
        void loadStoredVault();
      }
    });

    return () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, [enter, leave, loadStoredVault]);

  const signIn = useCallback(
    async (address: string, password: string) => {
      const sb = requireSupabase();
      const { data, error } = await sb.auth.signInWithPassword({ email: address.trim(), password });
      if (error) throw error;
      storeMode('supabase');
      enter('supabase', data.user?.email ?? address.trim());
      await openVault(password);
    },
    [enter, openVault],
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
      await openVault(password);
      return { confirmEmail: false };
    },
    [enter, openVault],
  );

  const unlockAccountKeys = useCallback(
    async (password: string) => {
      await unlockVault(password);
    },
    [unlockVault],
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
      // The AI keys this device has from the account stay here, as keys of this device only.
      if (bridge) {
        await bridge.keys.releaseAccount().catch(() => undefined);
        await bridge.session.remove(VAULT_STORAGE_KEY).catch(() => undefined);
      }
      setVault(null);
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
    () => ({
      status,
      mode,
      backend,
      email,
      vault,
      vaultError,
      unlockAccountKeys,
      signIn,
      signUp,
      useOffline,
      moveToDevice,
      signOut,
    }),
    [status, mode, backend, email, vault, vaultError, unlockAccountKeys, signIn, signUp, useOffline, moveToDevice, signOut],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
