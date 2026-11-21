// Tests the natural voices: the voice choices of the interface (src/lib/voices.ts) are the ones the app can make
// (electron/speech.cjs), the rule that picks a voice, the text that is read, the request bodies, the WAV header
// that makes Gemini's audio playable, and the two requests of ai.cjs (with a stand-in for the network).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
const speech = require('../electron/speech.cjs');
const ai = require('../electron/ai.cjs');
let server;
let voices;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  voices = await server.ssrLoadModule('/src/lib/voices.ts');
});

after(async () => {
  await server?.close();
});

test('the interface offers exactly the voice choices the app can make', () => {
  assert.deepEqual([...voices.LISTED_CHOICES].sort(), speech.CHOICES.filter((choice) => choice !== 'device').sort());
});

test('Automatic reads with a cloud voice when a key is there, and with the built-in voice otherwise', () => {
  assert.deepEqual(speech.planSpeech('auto', {}), { engine: 'builtin', voice: 'af_heart' });
  assert.deepEqual(speech.planSpeech('auto', { openai: true }), { engine: 'cloud', provider: 'openai', voice: 'coral' });
  assert.deepEqual(speech.planSpeech('auto', { gemini: true }), { engine: 'cloud', provider: 'gemini', voice: 'Kore' });
  assert.deepEqual(speech.planSpeech('auto', { openai: true, gemini: true }), { engine: 'cloud', provider: 'openai', voice: 'coral' });
  assert.deepEqual(speech.planSpeech('gemini:Puck', { openai: true, gemini: true }), { engine: 'cloud', provider: 'gemini', voice: 'Puck' });
  assert.deepEqual(speech.planSpeech('openai:unknown', { openai: true }), speech.planSpeech('auto', { openai: true }), 'an unknown voice is treated as Automatic');
});

test('a named cloud voice needs its own key, and says so when it is missing', () => {
  const plan = speech.planSpeech('openai:nova', { gemini: true });
  assert.equal(plan.engine, 'builtin');
  assert.equal(plan.note, speech.NOTE.needsKey);
});

test('the built-in voices are chosen by id, and the old device choice is Automatic', () => {
  assert.deepEqual(speech.planSpeech('builtin:bm_george', {}), { engine: 'builtin', voice: 'bm_george' });
  assert.deepEqual(speech.planSpeech('device', { openai: true }), { engine: 'cloud', provider: 'openai', voice: 'coral' });
  assert.equal(speech.planSpeech('device', {}).engine, 'builtin');
  assert.equal(voices.BUILTIN_VOICES.length, speech.BUILTIN_VOICES.length, 'the list in the interface has every built-in voice');
  assert.deepEqual(voices.BUILTIN_VOICES.map((voice) => voice.id), speech.BUILTIN_VOICES.map((voice) => voice.id));
});

test('a voice on this PC is chosen by its id, and a voice that has been removed falls back with a note', () => {
  assert.equal(speech.isVoiceChoice('windows:ID-1'), true);
  assert.equal(speech.isVoiceChoice('windows:bad;rm'), false, 'an id with odd characters is refused');
  assert.deepEqual(speech.planSpeech('windows:ID-1', { windows: ['ID-1'] }), { engine: 'windows', id: 'ID-1' });
  const gone = speech.planSpeech('windows:ID-2', { windows: ['ID-1'] });
  assert.equal(gone.engine, 'builtin');
  assert.equal(gone.note, speech.NOTE.noWindowsVoice);
  assert.equal(speech.planSpeech('windows:ID-2', { windows: null }).engine, 'windows', 'before the list is read, the id is tried');
});

test('the text read aloud is one line, and no longer than the limit', () => {
  assert.equal(speech.speechText('  Hello,\n\nworld.  '), 'Hello, world.');
  assert.equal(speech.speechText('x'.repeat(10000)).length, speech.MAX_SPEECH_CHARS);
  assert.equal(speech.speechText(null), '');
});

test('the newer OpenAI model follows the teaching style; the older one gets a voice it knows and no style', () => {
  assert.equal(speech.openAISpeechBody('Hi', 'coral', 'gpt-4o-mini-tts').instructions, speech.TEACHER_STYLE);
  const older = speech.openAISpeechBody('Hi', 'coral', 'tts-1');
  assert.equal(older.voice, 'nova');
  assert.equal(older.instructions, undefined);
});

test('the Gemini request asks for audio in the chosen voice', () => {
  const body = speech.geminiSpeechBody('Hello', 'Kore');
  assert.deepEqual(body.generationConfig.responseModalities, ['AUDIO']);
  assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Kore');
});

test('Gemini audio is 16-bit mono PCM, and the WAV header describes it', () => {
  const pcm = Buffer.alloc(480, 1);
  const wav = speech.pcmToWav(pcm, 24000);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt32LE(24), 24000, 'the sample rate');
  assert.equal(wav.readUInt16LE(22), 1, 'mono');
  assert.equal(wav.readUInt16LE(34), 16, '16 bits per sample');
  assert.equal(wav.readUInt32LE(40), pcm.length, 'the length of the sound');
  assert.equal(wav.length, 44 + pcm.length);
  assert.equal(speech.sampleRateOf('audio/L16;codec=pcm;rate=24000'), 24000);
  assert.equal(speech.sampleRateOf('audio/pcm'), 24000, 'a missing rate uses the usual one');
});

test('the device voice is the most natural English voice on the device', () => {
  const found = voices.pickDeviceVoice([
    { name: 'Microsoft David', lang: 'en-US' },
    { name: 'Microsoft Zira', lang: 'en-US' },
    { name: 'Microsoft Aria Online (Natural)', lang: 'en-US' },
    { name: 'Google português', lang: 'pt-BR' },
  ]);
  assert.equal(found.name, 'Microsoft Aria Online (Natural)');
  assert.equal(voices.pickDeviceVoice([{ name: 'Microsoft David', lang: 'en-GB' }, { name: 'Microsoft Zira', lang: 'en-US' }]).name, 'Microsoft Zira');
  assert.equal(voices.pickDeviceVoice([{ name: 'Voz', lang: 'pt-BR' }]), null);
});

test('the listening volume is a whole number from 0 to 100; full when nothing valid is given', () => {
  assert.equal(voices.DEFAULT_VOLUME, 100);
  assert.equal(voices.volumeLevel(55.4), 55);
  assert.equal(voices.volumeLevel(-5), 0);
  assert.equal(voices.volumeLevel(180), 100);
  assert.equal(voices.volumeLevel(0), 0);
  assert.equal(voices.volumeLevel('loud'), 100);
  assert.equal(voices.volumeLevel(Number.NaN), 100);
  assert.equal(voices.volumeLevel(undefined), 100);
});

test('reading aloud sends the text to OpenAI and returns its audio', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  };
  try {
    const result = await ai.speak('openai', 'sk-test-key-12345678', 'Read this.', 'coral');
    assert.equal(calls[0].url, 'https://api.openai.com/v1/audio/speech');
    assert.equal(calls[0].body.model, 'gpt-4o-mini-tts');
    assert.equal(calls[0].body.voice, 'coral');
    assert.equal(result.mime, 'audio/mpeg');
    assert.deepEqual([...result.bytes], [1, 2, 3]);
  } finally {
    globalThis.fetch = original;
  }
});

test('when the newer OpenAI model is not open to a key, the older one reads', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body.model);
    if (body.model === 'gpt-4o-mini-tts') return new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 });
    return new Response(new Uint8Array([9]), { status: 200 });
  };
  try {
    await ai.speak('openai', 'sk-test-key-12345678', 'Read this.', 'coral');
    assert.deepEqual(calls, ['gpt-4o-mini-tts', 'tts-1']);
  } finally {
    globalThis.fetch = original;
  }
});
