// Reading a text aloud (electron/speech-service.cjs): the voice that reads, the fallbacks and their notes, the sounds
// that come back, the keeping of a finished text, stopping, and the list of voices. The three engines are stand-ins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSpeechService } = require('../electron/speech-service.cjs');
const speech = require('../electron/speech.cjs');

const ID = 'reading-0001';

function stand({ builtinReady = true, pieces = ['one', 'two'], windowsFails = false, cloudFails = false, cloudSound = true, keys = {} } = {}) {
  const calls = { kokoro: 0, windows: 0, cloud: 0 };
  const kokoro = {
    available: () => builtinReady,
    async *speakPieces(text, voice, { signal } = {}) {
      calls.kokoro += 1;
      for (const piece of pieces) {
        if (signal && signal.aborted) return;
        yield Buffer.from(`${voice}:${piece}`);
      }
    },
  };
  const windows = {
    known: () => null,
    list: async () => ({
      voices: [{ id: 'win-aria', name: 'Microsoft Aria', language: 'en-US', gender: 'female', natural: true }],
      recommended: 'win-aria',
      error: null,
    }),
    async synthesize(text, id) {
      calls.windows += 1;
      if (windowsFails) throw new Error('The voice on this PC could not speak.');
      return Buffer.from(`win:${id}:${text}`);
    },
  };
  const cloud = {
    async speak(provider, key, text, voice) {
      calls.cloud += 1;
      if (cloudFails) throw new Error('Network error.');
      if (!cloudSound) return { bytes: Buffer.alloc(0), mime: 'audio/mpeg' };
      return { bytes: Buffer.from(`${provider}:${voice}:${text}`), mime: 'audio/mpeg' };
    },
  };
  const service = createSpeechService({
    kokoro,
    windows,
    cloud,
    hasKey: (provider) => Boolean(keys[provider]),
    getKey: (provider) => keys[provider] ?? null,
  });
  return { service, calls };
}

/** Starts a reading and waits until it is done. Returns the reply of the start and every event, in order. */
function read(service, { id = ID, text = 'Hello there. Nice to meet you.', choice = 'auto' } = {}) {
  const events = [];
  let finish;
  const done = new Promise((resolve) => {
    finish = resolve;
  });
  // A reading can finish inside the call itself (a kept text), so the reply is read after the call has returned.
  const reply = service.start({ id, text, choice }, (event) => {
    events.push(event);
    if (event.done) finish();
  });
  return done.then(() => ({ reply, events }));
}

test('the built-in voice reads by default, and each piece of the sound is sent as it is made', async () => {
  const { service, calls } = stand({ pieces: ['first', 'second'] });
  const { reply, events } = await read(service);
  assert.deepEqual(reply, { engine: 'builtin', voice: 'af_heart', note: null });
  assert.equal(calls.kokoro, 1);
  const sounds = events.filter((event) => event.audio);
  assert.equal(sounds.length, 2);
  assert.equal(sounds[0].audio.toString(), 'af_heart:first');
  assert.equal(sounds[0].mime, 'audio/wav');
  assert.equal(events.at(-1).done, true);
  assert.equal(events.at(-1).error, undefined);
});

test('a finished text is kept, so reading it again sends the same sound without making it again', async () => {
  const { service, calls } = stand();
  await read(service);
  const again = await read(service, { id: 'reading-0002' });
  assert.equal(calls.kokoro, 1, 'the model ran once');
  assert.equal(again.events.filter((event) => event.audio).length, 2);
});

test('with an AI key, Automatic reads with the cloud voice, and its sound keeps its own type', async () => {
  const { service, calls } = stand({ keys: { openai: true } });
  const { reply, events } = await read(service);
  assert.equal(reply.engine, 'cloud');
  assert.equal(calls.cloud, 1);
  assert.equal(events[0].mime, 'audio/mpeg');
  assert.equal(events[0].audio.toString(), 'openai:coral:Hello there. Nice to meet you.');
});

test('a voice from this PC reads when it is chosen', async () => {
  const { service, calls } = stand();
  const { reply, events } = await read(service, { choice: 'windows:win-aria' });
  assert.equal(reply.engine, 'windows');
  assert.equal(calls.windows, 1);
  assert.equal(events[0].audio.toString(), 'win:win-aria:Hello there. Nice to meet you.');
});

test('when a voice on this PC cannot speak, the built-in voice reads, and a note says so', async () => {
  const { service, calls } = stand({ windowsFails: true });
  const { events } = await read(service, { choice: 'windows:win-aria' });
  const note = events.find((event) => event.note);
  assert.equal(note.note, speech.NOTE.windowsFailed);
  assert.equal(events.filter((event) => event.audio)[0].audio.toString(), 'af_heart:one');
  assert.equal(calls.kokoro, 1);
  assert.equal(events.at(-1).error, undefined, 'the reading still finishes');
});

test('a cloud voice that fails before any sound falls back to the built-in voice, with a note', async () => {
  const { service } = stand({ cloudFails: true, keys: { gemini: true } });
  const { events } = await read(service);
  assert.equal(events.find((event) => event.note).note, speech.NOTE.cloudFailed);
  assert.ok(events.some((event) => event.audio && event.audio.toString().startsWith('af_heart')));
});

test('a named cloud voice without its key is not used: the reply carries the note, and the built-in voice reads', async () => {
  const { service } = stand();
  const reply = service.start({ id: 'reading-0003', text: 'Hi there.', choice: 'openai:nova' }, () => undefined);
  assert.equal(reply.engine, 'builtin');
  assert.equal(reply.note, speech.NOTE.needsKey);
});

test('a text that is empty, or an id that is not right, is refused before anything runs', () => {
  const { service, calls } = stand();
  assert.throws(() => service.start({ id: ID, text: '   ', choice: 'auto' }, () => undefined), /nothing to read aloud/);
  assert.throws(() => service.start({ id: 'bad id', text: 'Hi.', choice: 'auto' }, () => undefined), /could not be started/);
  assert.equal(calls.kokoro, 0);
});

test('stopping a reading ends it at once, and no more sound is sent', async () => {
  let release;
  const kokoro = {
    available: () => true,
    async *speakPieces(text, voice, { signal }) {
      yield Buffer.from('first');
      await new Promise((resolve) => {
        release = resolve;
        signal.addEventListener('abort', resolve);
      });
      if (!signal.aborted) yield Buffer.from('never');
    },
  };
  const service = createSpeechService({
    kokoro,
    windows: { known: () => null, list: async () => ({ voices: [], recommended: null, error: null }), synthesize: async () => Buffer.alloc(0) },
    cloud: { speak: async () => ({ bytes: Buffer.alloc(0), mime: 'audio/mpeg' }) },
    hasKey: () => false,
    getKey: () => null,
  });
  const events = [];
  const finished = new Promise((resolve) => {
    service.start({ id: ID, text: 'A long reading.', choice: 'auto' }, (event) => {
      events.push(event);
      if (event.done) resolve();
    });
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(service.stop(ID), { stopped: true });
  await finished;
  assert.equal(events.filter((event) => event.audio).length, 1, 'only the first sound was sent');
  assert.equal(events.at(-1).error, undefined);
  assert.equal(typeof release, 'function');
  assert.deepEqual(service.stop(ID), { stopped: false }, 'a reading that has ended cannot be stopped again');
});

test('when the built-in voice is not in this copy, the reading ends with a message', async () => {
  const { service } = stand({ builtinReady: false });
  const { events } = await read(service);
  assert.equal(events.at(-1).error, 'The built-in voice is not installed.');
});

test('the voices the learner can choose are the built-in ones, the ones on this PC, and whether each cloud key is there', async () => {
  const { service } = stand({ keys: { openai: true } });
  const voices = await service.voices();
  assert.equal(voices.builtin.length, speech.BUILTIN_VOICES.length);
  assert.ok(voices.builtin.every((voice) => voice.ready === true));
  assert.equal(voices.windows[0].id, 'win-aria');
  assert.equal(voices.recommended, 'win-aria');
  assert.deepEqual(voices.cloud, { openai: true, gemini: false });
});
