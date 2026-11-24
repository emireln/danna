// Tests the sound of the live talk: the sound formats (pcm.ts), the sentences of a reply as they are written
// (sentences.ts), the instructions of the coach (prompt.ts), and the microphone worklet that turns the learner's voice
// into frames (public/mic-worklet.js). The coach's face and lip-sync are TalkingHead's, tested in live-voice.test.mjs.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let pcm;
let sentences;
let prompt;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  pcm = await server.ssrLoadModule('/src/lib/live/pcm.ts');
  sentences = await server.ssrLoadModule('/src/lib/live/sentences.ts');
  prompt = await server.ssrLoadModule('/src/lib/live/prompt.ts');
});

after(async () => {
  await server?.close();
});

const sine = (hz, rate, seconds, amplitude = 0.5) =>
  Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / rate));

test('the sound formats convert both ways, clamped, little-endian, and read a view of a bigger buffer', () => {
  const samples = pcm.floatToPcm16(Float32Array.of(0, 1, -1, 2, -2, 0.5));
  assert.deepEqual([...samples], [0, 32767, -32768, 32767, -32768, 16383]);
  const back = pcm.pcm16ToFloat(new Uint8Array(samples.buffer));
  assert.ok(Math.abs(back[1] - 1) < 1e-4 && Math.abs(back[2] + 1) < 1e-4);
  assert.equal(pcm.pcm16ToFloat(new Uint8Array([1, 0, 9])).length, 1, 'a trailing odd byte is left out');
  const bigger = new Uint8Array([9, 9, 0, 64, 9]);
  assert.ok(Math.abs(pcm.pcm16ToFloat(bigger.subarray(2, 4))[0] - 0.5) < 1e-4);
});

test('a reply is cut into sentences as it is written, and the rest waits for more', () => {
  assert.deepEqual(sentences.takeSentences('Hi there. How are you? I am'), { sentences: ['Hi there.', 'How are you?'], rest: ' I am' });
  assert.deepEqual(sentences.takeSentences('Hi there. How are you? I am', true), {
    sentences: ['Hi there.', 'How are you?', 'I am'],
    rest: '',
  });
  assert.deepEqual(sentences.takeSentences('Good'), { sentences: [], rest: 'Good' });
  assert.deepEqual(sentences.takeSentences('Line one\nLine two'), { sentences: ['Line one'], rest: 'Line two' });
  assert.deepEqual(sentences.takeSentences('Wait… what?  Yes.'), { sentences: ['Wait…', 'what?'], rest: '  Yes.' });
  assert.deepEqual(sentences.takeSentences('She said "wow." Then left.'), { sentences: ['She said "wow."'], rest: ' Then left.' });
});

test('the markdown of a reply is left out when it is read aloud', () => {
  assert.equal(sentences.toSpeech('**Good** job.\n- Try `went`\n# Next'), 'Good job.\nTry went\nNext');
});

test('the instructions give the persona, the rules and the learner facts, with Portuguese only when the learner speaks it', () => {
  const facts = '- Level B1.';
  const english = prompt.liveInstructions({ persona: 'Pip', facts, language: 'en' });
  assert.match(english, /You are Pip, a friendly English coach/);
  assert.ok(!english.includes('{persona}'));
  assert.ok(english.endsWith(facts));
  assert.ok(!/Portuguese/.test(english));
  assert.match(prompt.liveInstructions({ persona: 'Luna', facts, language: 'pt' }), /speaks Portuguese/);
  assert.ok(prompt.liveInstructions({ persona: 'Luna', facts, language: 'en', mode: 'Mode text.' }).endsWith('Mode text.'));
});

test('the microphone worklet turns the sound into 16 kHz frames of 40 ms, and keeps the pitch of the sound', async () => {
  const source = await readFile(join(root, 'public', 'mic-worklet.js'), 'utf8');
  const frames = [];
  let Processor = null;
  const sandbox = {
    sampleRate: 48000,
    AudioWorkletProcessor: class {
      constructor() {
        this.port = { postMessage: (message) => frames.push(message) };
      }
    },
    registerProcessor: (name, processor) => {
      assert.equal(name, 'danna-mic');
      Processor = processor;
    },
  };
  vm.runInNewContext(source, sandbox);
  const mic = new Processor();
  const tone = sine(440, 48000, 1, 0.5);
  for (let start = 0; start < tone.length; start += 128) mic.process([[tone.subarray(start, start + 128)]]);
  assert.ok(frames.length >= 24 && frames.length <= 25, `${frames.length} frames for one second`);
  assert.equal(new Int16Array(frames[0].pcm).length, 640);
  assert.ok(frames[0].level > 0.9, 'a loud tone reads loud');
  const samples = frames.flatMap((frame) => [...new Int16Array(frame.pcm)]);
  let crossings = 0;
  for (let i = 1; i < samples.length; i += 1) if (samples[i - 1] < 0 !== samples[i] < 0) crossings += 1;
  const perSecond = crossings / (samples.length / 16000);
  assert.ok(Math.abs(perSecond - 880) < 880 * 0.03, `440 Hz gives ${perSecond} crossings a second`);
});
