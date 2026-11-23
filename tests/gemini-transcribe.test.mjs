// Tests the transcription of a recording with a Gemini key (electron/ai.cjs), with a stand-in for the network: the request
// carries the WAV as inline audio, the words come back as text, and only a model the key cannot use moves on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ai = require('../electron/ai.cjs');

const KEY = 'AIzaTestKey-1234567890abcdef';

/** Runs the code with fetch answering from the list, in order, and returns what was asked. */
async function withFetch(replies, run) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return replies.shift();
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

const answer = (text) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });

test('a recording goes to Gemini as inline WAV audio, and the words come back as text', async () => {
  const wav = Buffer.from('RIFF0000WAVEfmt example bytes');
  const text = await withFetch([answer('  The keys are on the table. \n')], async (calls) => {
    const result = await ai.transcribeWithGemini(KEY, wav, 'audio/wav');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    assert.equal(calls[0].headers['x-goog-api-key'], KEY, 'the key travels in the header, not the address');
    const [prompt, audio] = calls[0].body.contents[0].parts;
    assert.equal(typeof prompt.text, 'string');
    assert.equal(audio.inline_data.mime_type, 'audio/wav');
    assert.equal(Buffer.from(audio.inline_data.data, 'base64').equals(wav), true, 'the audio arrives unchanged');
    assert.equal(calls[0].body.generationConfig.temperature, 0);
    return result;
  });
  assert.equal(text, 'The keys are on the table.');
});

test('when a model is not open to the key, the next one is tried; another failure stops there', async () => {
  await withFetch([new Response('{"error":{"message":"model not found"}}', { status: 404 }), answer('Hello.')], async (calls) => {
    assert.equal(await ai.transcribeWithGemini(KEY, Buffer.from([1, 2]), 'audio/wav'), 'Hello.');
    assert.deepEqual(
      calls.map((call) => call.url.split('/models/')[1].split(':')[0]),
      ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    );
  });
  await withFetch([new Response('{"error":{"message":"busy"}}', { status: 429 })], async (calls) => {
    await assert.rejects(
      ai.transcribeWithGemini(KEY, Buffer.from([1]), 'audio/wav'),
      (error) => /busy right now/.test(String(error.message)),
    );
    assert.equal(calls.length, 1, 'a busy service is not asked again at once');
  });
});

test('a recording with no words gives an empty text', async () => {
  await withFetch([new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP' }] }), { status: 200 })], async () => {
    assert.equal(await ai.transcribeWithGemini(KEY, Buffer.from([0, 0]), 'audio/wav'), '');
  });
});
