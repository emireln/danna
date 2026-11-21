// A reply is cut into sentences as it is written, so the first one can be spoken while the rest is still coming. Also,
// the reply's markdown becomes plain words, because a voice reads words, not asterisks and hashes.

/** The complete sentences of a text being written. `rest` waits for more text, unless `final` says the reply has ended. */
export function takeSentences(text: string, final = false): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  // A full stop, question mark or exclamation mark followed by a space, or a line break.
  const pattern = /[.!?…]+["'”’)\]]*(?=\s)|\n+/g;
  let start = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const end = match.index + match[0].length;
    const piece = text.slice(start, end).trim();
    if (piece) sentences.push(piece);
    start = end;
  }
  let rest = text.slice(start);
  if (final && rest.trim()) {
    sentences.push(rest.trim());
    rest = '';
  }
  return { sentences, rest };
}

/** The words of a reply without its markdown: emphasis marks, headings, code ticks and list marks. */
export function toSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^\s*(#{1,6}|[-*•]|\d+\.)\s+/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}
