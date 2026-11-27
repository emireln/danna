import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSupabase, requireSupabase } from '../lib/supabase';
import { backendFor, readStoredMode, storeMode } from '../lib/session';
import type { BackendMode, DataBackend } from '../lib/data/backend';
import { copyProgress } from '../lib/migrate';
import { bridge, errorText } from '../lib/bridge';
import { deriveVault, exportVault, fromBase64, importVault, newSalt, toBase64, VAULT_STORAGE_KEY } from '../lib/vault';
import { GOOGLE_RETURN_URL, readSignInCallback } from '../lib/googleSignIn';

type Status = 'loading' | 'out' | 'in';

// What the sign-in screen says when a Google sign-in comes back without a session.
const GOOGLE_FAILED = 'Google sign-in did not finish. Try again.';
// What it says when the browser comes back to a sign-in that this Danna did not start, or that came too late.
const GOOGLE_NOT_STARTED = 'The sign-in did not start in this Danna. Choose Continue with Google again.';

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
  /** Opens the Google sign-in page in the browser. The session comes back to the app later. */
  signInWithGoogle: () => Promise<void>;
  /** Why a Google sign-in did not finish, or null. */
  googleError: string | null;
  dismissGoogleError: () => void;
  signUp: (email: string, password: string, username: string) => Promise<{ confirmEmail: boolean }>;
  /** Sends the link that lets the person choose a new password. Throws if the request fails. */
  requestPasswordReset: (email: string) => Promise<void>;
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
  const [googleError, setGoogleError] = useState<string | null>(null);

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

  // The browser comes back with the sign-in that this app started. The session is taken in, or the screen is told why not.
  useEffect(() => {
    if (!bridge) return undefined;
    // A return that this app did not start, or that came too late, is said on the sign-in screen as well.
    const stopRejected = bridge.auth.onRejected(() => setGoogleError(GOOGLE_NOT_STARTED));
    const stopCallback = bridge.auth.onCallback((address) => {
      const result = readSignInCallback(address);
      const sb = getSupabase();
      if (!result || result.kind === 'error' || !sb) {
        setGoogleError(GOOGLE_FAILED);
        return;
      }
      void sb.auth
        .setSession({ access_token: result.accessToken, refresh_token: result.refreshToken })
        .then(({ data, error }) => {
          if (error || !data.session) {
            setGoogleError(GOOGLE_FAILED);
            return;
          }
          setGoogleError(null);
          storeMode('supabase');
          enter('supabase', data.session.user.email ?? null);
          void loadStoredVault();
        });
    });
    return () => {
      stopRejected();
      stopCallback();
    };
  }, [enter, loadStoredVault]);

  // Opens the Google sign-in page in the browser. The return is taken by the effect above.
  const signInWithGoogle = useCallback(async () => {
    const sb = requireSupabase();
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: GOOGLE_RETURN_URL, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url || !bridge) throw new Error('Google sign-in needs the desktop app.');
    setGoogleError(null);
    await bridge.auth.openSignIn(data.url);
  }, []);

  const dismissGoogleError = useCallback(() => setGoogleError(null), []);

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

  // The link goes to the site address set for the project (the Danna website), so the app needs no address of its own.
  const requestPasswordReset = useCallback(async (address: string) => {
    const sb = requireSupabase();
    const { error } = await sb.auth.resetPasswordForEmail(address.trim());
    if (error) throw error;
  }, []);

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
      signInWithGoogle,
      googleError,
      dismissGoogleError,
      signUp,
      requestPasswordReset,
      useOffline,
      moveToDevice,
      signOut,
    }),
    [
      status,
      mode,
      backend,
      email,
      vault,
      vaultError,
      unlockAccountKeys,
      signIn,
      signInWithGoogle,
      googleError,
      dismissGoogleError,
      signUp,
      requestPasswordReset,
      useOffline,
      moveToDevice,
      signOut,
    ],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
