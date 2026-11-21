// The voices of listening practice and read-aloud, in the order the learner sees them. The ids match electron/speech.cjs
// (a test keeps them equal). The names of the voices are not translated; the words around them are.

/** The voices built into danna. Their ids are the names of the model's voices. */
export const BUILTIN_VOICES: readonly { id: string; name: string; accent: 'us' | 'uk'; gender: 'female' | 'male' }[] = [
  { id: 'af_heart', name: 'Heart', accent: 'us', gender: 'female' },
  { id: 'af_bella', name: 'Bella', accent: 'us', gender: 'female' },
  { id: 'af_nicole', name: 'Nicole', accent: 'us', gender: 'female' },
  { id: 'af_sarah', name: 'Sarah', accent: 'us', gender: 'female' },
  { id: 'am_michael', name: 'Michael', accent: 'us', gender: 'male' },
  { id: 'bf_emma', name: 'Emma', accent: 'uk', gender: 'female' },
  { id: 'bm_george', name: 'George', accent: 'uk', gender: 'male' },
];

/** The voices of the cloud providers. Each needs the learner's own key for that provider. */
export const OPENAI_VOICES: readonly string[] = ['coral', 'nova', 'onyx', 'sage', 'alloy', 'ash'];
export const GEMINI_VOICES: readonly string[] = ['Kore', 'Zephyr', 'Puck', 'Charon'];

/** Every choice the list offers, in order: automatic, the built-in voices, then the cloud voices. */
export const LISTED_CHOICES: readonly string[] = [
  'auto',
  ...BUILTIN_VOICES.map((voice) => `builtin:${voice.id}`),
  ...OPENAI_VOICES.map((voice) => `openai:${voice}`),
  ...GEMINI_VOICES.map((voice) => `gemini:${voice}`),
];

/** The choice of a voice on this PC, named by its system id. */
export function windowsChoice(id: string): string {
  return `windows:${id}`;
}

export const DEFAULT_VOICE = 'auto';

/** The loudness of the listening voice when the learner has not chosen one: full. */
export const DEFAULT_VOLUME = 100;

/** A volume from 0 to 100, as a whole number. Anything that is not a number becomes the default. */
export function volumeLevel(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** The voice of the browser that sounds most natural: a "natural", "neural" or "online" voice first, then an American one. */
export function pickDeviceVoice<T extends { name: string; lang: string }>(voices: readonly T[]): T | null {
  const english = voices.filter((voice) => /^en([-_]|$)/i.test(voice.lang));
  return (
    english.find((voice) => /natural|neural|online/i.test(voice.name)) ??
    english.find((voice) => /^en[-_]US$/i.test(voice.lang)) ??
    english[0] ??
    null
  );
}
