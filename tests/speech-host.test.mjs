// The built-in voice's host (electron/speech-host.cjs). The voice runs in its own process: the host starts it on the first
// request, sends it each text, passes the sound back piece by piece, stops it when asked, and starts it again when it has
// stopped. The process is a stand-in here, so the test needs no model and no Electron.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSpeechHost } = require('../electron/speech-host.cjs');

/** A stand-in for a utility process: what the host posts is recorded, and the test answers with `answer`. */
function fakeChild(pid = 4242) {
  const child = new EventEmitter();
  child.pid = pid;
  child.sent = [];
  child.postMessage = (message) => child.sent.push(message);
  child.answer = (message) => child.emit('message', message);
  child.die = () => child.emit('exit', 1);
  return child;
}

function hostWith(children, options = {}) {
  return createSpeechHost({
    available: options.available ?? (() => true),
    fork: () => {
      const child = fakeChild();
      children.push(child);
      return child;
    },
    setPriority: options.setPriority ?? (() => undefined),
  });
}

test('the voice starts on the first request, gets the text, and passes the sound back piece by piece', async () => {
  const children = [];
  const host = hostWith(children);
  const iterator = host.speakPieces('Hello there.', 'af_heart')[Symbol.asyncIterator]();
  const first = iterator.next();
  assert.equal(children.length, 1, 'the voice was started');
  const [request] = children[0].sent;
  assert.equal(request.type, 'speak');
  assert.equal(request.text, 'Hello there.');
  assert.equal(request.voice, 'af_heart');
  children[0].answer({ type: 'chunk', id: request.id, audio: new Uint8Array([1, 2]) });
  assert.deepEqual([...(await first).value], [1, 2]);
  children[0].answer({ type: 'done', id: request.id });
  assert.equal((await iterator.next()).done, true, 'the reading ends when the voice says it is done');
});

test('the same voice serves every request, so the model is loaded once', async () => {
  const children = [];
  const host = hostWith(children);
  for (const text of ['One.', 'Two.']) {
    const iterator = host.speakPieces(text, 'af_heart')[Symbol.asyncIterator]();
    const pending = iterator.next();
    children[children.length - 1].answer({ type: 'done', id: children[children.length - 1].sent.at(-1).id });
    await pending;
  }
  assert.equal(children.length, 1);
  assert.deepEqual(children[0].sent.map((message) => message.text), ['One.', 'Two.']);
});

test('stopping a reading tells the voice to stop it, and the reading ends', async () => {
  const children = [];
  const host = hostWith(children);
  const controller = new AbortController();
  const iterator = host.speakPieces('A long text.', 'af_heart', { signal: controller.signal })[Symbol.asyncIterator]();
  const pending = iterator.next();
  const [request] = children[0].sent;
  controller.abort();
  assert.deepEqual(children[0].sent.at(-1), { type: 'stop', id: request.id });
  children[0].answer({ type: 'done', id: request.id });
  assert.equal((await pending).done, true);
});

test('a voice that stops unexpectedly ends the reading with a message, and the next request starts it again', async () => {
  const children = [];
  const host = hostWith(children);
  const iterator = host.speakPieces('Hello.', 'af_heart')[Symbol.asyncIterator]();
  const pending = iterator.next();
  children[0].die();
  await assert.rejects(pending, /stopped unexpectedly/);
  const again = host.speakPieces('Again.', 'af_heart')[Symbol.asyncIterator]();
  const second = again.next();
  assert.equal(children.length, 2, 'a new voice was started');
  children[1].answer({ type: 'done', id: children[1].sent[0].id });
  await second;
});

test('a voice that reports an error ends the reading with that message', async () => {
  const children = [];
  const host = hostWith(children);
  const iterator = host.speakPieces('Hello.', 'af_heart')[Symbol.asyncIterator]();
  const pending = iterator.next();
  children[0].answer({ type: 'done', id: children[0].sent[0].id, error: 'The built-in voice is not installed.' });
  await assert.rejects(pending, /not installed/);
});

test('the voice runs at a lower priority than the window, once it has started', () => {
  const children = [];
  const priorities = [];
  const host = hostWith(children, { setPriority: (pid) => priorities.push(pid) });
  host.speakPieces('Hello.', 'af_heart')[Symbol.asyncIterator]().next();
  children[0].emit('spawn');
  assert.deepEqual(priorities, [4242]);
});

test('the host says whether a voice can read, without starting the process', () => {
  const children = [];
  const host = hostWith(children, { available: (voice) => voice === 'af_heart' });
  assert.equal(host.available('af_heart'), true);
  assert.equal(host.available('bm_george'), false);
  assert.equal(children.length, 0, 'asking does not start the voice');
});
