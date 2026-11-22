// A text that changes often and is read by one part of a screen only. The screen keeps it outside its own state, so a
// change draws that part again (through useSyncExternalStore) and not the whole screen. The coach uses it for the reply
// being written (WritingReply in components/CoachReply.tsx).

export interface TextStore {
  /** The text now. */
  get: () => string;
  /** Replaces the text, and tells the readers when it is a different text. */
  set: (text: string) => void;
  /** Calls the listener after each change. Returns the way to stop listening. */
  subscribe: (listener: () => void) => () => void;
}

export function createTextStore(initial = ''): TextStore {
  let text = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => text,
    set: (next) => {
      if (next === text) return;
      text = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
