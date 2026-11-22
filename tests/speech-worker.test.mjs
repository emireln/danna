// The built-in voice's worker (electron/speech-worker.cjs), which runs in the voice's own process. It answers a speak
// request with the sound piece by piece and then done, stops a reading when asked, and reports a failure as done with
// the message. The engine is a stand-in here, so the test needs no model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { cpus } from 'node:os';

const require = createRequire(import.meta.url);
const { createWorker, defaultThreads } = require('../electron/speech-worker.cjs');

/** A message port: what the worker posts is recorded, and `send` delivers a message the way the parent port does. */
function fakePort() {
  const listeners = [];
  const port = {
    sent: [],
    postMessage: (message) => port.sent.push(message),
    on: (name, listener) => {
      if (name === 'message') listeners.push(listener);
    },
    send: (message) => listeners.forEach((listener) => listener({ data: message })),
  };
  return port;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

test('a speak request is answered with each piece of sound, and then done', async () => {
  const port = fakePort();
  const engine = {
    async *speakPieces(text, voice) {
      assert.equal(voice, 'af_heart');
      yield Buffer.from([1]);
      yield Buffer.from([2, 3]);
    },
  };
  createWorker({ port, engine });
  port.send({ type: 'speak', id: 'reading-1', text: 'Hi there.', voice: 'af_heart' });
  await settle();
  assert.deepEqual(
    port.sent.map((message) => message.type),
    ['chunk', 'chunk', 'done'],
  );
  assert.deepEqual([...port.sent[1].audio], [2, 3]);
  assert.equal(port.sent[2].id, 'reading-1');
  assert.equal(port.sent[2].error, undefined);
});

test('a stop request ends the reading that has that id', async () => {
  const port = fakePort();
  const engine = {
    async *speakPieces(text, voice, { signal }) {
      yield Buffer.from([1]);
      await new Promise((resolve) => signal.addEventListener('abort', resolve));
      yield Buffer.from([9]);
    },
  };
  createWorker({ port, engine });
  port.send({ type: 'speak', id: 'reading-2', text: 'A long text.', voice: 'af_heart' });
  await settle();
  port.send({ type: 'stop', id: 'reading-2' });
  await settle();
  assert.deepEqual(
    port.sent.map((message) => message.type),
    ['chunk', 'done'],
    'the piece after the stop is not sent',
  );
});

test('a failure is answered as done with its message', async () => {
  const port = fakePort();
  const engine = {
    // eslint-disable-next-line require-yield
    async *speakPieces() {
      throw new Error('The model could not be loaded.');
    },
  };
  createWorker({ port, engine });
  port.send({ type: 'speak', id: 'reading-3', text: 'Hi.', voice: 'af_heart' });
  await settle();
  assert.deepEqual(port.sent, [{ type: 'done', id: 'reading-3', error: 'The model could not be loaded.' }]);
});

test('the voice uses all but two processors, and never fewer than two', () => {
  assert.equal(defaultThreads(), Math.max(2, cpus().length - 2));
});
