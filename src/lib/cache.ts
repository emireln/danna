// The last answer a screen loaded, kept while the app runs. A section that was open before shows that answer at once,
// and checks for newer data in the background, so going back to a tab does not flash a placeholder. It is kept per
// backend: after a sign-in, a sign-out or a switch between this device and an account, the old answer is not shown.
// Nothing here is written to disk.

interface Answer {
  owner: unknown;
  value: unknown;
}

const answers = new Map<string, Answer>();

/** The answer last kept under this key, if it came from the same backend. */
export function lastAnswer<T>(key: string, owner: unknown): T | null {
  const answer = answers.get(key);
  return answer && answer.owner === owner ? (answer.value as T) : null;
}

/** Keeps an answer under this key and returns it, so a loader can store and use it in one step. */
export function keepAnswer<T>(key: string, owner: unknown, value: T): T {
  answers.set(key, { owner, value });
  return value;
}
