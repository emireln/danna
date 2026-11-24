// Tests the coach's voice of the talk (src/lib/live/voice.ts) and the times of the words (wordTiming.ts) with a fake
// avatar: the Gemini stream (its audio, its words, its turns, its interruptions), the typed sentences (in order, once
// whole, and idle when the last one is said), and the rule that a stale end signal changes nothing.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let voice;
let timing;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  voice = await server.ssrLoadModule('/src/lib/live/voice.ts');
  timing = await server.ssrLoadModule('/src/lib/live/wordTiming.ts');
});

after(async () => {
  await server?.close();
});

/** A fake avatar: it records the calls the voice makes, and lets the test end the sounds itself. */
function fakeHead() {
  const calls = [];
  const head = {
    calls,
    starts: [],
    speeches: [],
    async decode(pieces) {
      calls.push(['decode', pieces.length]);
      const bytes = pieces.reduce((sum, piece) => sum + piece.byteLength, 0);
      return bytes === 0 ? null : { duration: bytes / 1000 };
    },
    async streamStart(onAudioStart, onAudioEnd) {
      calls.push(['streamStart']);
      head.starts.push({ onAudioStart, onAudioEnd });
    },
    streamAudio(chunk) {
      calls.push(['streamAudio', chunk]);
    },
    streamNotifyEnd() {
      calls.push(['streamNotifyEnd']);
    },
    streamInterrupt() {
      calls.push(['streamInterrupt']);
    },
    streamStop() {
      calls.push(['streamStop']);
    },
    speak(buffer, words, wtimes, wdurations, onDone) {
      calls.push(['speak', words.join(' ')]);
      head.speeches.push({ buffer, words, wtimes, wdurations, onDone });
    },
    stopSpeaking() {
      calls.push(['stopSpeaking']);
    },
  };
  return head;
}

const streamAudioCalls = (head) => head.calls.filter((call) => call[0] === 'streamAudio').map((call) => call[1]);

test('words are timed from a start, with a gap between them, and fill the length of the audio when it is known', () => {
  assert.deepEqual(timing.splitWords('  Hello   there\nfriend '), ['Hello', 'there', 'friend']);
  assert.deepEqual(timing.splitWords('   '), []);
  assert.ok(timing.wordMs('a') >= 160 && timing.wordMs('understanding') <= 650);
  const natural = timing.wordSchedule(['go', 'home'], 100);
  assert.equal(natural.wtimes[0], 100);
  assert.equal(natural.wtimes[1], 100 + natural.wdurations[0] + timing.GAP_MS);
  const fitted = timing.wordSchedule(['one', 'two', 'three'], 0, 1500);
  const end = fitted.wtimes[2] + fitted.wdurations[2];
  assert.ok(Math.abs(end - 1500) <= 3, `the last word ends with the audio, at ${end} ms`);
  assert.deepEqual(timing.wordSchedule([], 40, 900), { wtimes: [], wdurations: [], endMs: 40 });
});

test('the Gemini voice streams the model’s audio, and its words follow the audio in order', async () => {
  const head = fakeHead();
  const v = voice.createLiveVoice(head);
  await v.begin('gemini');
  assert.deepEqual(head.calls[0], ['streamStart']);
  v.pushWords('Hi there');
  v.pushPcm(new Uint8Array([1, 2, 3, 4]));
  v.pushWords('my friend');
  const [first, second] = streamAudioCalls(head).filter((chunk) => chunk.words);
  assert.deepEqual(first.words, ['Hi', 'there']);
  assert.equal(first.wtimes[0], 0, 'an utterance starts at zero');
  assert.ok(second.wtimes[0] > first.wtimes[1], 'the next words come after the first');
  assert.ok(streamAudioCalls(head).some((chunk) => chunk.audio && chunk.audio.byteLength === 4));
  v.end();
});

test('a turn ends with the stream, and the next turn starts its words again from zero', async () => {
  const head = fakeHead();
  const v = voice.createLiveVoice(head);
  await v.begin('gemini');
  v.pushWords('One two three');
  v.endTurn();
  assert.ok(head.calls.some((call) => call[0] === 'streamNotifyEnd'));
  v.pushWords('Next');
  const words = streamAudioCalls(head).filter((chunk) => chunk.words);
  assert.equal(words.at(-1).wtimes[0], 0, 'the new turn starts at zero');
});

test('the voice is busy while the model speaks, and goes idle once, when the audio ends', async () => {
  const head = fakeHead();
  const v = voice.createLiveVoice(head);
  let idle = 0;
  v.onIdle(() => {
    idle += 1;
  });
  await v.begin('gemini');
  assert.equal(v.busy(), false);
  head.starts[0].onAudioStart();
  assert.equal(v.busy(), true);
  head.starts[0].onAudioEnd();
  assert.equal(v.busy(), false);
  assert.equal(idle, 1);
  v.end();
});

test('an interruption stops the Gemini voice at once, and the words after it start from zero', async () => {
  const head = fakeHead();
  const v = voice.createLiveVoice(head);
  await v.begin('gemini');
  head.starts[0].onAudioStart();
  v.pushWords('A long answer goes on');
  v.clear();
  assert.ok(head.calls.some((call) => call[0] === 'streamInterrupt'));
  assert.equal(v.busy(), false);
  v.pushWords('Yes');
  assert.equal(streamAudioCalls(head).at(-1).wtimes[0], 0);
  v.end();
});

test('the typed voice speaks each sentence once it is whole, in the order the sentences were written', async () => {
  const head = fakeHead();
  const v = voice.createLiveVoice(head);
  await v.begin('typed');
  assert.deepEqual(head.calls[0], ['streamStop'], 'the typed voice leaves the streamed mode');
  v.speakClip([new Uint8Array(900)], 'Hi there.');
  v.speakClip([new Uint8Array(600)], 'How are you?');
  // The second sentence is decoded and waits: the first one has not been spoken yet.
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(
    head.speeches.map((speech) => speech.words.join(' ')),
    ['Hi there.', 'How are you?'],
    'the sentences are spoken in order',
  );
  assert.ok(Math.abs(head.speeches[0].buffer.duration - 0.9) < 1e-9);
  assert.equal(v.busy(), true);
  head.speeches[0].onDone();
  head.speeches[1].onDone();
  assert.equal(v.busy(), false, 'idle when the last sentence is said');
  v.end();
});

test('a sentence that cannot be read is skipped, and the voice goes on to the next one', async () => {
  const head = fakeHead();
  const v = voice.createLiveVoice(head);
  await v.begin('typed');
  v.speakClip([new Uint8Array(0)], 'Nothing to say.');
  v.speakClip([new Uint8Array(300)], 'Something.');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(head.speeches.map((speech) => speech.words.join(' ')), ['Something.']);
  head.speeches[0].onDone();
  assert.equal(v.busy(), false);
  v.end();
});

test('clearing the voice stops what is queued, and a sentence that ends late changes nothing', async () => {
  const head = fakeHead();
  const v = voice.createLiveVoice(head);
  let idle = 0;
  v.onIdle(() => {
    idle += 1;
  });
  await v.begin('typed');
  v.speakClip([new Uint8Array(400)], 'Old sentence.');
  await new Promise((resolve) => setTimeout(resolve, 0));
  v.clear();
  assert.ok(head.calls.some((call) => call[0] === 'stopSpeaking'));
  assert.equal(v.busy(), false);
  const idleBefore = idle;
  head.speeches[0].onDone();
  assert.equal(idle, idleBefore, 'the late end of the old sentence is ignored');
  v.speakClip([new Uint8Array(400)], 'New sentence.');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(v.busy(), true);
  head.speeches[1].onDone();
  assert.equal(v.busy(), false);
  v.end();
});

test('a voice that is ended stops speaking, and its listeners are no longer called by it', async () => {
  const head = fakeHead();
  const v = voice.createLiveVoice(head);
  await v.begin('gemini');
  v.end();
  assert.ok(head.calls.some((call) => call[0] === 'streamStop'));
  assert.equal(v.busy(), false);
});
