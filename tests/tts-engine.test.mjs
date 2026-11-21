// The built-in voice (electron/kokoro.cjs): the text rules, the phonemes' ids, the style rows of a voice, the pieces
// of a long text and the WAV file. The model itself is run with stand-ins for ONNX Runtime and the phonemizer, so the
// test needs no model. A test at the end runs the real model when the files are on this computer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const kokoro = require('../electron/kokoro.cjs');
const speech = require('../electron/speech.cjs');

test('the text is read the way the model expects: abbreviations, money, years and times become words', () => {
  assert.equal(kokoro.normalizeText('Dr. Smith paid $3.50 in 1999.'), 'Doctor Smith paid 3 dollars and 50 cents in 19 99.');
  assert.equal(kokoro.normalizeText('It is 3:30 now.'), 'It is 3 30 now.');
  assert.equal(kokoro.normalizeText('“Hi,” he said (quietly).'), '"Hi," he said «quietly».');
});

test('the punctuation between the words is kept as it is, and only the words are sent to the phonemizer', () => {
  const parts = kokoro.segments('Hello, there. Good!');
  assert.deepEqual(
    parts.map((part) => part.spoken),
    [true, false, true, false, true, false],
  );
  assert.equal(parts.filter((part) => part.spoken).map((part) => part.text).join('|'), 'Hello|there|Good');
});

test('the ids of the phonemes start and end with the mark 0, and a symbol the model does not know becomes 0', () => {
  const tokenizer = { keep: /[^ abc]/g, vocab: { a: 11, b: 12, c: 13 } };
  assert.deepEqual(kokoro.tokenize('ab c', tokenizer), [0, 11, 12, 0, 13, 0]);
  assert.deepEqual(kokoro.tokenize('a?b', tokenizer), [0, 11, 12, 0], 'a character the model does not keep is dropped');
  assert.deepEqual(kokoro.tokenize('', tokenizer), [0, 0]);
});

test('the style row of a voice follows the length of the text, and stays inside the table', () => {
  const data = new Float32Array(510 * 256);
  for (let row = 0; row < 510; row += 1) data.fill(row, row * 256, row * 256 + 256);
  assert.equal(kokoro.styleFor(data, 2)[0], 0, 'an empty text uses the first row');
  assert.equal(kokoro.styleFor(data, 12)[0], 10, 'ten phonemes use row ten');
  assert.equal(kokoro.styleFor(data, 9999).length, 256, 'a very long text stays in the table');
  assert.equal(kokoro.styleFor(data, 9999)[0], 509, 'and uses the last row');
});

test('a long text is cut into pieces that keep every word, each no longer than the limit', () => {
  const text = 'Hello there. This is a longer sentence that goes on and on for a while so that it has to be cut. Short one.';
  const pieces = kokoro.speechPieces(text, 40);
  assert.ok(pieces.every((piece) => piece.length <= 40), 'no piece is too long');
  assert.equal(pieces.join(' '), text, 'no word is lost or repeated');
  assert.deepEqual(kokoro.speechPieces('   '), []);
  assert.equal(kokoro.speechPieces('One short sentence.').length, 1);
});

test('the samples become a 16-bit mono WAV file at 24 kHz, and values past the ends are held at the ends', () => {
  const wav = kokoro.wavFromSamples(Float32Array.of(0, 1, -1, 2));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), 8, 'four samples of two bytes');
  // The samples start after the 44-byte header.
  assert.equal(wav.readInt16LE(44), 0);
  assert.equal(wav.readInt16LE(46), 32767);
  assert.equal(wav.readInt16LE(48), -32767);
  assert.equal(wav.readInt16LE(50), 32767, 'a value above one is held at the top');
});

test('the built-in voices have their files, and the stand-in engine makes one WAV file for each piece', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'danna-tts-'));
  try {
    mkdirSync(join(dir, 'voices'));
    writeFileSync(join(dir, 'model.onnx'), 'stand-in');
    writeFileSync(
      join(dir, 'tokenizer.json'),
      JSON.stringify({ normalizer: { pattern: { Regex: '[^ a-z.,!?]' } }, model: { vocab: { $: 0, h: 1, i: 2, o: 3, a: 4, t: 5, s: 6, ' ': 7 } } }),
    );
    const voice = new Float32Array(510 * 256);
    for (let row = 0; row < 510; row += 1) voice.fill(row / 1000, row * 256, row * 256 + 256);
    writeFileSync(join(dir, 'voices', 'af_heart.bin'), Buffer.from(voice.buffer));

    const runs = [];
    const runtime = {
      Tensor: class {
        constructor(type, data, dims) {
          Object.assign(this, { type, data, dims });
        }
      },
      InferenceSession: {
        create: async (file) => {
          assert.ok(file.endsWith('model.onnx'));
          return {
            run: async (feeds) => {
              runs.push(feeds);
              return { waveform: { data: new Float32Array(2400).fill(0.25) } };
            },
          };
        },
      },
    };
    const phonemize = async (text) => [text.toLowerCase().replace(/[^a-z ]/g, '').replace(/ +/g, ' ').trim()];
    const engine = kokoro.createSpeechEngine({
      modelDir: dir,
      loadRuntime: () => runtime,
      loadPhonemizer: () => ({ phonemize }),
    });
    assert.equal(engine.available('af_heart'), true);
    assert.equal(engine.available('bm_george'), false, 'a voice that is not bundled is not available');

    const pieces = [];
    for await (const wav of engine.speakPieces('Hi there. It is sunny.', 'af_heart')) pieces.push(wav);
    assert.equal(pieces.length, 1, 'a short text is one piece');
    assert.equal(pieces[0].toString('ascii', 0, 4), 'RIFF');

    const feeds = runs[0];
    assert.equal(feeds.input_ids.type, 'int64');
    assert.equal(feeds.input_ids.data[0], 0n, 'the text starts with the mark 0');
    assert.equal(feeds.input_ids.data[feeds.input_ids.data.length - 1], 0n, 'and ends with it');
    assert.deepEqual(feeds.style.dims, [1, 256]);
    assert.ok(Math.abs(feeds.speed.data[0] - kokoro.SPEED) < 1e-6, 'the speed is the one the engine sets');
    const phonemeCount = feeds.input_ids.dims[1] - 2;
    assert.ok(Math.abs(feeds.style.data[0] - phonemeCount / 1000) < 1e-6, 'the style row is the one for this length');

    const stopped = new AbortController();
    stopped.abort();
    const none = [];
    for await (const wav of engine.speakPieces('Hi there.', 'af_heart', { signal: stopped.signal })) none.push(wav);
    assert.equal(none.length, 0, 'an aborted reading makes no sound');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the real built-in voice reads a sentence with sound, when its files are on this computer', { skip: !existsSync(join(root, 'resources', 'tts', 'kokoro', 'model.onnx')) }, async () => {
  const engine = kokoro.createSpeechEngine({ modelDir: join(root, 'resources', 'tts', 'kokoro') });
  const pieces = [];
  for await (const wav of engine.speakPieces('Hello! This is the built in voice, reading a short sentence.', speech.DEFAULT_BUILTIN)) {
    pieces.push(wav);
  }
  assert.ok(pieces.length >= 1);
  const pcm = Buffer.concat(pieces.map((wav) => wav.subarray(44)));
  const seconds = pcm.length / 2 / 24000;
  assert.ok(seconds > 1.5 && seconds < 15, `a sentence of about three seconds, got ${seconds.toFixed(2)}`);
  let sum = 0;
  for (let index = 0; index < pcm.length; index += 2) sum += (pcm.readInt16LE(index) / 32767) ** 2;
  assert.ok(Math.sqrt(sum / (pcm.length / 2)) > 0.01, 'the sound is not silence');
});
