// The voices of listening practice, in the order the learner sees them. The values match electron/speech.cjs
// (a test keeps them equal). The names of the voices are not translated; the two descriptions are.

export interface VoiceOption {
  value: string;
  label: string;
}

export const VOICE_OPTIONS: readonly VoiceOption[] = [
  { value: 'auto', label: 'Automatic: the most natural voice your keys allow' },
  { value: 'openai:coral', label: 'OpenAI · Coral' },
  { value: 'openai:nova', label: 'OpenAI · Nova' },
  { value: 'openai:onyx', label: 'OpenAI · Onyx' },
  { value: 'openai:sage', label: 'OpenAI · Sage' },
  { value: 'openai:alloy', label: 'OpenAI · Alloy' },
  { value: 'openai:ash', label: 'OpenAI · Ash' },
  { value: 'gemini:Kore', label: 'Google Gemini · Kore' },
  { value: 'gemini:Zephyr', label: 'Google Gemini · Zephyr' },
  { value: 'gemini:Puck', label: 'Google Gemini · Puck' },
  { value: 'gemini:Charon', label: 'Google Gemini · Charon' },
  { value: 'device', label: 'Device voice' },
];

export const DEFAULT_VOICE = 'auto';

/** The loudness of the listening voice when the learner has not chosen one: full. */
export const DEFAULT_VOLUME = 100;

/** A volume from 0 to 100, as a whole number. Anything that is not a number becomes the default. */
export function volumeLevel(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** The device voice that sounds most natural: a "natural", "neural" or "online" voice first, then an American one. */
export function pickDeviceVoice<T extends { name: string; lang: string }>(voices: readonly T[]): T | null {
  const english = voices.filter((voice) => /^en([-_]|$)/i.test(voice.lang));
  return (
    english.find((voice) => /natural|neural|online/i.test(voice.name)) ??
    english.find((voice) => /^en[-_]US$/i.test(voice.lang)) ??
    english[0] ??
    null
  );
}
