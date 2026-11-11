// Chooses the data backend: Supabase when the user signed in, otherwise this device.
import { createLocalBackend } from './data/localBackend';
import { createSupabaseBackend } from './data/supabaseBackend';
import type { BackendMode, DataBackend } from './data/backend';
import { getSupabase } from './supabase';

const MODE_KEY = 'danna.mode';

export function readStoredMode(): BackendMode | null {
  try {
    const value = window.localStorage.getItem(MODE_KEY);
    return value === 'supabase' || value === 'local' ? value : null;
  } catch {
    return null;
  }
}

export function storeMode(mode: BackendMode | null): void {
  try {
    if (mode) window.localStorage.setItem(MODE_KEY, mode);
    else window.localStorage.removeItem(MODE_KEY);
  } catch {
    // Storage can be blocked; the app then asks again on the next launch.
  }
}

let cached: { mode: BackendMode; backend: DataBackend } | null = null;

export function backendFor(mode: BackendMode): DataBackend {
  if (cached && cached.mode === mode) return cached.backend;
  let backend: DataBackend;
  if (mode === 'supabase') {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase is not configured. Add your project URL and anon key to .env.');
    backend = createSupabaseBackend(sb);
  } else {
    backend = createLocalBackend();
  }
  cached = { mode, backend };
  return backend;
}
