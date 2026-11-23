// Tests the WAV file the voice is sent in: its header, its length, and how each sample is written.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let audio;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  audio = await server.ssrLoadModule('/src/lib/audioWav.ts');
});

after(async () => {
  await server?.close();
});

const text = (view, offset, length) => String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + offset, length));

test('a WAV file has a 44-byte header for mono 16-bit PCM at the given rate, then the samples', () => {
  const buffer = audio.encodeWav(new Float32Array([0, 0.5, -0.5, 1]), 16000);
  assert.equal(buffer.byteLength, 44 + 8);
  const view = new DataView(buffer);
  assert.equal(text(view, 0, 4), 'RIFF');
  assert.equal(view.getUint32(4, true), 36 + 8, 'the size after the first eight bytes');
  assert.equal(text(view, 8, 4), 'WAVE');
  assert.equal(text(view, 12, 4), 'fmt ');
  assert.equal(view.getUint32(16, true), 16);
  assert.equal(view.getUint16(20, true), 1, 'PCM');
  assert.equal(view.getUint16(22, true), 1, 'one channel');
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint32(28, true), 32000, 'bytes per second');
  assert.equal(view.getUint16(32, true), 2, 'bytes per sample');
  assert.equal(view.getUint16(34, true), 16, 'bits per sample');
  assert.equal(text(view, 36, 4), 'data');
  assert.equal(view.getUint32(40, true), 8);
});

test('samples are written as 16-bit numbers, and a sample beyond full scale is held to it', () => {
  const view = new DataView(audio.encodeWav(new Float32Array([0, 0.5, 1, -1, 2, -2]), 16000));
  const written = [0, 1, 2, 3, 4, 5].map((index) => view.getInt16(44 + index * 2, true));
  assert.deepEqual(written, [0, Math.trunc(0.5 * 0x7fff), 32767, -32768, 32767, -32768]);
});
