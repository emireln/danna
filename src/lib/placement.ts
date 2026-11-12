// Where the right answer of a multiple-choice item sits. The position is chosen by a hash of the question, so
// it varies from item to item and is the same on every run. The bundled lessons and the sets the AI writes
// both use it, so no set answers A every time.

export function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The right option and the wrong ones, placed in an order chosen by the seed. `answer` is the right option's index. */
export function placeCorrect(correct: string, wrong: string[], seed: string): { options: string[]; answer: number } {
  const answer = hashText(seed) % (wrong.length + 1);
  const options = [...wrong];
  options.splice(answer, 0, correct);
  return { options, answer };
}

/**
 * A list written with its right option at `answer`. The right option moves to its place for this question, and the
 * other options keep their order.
 */
export function placeAnswer(options: string[], answer: number, seed: string): { options: string[]; answer: number } {
  return placeCorrect(options[answer], options.filter((_, index) => index !== answer), seed);
}
