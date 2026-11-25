// Voices for listening practice and read-aloud. Three kinds of voice can read: the built-in voice (Kokoro, on this
// computer, no internet), the voices installed on this PC (Windows, read through the system speech service), and the
// natural voices of OpenAI and Google Gemini, which need the learner's own key. This file holds only the rules and the
// request bodies, so the tests can check them without the network or Windows. The calls themselves are elsewhere:
// ai.cjs (cloud), kokoro.cjs (built-in), winvoices.cjs (this PC), and speech-service.cjs (which chooses and streams).

/** The voices each cloud provider's speech model offers. */
const SPEECH_VOICES = Object.freeze({
  openai: Object.freeze(['coral', 'nova', 'onyx', 'sage', 'alloy', 'ash']),
  gemini: Object.freeze(['Kore', 'Zephyr', 'Puck', 'Charon']),
});

/** The voice used with "Automatic", and for a provider whose voice is not named. */
const DEFAULT_VOICE = Object.freeze({ openai: 'coral', gemini: 'Kore' });

/**
 * The voices built into Danna. Their files are bundled by scripts/fetch-tts-model.mjs, which lists the same ids.
 * The first letter of an id says the accent: a is American, b is British.
 */
const BUILTIN_VOICES = Object.freeze([
  Object.freeze({ id: 'af_heart', name: 'Heart', accent: 'us', gender: 'female' }),
  Object.freeze({ id: 'af_bella', name: 'Bella', accent: 'us', gender: 'female' }),
  Object.freeze({ id: 'af_nicole', name: 'Nicole', accent: 'us', gender: 'female' }),
  Object.freeze({ id: 'af_sarah', name: 'Sarah', accent: 'us', gender: 'female' }),
  Object.freeze({ id: 'am_michael', name: 'Michael', accent: 'us', gender: 'male' }),
  Object.freeze({ id: 'bf_emma', name: 'Emma', accent: 'uk', gender: 'female' }),
  Object.freeze({ id: 'bm_george', name: 'George', accent: 'uk', gender: 'male' }),
]);

const DEFAULT_BUILTIN = 'af_heart';
const BUILTIN_IDS = BUILTIN_VOICES.map((voice) => voice.id);

/** A voice installed on this PC is named by its system id, such as a registry path. These characters are allowed. */
const WINDOWS_ID = /^[A-Za-z0-9_.\\:\- ]{1,300}$/;

/** Every choice the learner can make, in the order of the Settings list. A Windows voice is named in full at choice time. */
const CHOICES = Object.freeze([
  'auto',
  // The old name of "Automatic" on this PC, read from settings saved by earlier versions.
  'device',
  ...BUILTIN_IDS.map((id) => `builtin:${id}`),
  ...SPEECH_VOICES.openai.map((voice) => `openai:${voice}`),
  ...SPEECH_VOICES.gemini.map((voice) => `gemini:${voice}`),
]);

function isVoiceChoice(value) {
  if (typeof value !== 'string') return false;
  if (CHOICES.includes(value)) return true;
  return value.startsWith('windows:') && WINDOWS_ID.test(value.slice('windows:'.length));
}

/** What the learner is told when a choice cannot be used as chosen. These are shown as they are, in Portuguese too. */
const NOTE = Object.freeze({
  needsKey: 'Add the key for this voice in Settings. Using the built-in voice for now.',
  noWindowsVoice: 'That voice is not installed on this PC any more. Using the built-in voice for now.',
  cloudFailed: 'The voice of your AI key could not be used. Using the built-in voice for now.',
  windowsFailed: 'The voice on this PC could not be used. Using the built-in voice for now.',
});

/**
 * The engine and the voice that read a text, for a choice.
 * `available` says which cloud providers have a key, and which voices on this PC are installed (null when that is not
 * known yet). The plan is never empty: the built-in voice is the fallback, and a note says why when it is used.
 */
function planSpeech(choice, available = {}) {
  const value = isVoiceChoice(choice) ? choice : 'auto';
  const chosen = value === 'device' ? 'auto' : value;
  const named = /^(openai|gemini):(.+)$/.exec(chosen);
  if (named) {
    if (available[named[1]]) return { engine: 'cloud', provider: named[1], voice: named[2] };
    return { engine: 'builtin', voice: DEFAULT_BUILTIN, note: NOTE.needsKey };
  }
  if (chosen.startsWith('builtin:')) {
    const id = chosen.slice('builtin:'.length);
    return { engine: 'builtin', voice: BUILTIN_IDS.includes(id) ? id : DEFAULT_BUILTIN };
  }
  if (chosen.startsWith('windows:')) {
    const id = chosen.slice('windows:'.length);
    const installed = Array.isArray(available.windows) ? available.windows : null;
    if (installed && !installed.includes(id)) return { engine: 'builtin', voice: DEFAULT_BUILTIN, note: NOTE.noWindowsVoice };
    return { engine: 'windows', id };
  }
  // Automatic: a cloud voice when the learner has a key for one, otherwise the built-in voice, which is always there.
  if (available.openai) return { engine: 'cloud', provider: 'openai', voice: DEFAULT_VOICE.openai };
  if (available.gemini) return { engine: 'cloud', provider: 'gemini', voice: DEFAULT_VOICE.gemini };
  return { engine: 'builtin', voice: DEFAULT_BUILTIN };
}

/** The longest text sent to a speech model. A listening passage is far shorter. */
const MAX_SPEECH_CHARS = 3500;

/** The text as it is read: one line, no extra spaces, and no more than the longest length. */
function speechText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SPEECH_CHARS);
}

/** How the speech should sound. Used by the newer OpenAI model, which follows instructions. */
const TEACHER_STYLE =
  'Speak as a warm, patient English teacher. Pronounce each word clearly, with natural rhythm and intonation, at a calm, moderate pace.';

// The older OpenAI model reads fewer voices, and takes no instructions.
const OLDER_OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

function openAISpeechBody(text, voice, model = 'gpt-4o-mini-tts') {
  if (model === 'gpt-4o-mini-tts') {
    return { model, voice, input: text, instructions: TEACHER_STYLE, response_format: 'mp3' };
  }
  return { model, voice: OLDER_OPENAI_VOICES.includes(voice) ? voice : 'nova', input: text, response_format: 'mp3' };
}

function geminiSpeechBody(text, voice) {
  return {
    contents: [
      {
        role: 'user',
        parts: [{ text: `Say the following clearly and naturally, like a patient English teacher:\n\n${text}` }],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };
}

/** The sample rate written in a mime type such as audio/L16;codec=pcm;rate=24000. */
function sampleRateOf(mime, fallback = 24000) {
  const match = /rate=(\d{4,6})/.exec(String(mime || ''));
  return match ? Number(match[1]) : fallback;
}

/** Wraps 16-bit mono PCM in a WAV header, so the browser can play it. */
function pcmToWav(pcm, sampleRate = 24000) {
  const data = Buffer.from(pcm);
  const bytes = data.length - (data.length % 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + bytes, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(bytes, 40);
  return Buffer.concat([header, data.subarray(0, bytes)]);
}

module.exports = {
  SPEECH_VOICES,
  DEFAULT_VOICE,
  BUILTIN_VOICES,
  DEFAULT_BUILTIN,
  CHOICES,
  NOTE,
  MAX_SPEECH_CHARS,
  TEACHER_STYLE,
  WINDOWS_ID,
  isVoiceChoice,
  planSpeech,
  speechText,
  openAISpeechBody,
  geminiSpeechBody,
  sampleRateOf,
  pcmToWav,
};
