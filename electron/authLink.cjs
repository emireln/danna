// Google sign-in, the parts that do not need Electron: which address the app may open for the sign-in, and which
// address brings the browser back. main.cjs uses them, and the tests check them.

const fs = require('node:fs');

// Only the project's own Google sign-in page on Supabase, over https. Nothing else is opened for a sign-in.
function isGoogleSignInUrl(value) {
  if (typeof value !== 'string' || value.length > 2000) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    /^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) &&
    url.pathname === '/auth/v1/authorize' &&
    url.searchParams.get('provider') === 'google'
  );
}

// The address the hub's return page opens: the app's scheme and auth-callback, then the sign-in in the query or the
// fragment. Only that address is taken from a command line, and only a short one.
function findAuthCallback(argv, scheme) {
  if (!Array.isArray(argv)) return null;
  const pattern = new RegExp(`^${scheme}://auth-callback(?:[?#]|$)`);
  return argv.find((value) => typeof value === 'string' && value.length <= 8192 && pattern.test(value)) || null;
}

// The sign-in that this app started is kept on disk while it waits for the browser, so a restart of Danna does not lose
// it. An hour covers a slow sign-in.
const SIGN_IN_WINDOW_MS = 60 * 60 * 1000;

/** True when a sign-in started at `startedAt` may still be taken at `now`. */
function signInIsPending(startedAt, now) {
  return Number.isFinite(startedAt) && startedAt > 0 && now >= startedAt && now - startedAt <= SIGN_IN_WINDOW_MS;
}

/** The start time kept in `file`, or 0 when there is none, or it cannot be read. */
function readSignInStart(file) {
  try {
    const { startedAt } = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Number.isFinite(startedAt) ? startedAt : 0;
  } catch {
    return 0;
  }
}

/** Keeps the start time in `file`. If that fails, the sign-in still works while this Danna runs. */
function writeSignInStart(file, startedAt) {
  try {
    fs.writeFileSync(file, JSON.stringify({ startedAt }));
  } catch {
    // Not kept.
  }
}

/** Removes the kept start time, once the sign-in is taken. */
function clearSignInStart(file) {
  try {
    fs.rmSync(file, { force: true });
  } catch {
    // Nothing to remove.
  }
}

module.exports = {
  isGoogleSignInUrl,
  findAuthCallback,
  SIGN_IN_WINDOW_MS,
  signInIsPending,
  readSignInStart,
  writeSignInStart,
  clearSignInStart,
};
