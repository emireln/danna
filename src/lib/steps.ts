// Steps that can be retried safely. A save with several writes (the attempt, the skills, the lesson, the
// review queue, the profile) may fail part way. The steps that finished stay finished, so trying again
// does not write them twice: no second attempt, no extra lesson attempt, no XP counted twice.

export interface Steps {
  /** Runs the action unless this step already finished. A failed step runs again next time. */
  run<T>(name: string, action: () => Promise<T>): Promise<T | undefined>;
  has(name: string): boolean;
  reset(): void;
}

export function createSteps(): Steps {
  const finished = new Set<string>();
  return {
    async run<T>(name: string, action: () => Promise<T>): Promise<T | undefined> {
      if (finished.has(name)) return undefined;
      const value = await action();
      finished.add(name);
      return value;
    },
    has: (name) => finished.has(name),
    reset: () => finished.clear(),
  };
}
