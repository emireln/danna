// Tests the sound and text helpers of the live conversation: the sound formats, the reading of a voice (loudness, pitch,
// bands and the mouth), the cutting of a reply into sentences, the instructions, and the microphone worklet, which runs
// here in a sandbox with fake audio globals.
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
let analysis;
let sentences;
let prompt;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  pcm = await server.ssrLoadModule('/src/lib/live/pcm.ts');
  analysis = await server.ssrLoadModule('/src/lib/live/analysis.ts');
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

test('loudness reads speech, and silence is silent', () => {
  assert.equal(analysis.loudnessOf(new Float32Array(480)), 0);
  const loud = analysis.loudnessOf(sine(200, 16000, 0.1, 0.5));
  assert.ok(loud > 0.6 && loud <= 1, `a loud sine reads ${loud}`);
  assert.ok(analysis.loudnessOf(sine(200, 16000, 0.1, 0.005)) < 0.02, 'a very quiet sound reads as quiet');
});

test('the pitch of a steady voice is found, and silence has none', () => {
  const rate = 24000;
  for (const hz of [110, 180, 220, 300]) {
    const found = analysis.pitchOf(sine(hz, rate, 1024 / rate, 0.4), rate);
    assert.ok(Math.abs(found - hz) / hz < 0.03, `${hz} Hz reads ${found} Hz`);
  }
  assert.equal(analysis.pitchOf(new Float32Array(1024), rate), 0);
});

test('the energy of a sound sits in its bands', () => {
  const binHz = 24000 / 1024;
  const single = (hz) => {
    const bins = new Uint8Array(512);
    bins[Math.round(hz / binHz)] = 255;
    return bins;
  };
  const low = analysis.bandsOf(single(200), binHz);
  assert.ok(low.low > low.mid && low.low > low.high);
  const high = analysis.bandsOf(single(3000), binHz);
  assert.ok(high.high > high.low && high.high > high.mid);
});

test('the mouth opens with the voice, takes the shape of its energy, and closes when the voice stops', () => {
  assert.deepEqual(analysis.mouthFor(analysis.SILENCE, analysis.CLOSED_MOUTH, 0.1), { open: 0, round: 0, wide: 0 });
  const round = { level: 0.2, pitch: 0, low: 0.5, mid: 0.1, high: 0.05 };
  const wide = { level: 0.2, pitch: 0, low: 0.05, mid: 0.1, high: 0.5 };
  let roundMouth = analysis.CLOSED_MOUTH;
  let wideMouth = analysis.CLOSED_MOUTH;
  for (let i = 0; i < 20; i += 1) {
    roundMouth = analysis.mouthFor(round, roundMouth, 0.02);
    wideMouth = analysis.mouthFor(wide, wideMouth, 0.02);
  }
  assert.ok(roundMouth.open > 0.5 && roundMouth.round > roundMouth.wide, JSON.stringify(roundMouth));
  assert.ok(wideMouth.wide > wideMouth.round, JSON.stringify(wideMouth));
  let closing = roundMouth;
  for (let i = 0; i < 60; i += 1) closing = analysis.mouthFor(analysis.SILENCE, closing, 0.02);
  assert.ok(closing.open < 0.05, `the mouth closes, now ${closing.open}`);
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
