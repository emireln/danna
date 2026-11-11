// Small text helpers shared by the screens, so the same words are written the same way everywhere.

/** "1 lesson", "4 lessons": the count with the right form of the word. */
export function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
