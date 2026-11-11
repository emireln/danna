import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { bridge } from './bridge';

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

export const supabaseConfigured = Boolean(url && publishableKey);

// Where the sign-in session is kept. On the desktop it is encrypted by the operating system;
// in the browser preview it stays in the browser's storage. A session that cannot be saved
// simply ends when the app closes.
const sessionVault = {
  async getItem(key: string): Promise<string | null> {
    try {
      return bridge ? await bridge.session.get(key) : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (bridge) await bridge.session.set(key, value);
      else window.localStorage.setItem(key, value);
    } catch {
      // Not kept; the person signs in again next time.
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      if (bridge) await bridge.session.remove(key);
      else window.localStorage.removeItem(key);
    } catch {
      // Nothing to remove.
    }
  },
};

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!client) {
    try {
      client = createClient(url, publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: 'danna.auth',
          storage: sessionVault,
        },
      });
    } catch (error) {
      console.error('Supabase could not start. Check VITE_SUPABASE_URL.', error);
      return null;
    }
  }
  return client;
}

export function requireSupabase(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) {
    throw new Error('Online accounts are not configured in this build (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).');
  }
  return sb;
}
