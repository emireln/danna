// The built-in pictures for people who have not chosen one. The 24 pictures are DiceBear avatars under CC0, written by
// scripts/make-avatars.mjs and bundled with the app, so they load offline.
// A pick is random but fixed: a hash of the person's id chooses the picture, so the same person has the same one
// everywhere in the app, and the id itself never leaves the device.
const pictures = import.meta.glob<string>('../assets/avatars/*.svg', { eager: true, query: '?url', import: 'default' });
const urls = Object.keys(pictures)
  .sort()
  .map((path) => pictures[path]);

/** How many built-in pictures there are. */
export const AVATAR_PACK_SIZE = urls.length;

// FNV-1a: a short hash that spreads similar texts, such as ids that differ by one letter, over the whole pack.
function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** The built-in picture of a person, chosen by a stable text such as their id. */
export function defaultAvatarUrl(seed: string): string {
  return urls[hash(seed) % urls.length];
}
