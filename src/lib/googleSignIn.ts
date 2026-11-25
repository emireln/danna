// Google sign-in in the app. The sign-in page opens in the browser; the hub's return page (website/app-danna.html) sends
// the browser back to danna://auth-callback with the session in the address. This file reads that address.

/** Where the hub sends the browser after Google. The project's Supabase settings must allow this address. */
export const GOOGLE_RETURN_URL = 'https://hub.danna.run/app-danna';

export type SignInCallback = { kind: 'session'; accessToken: string; refreshToken: string } | { kind: 'error' };

/**
 * Reads the address the browser came back with. The session comes in the fragment, and an error too; the query is read
 * as well. Returns null when the address holds neither a session nor an error.
 */
export function readSignInCallback(address: string): SignInCallback | null {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  for (const [key, value] of url.searchParams) {
    if (!params.has(key)) params.set(key, value);
  }
  if (params.has('error') || params.has('error_description')) return { kind: 'error' };
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'session', accessToken, refreshToken };
  return null;
}
