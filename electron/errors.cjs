// Errors that are safe to show people are marked with this prefix. Anything else
// is replaced with a friendly fallback in the interface.
const MARK = '@@user@@';

function userError(message) {
  return new Error(`${MARK}${message}`);
}

module.exports = { MARK, userError };
