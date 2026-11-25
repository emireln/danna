// Google sign-in, the parts that do not need Electron: which address the app may open for the sign-in, and which
// address brings the browser back. main.cjs uses them, and the tests check them.

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

module.exports = { isGoogleSignInUrl, findAuthCallback };
