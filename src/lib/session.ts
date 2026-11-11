// Chooses the data backend. Online uses the account; on this device uses the local
// database (the desktop file, or browser storage in the preview).
import { bridge } from './bridge';
import { createLocalBackend } from './data/localBackend';
import { createSqliteBackend } from './data/sqliteBackend';
import { createSupabaseBackend } from './data/supabaseBackend';
import type { BackendMode, DataBackend } from './data/backend';
import { getSupabase } from './supabase';

const MODE_KEY = 'danna.mode';
const WELCOME_KEY = 'danna.welcomed';

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
    // Storage can be blocked; the choice is asked again next time.
  }
}

export function hasWelcomed(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    return false;
  }
}

export function markWelcomed(): void {
  try {
    window.localStorage.setItem(WELCOME_KEY, '1');
  } catch {
    // Not critical: the welcome may show once more.
  }
}

/** Whether an online account can be used in this build. */
export function onlineAvailable(): boolean {
  return getSupabase() !== null;
}

let cached: { mode: BackendMode; backend: DataBackend } | null = null;

export function backendFor(mode: BackendMode): DataBackend {
  if (cached && cached.mode === mode) return cached.backend;
  let backend: DataBackend;
  if (mode === 'supabase') {
    const sb = getSupabase();
    if (!sb) throw new Error('Online accounts are not available in this version.');
    backend = createSupabaseBackend(sb);
  } else {
    backend = bridge ? createSqliteBackend(bridge) : createLocalBackend();
  }
  cached = { mode, backend };
  return backend;
}
