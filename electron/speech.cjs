// Natural voices for listening practice. The voices come from the speech models of OpenAI and Google Gemini,
// with the keys the learner already added. This file holds only the rules and the request bodies, so the tests
// can check them without the network. The calls themselves are in ai.cjs.

/** The voices each provider's speech model offers. */
const SPEECH_VOICES = Object.freeze({
  openai: Object.freeze(['coral', 'nova', 'onyx', 'sage', 'alloy', 'ash']),
  gemini: Object.freeze(['Kore', 'Zephyr', 'Puck', 'Charon']),
});

/** The voice used with "Automatic", and for a provider whose voice is not named. */
const DEFAULT_VOICE = Object.freeze({ openai: 'coral', gemini: 'Kore' });

/** Every choice the learner can make: automatic, the device voice, or one named voice. */
const CHOICES = Object.freeze([
  'auto',
  'device',
  ...SPEECH_VOICES.openai.map((voice) => `openai:${voice}`),
  ...SPEECH_VOICES.gemini.map((voice) => `gemini:${voice}`),
]);

const isVoiceChoice = (value) => typeof value === 'string' && CHOICES.includes(value);

/**
 * The provider and the voice that read a text, for a choice. `available` says which providers have a key.
 * Returns null when the device voice has to read it: the learner chose it, or no key can make a natural voice.
 */
function pickSpeech(choice, available = {}) {
  if (!isVoiceChoice(choice) || choice === 'device') return null;
  const named = /^(openai|gemini):(.+)$/.exec(choice);
  if (named) return available[named[1]] ? { provider: named[1], voice: named[2] } : null;
  if (available.openai) return { provider: 'openai', voice: DEFAULT_VOICE.openai };
  if (available.gemini) return { provider: 'gemini', voice: DEFAULT_VOICE.gemini };
  return null;
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
  CHOICES,
  MAX_SPEECH_CHARS,
  TEACHER_STYLE,
  isVoiceChoice,
  pickSpeech,
  speechText,
  openAISpeechBody,
  geminiSpeechBody,
  sampleRateOf,
  pcmToWav,
};
