// The name a new profile starts with. The data stores it in English ('Learner', see localBackend.ts), so the app shows it
// in the app's own language. A name that a person chose is shown exactly as they wrote it.
export const DEFAULT_NAME = 'Learner';

/** The name to show for a profile: the default name is translated, and any other name is shown as it is. */
export function shownName(name: string, translate: (text: string) => string): string {
  return name === DEFAULT_NAME ? translate(DEFAULT_NAME) : name;
}
