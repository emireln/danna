import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const supabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!client) {
    try {
      client = createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'danna.auth' },
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
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
  }
  return sb;
}
