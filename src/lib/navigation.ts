// Where a person goes after signing in. The page they asked for comes back, but only a page inside danna:
// never the sign-in pages themselves, and never another site.

const SIGN_IN_PAGES = new Set(['/auth', '/welcome']);

/** The path to return to after sign-in, or the start page when the path is not one of ours. */
export function returnPath(from: unknown, fallback = '/'): string {
  if (typeof from !== 'string') return fallback;
  if (!from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return fallback;
  const page = from.split(/[?#]/)[0];
  return SIGN_IN_PAGES.has(page) ? fallback : from;
}
