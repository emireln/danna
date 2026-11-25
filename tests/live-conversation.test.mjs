// Tests the live conversation's behaviour with fakes for the desktop bridge, the microphone, the coach's voice and the text
// reply: the Gemini engine (its states, the transcript, the microphone, muting, manual turns, endings and errors) and the
// typed engine (sentences spoken in order, interruptions and errors).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let conversation;
let bridgeModule;
let i18n;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  conversation = await server.ssrLoadModule('/src/lib/live/conversation.ts');
  bridgeModule = await server.ssrLoadModule('/src/lib/bridge.ts');
  i18n = await server.ssrLoadModule('/src/lib/i18n/index.ts');
  i18n.setLang('en');
});

after(async () => {
  await server?.close();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeBridge({ startError = null } = {}) {
  const liveListeners = new Set();
  const speechListeners = new Set();
  const calls = [];
  let startDeferred = null;
  return {
    calls,
    emit(event) {
      for (const listener of [...liveListeners]) listener(event);
    },
    emitSpeech(chunk) {
      for (const listener of [...speechListeners]) listener(chunk);
    },
    holdStart() {
      let resolve;
      startDeferred = new Promise((done) => {
        resolve = done;
      });
      return () => resolve({ started: true, model: 'gemini-3.8-live' });
    },
    live: {
      onEvent(listener) {
        liveListeners.add(listener);
        return () => liveListeners.delete(listener);
      },
      async start(options) {
        calls.push(['live.start', options]);
        if (startError) throw startError;
        if (startDeferred) return startDeferred;
        return { started: true, model: 'gemini-3.8-live' };
      },
      async stop() {
        calls.push(['live.stop']);
        return { stopped: true };
      },
      async sendText(text) {
        calls.push(['live.sendText', text]);
        return true;
      },
      sendAudio(frame) {
        calls.push(['live.sendAudio', frame.byteLength]);
      },
      sendActivity(kind) {
        calls.push(['live.sendActivity', kind]);
      },
    },
    speech: {
      async start(id, text, voice) {
        calls.push(['speech.start', id, text, voice]);
        return { engine: 'builtin', voice: null, note: null };
      },
      async stop(id) {
        calls.push(['speech.stop', id]);
        return { stopped: true };
      },
      onChunk(listener) {
        speechListeners.add(listener);
        return () => speechListeners.delete(listener);
      },
    },
  };
}

/** The coach's voice as the talk sees it: it records what it is given, and the test says when it has finished. */
function fakeVoice() {
  const pushes = [];
  const clips = [];
  const idleListeners = new Set();
  let busy = false;
  let cleared = 0;
  let ended = false;
  let turns = 0;
  const idle = () => {
    for (const listener of [...idleListeners]) listener();
  };
  return {
    pushes,
    clips,
    get cleared() {
      return cleared;
    },
    get ended() {
      return ended;
    },
    get turns() {
      return turns;
    },
    async begin() {},
    pushPcm(bytes) {
      pushes.push(['pcm', bytes.byteLength]);
      busy = true;
    },
    pushWords(text) {
      pushes.push(['words', text]);
    },
    endTurn() {
      turns += 1;
    },
    speakClip(pieces, text) {
      clips.push({ sizes: pieces.map((piece) => piece.byteLength), text });
      busy = true;
    },
    clear() {
      cleared += 1;
      busy = false;
      idle();
    },
    busy: () => busy,
    onIdle(listener) {
      idleListeners.add(listener);
      return () => idleListeners.delete(listener);
    },
    end() {
      ended = true;
      busy = false;
    },
    // The voice has said everything it was given.
    finish() {
      busy = false;
      idle();
    },
  };
}

function fakeMicrophone() {
  const mic = { onFrame: null, sending: () => false, stopped: false, opened: 0 };
  mic.open = async (onFrame, sending) => {
    mic.opened += 1;
    mic.onFrame = onFrame;
    mic.sending = sending;
    return {
      stop() {
        mic.stopped = true;
      },
    };
  };
  // A frame reaches the page only while the conversation is sending, as the real microphone does.
  mic.frame = (bytes = new ArrayBuffer(8)) => {
    if (mic.onFrame && mic.sending()) mic.onFrame(bytes);
  };
  return mic;
}

function fakeReplies() {
  const replies = [];
  const startReply = (request, onDelta) => {
    let resolve;
    let reject;
    const done = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const entry = {
      request,
      stopped: false,
      deliver: (piece) => onDelta(piece),
      finish: () => resolve({ text: '', provider: 'openai', model: 'gpt', cut: false, aborted: false }),
      fail: (error) => reject(error),
    };
    const reply = {
      id: `reply-${replies.length}`,
      stop: () => {
        entry.stopped = true;
      },
      done,
    };
    entry.reply = reply;
    replies.push(entry);
    return reply;
  };
  return { startReply, replies };
}

function build({ bridge = fakeBridge(), voice = fakeVoice(), mic = fakeMicrophone(), replies = fakeReplies() } = {}) {
  const conv = conversation.createLiveConversation({
    bridge,
    startReply: replies.startReply,
    openMicrophone: mic.open,
  });
  conv.attachVoice(voice);
  return { conv, bridge, voice, mic, replies };
}

const geminiOptions = { engine: 'gemini', instructions: 'Be kind.', voice: 'Puck', appVoice: 'auto', turnMode: 'auto' };

test('the Gemini talk starts, waits for the model, and then listens with the microphone open', async () => {
  const { conv, bridge, mic } = build();
  await conv.start(geminiOptions);
  assert.equal(conv.snapshot().status, 'connecting');
  assert.deepEqual(bridge.calls[0], ['live.start', { instructions: 'Be kind.', voice: 'Puck', turnMode: 'auto', model: undefined }]);
  assert.equal(conv.snapshot().model, 'gemini-3.8-live');
  assert.equal(mic.opened, 1);
  bridge.emit({ type: 'ready', model: 'gemini-3.8-live' });
  assert.equal(conv.snapshot().status, 'listening');
  mic.frame(new ArrayBuffer(8));
  assert.deepEqual(bridge.calls.at(-1), ['live.sendAudio', 8]);
  conv.stop();
});

test('the model’s voice plays as it arrives, the transcript keeps both sides, and the talk listens again when the voice ends', async () => {
  const { conv, bridge, voice } = build();
  await conv.start(geminiOptions);
  bridge.emit({ type: 'ready', model: 'gemini-3.8-live' });
  bridge.emit({ type: 'transcript', role: 'user', text: 'Hel' });
  bridge.emit({ type: 'transcript', role: 'user', text: 'lo' });
  bridge.emit({ type: 'transcript', role: 'model', text: 'Hi there!' });
  bridge.emit({ type: 'audio', mimeType: 'audio/pcm;rate=24000', data: new Uint8Array(4) });
  assert.deepEqual(voice.pushes, [
    ['words', 'Hi there!'],
    ['pcm', 4],
  ]);
  assert.equal(conv.snapshot().status, 'speaking');
  bridge.emit({ type: 'turn-complete' });
  assert.equal(voice.turns, 1);
  assert.deepEqual(
    conv.snapshot().lines.map((line) => [line.role, line.text, line.open]),
    [
      ['user', 'Hello', false],
      ['coach', 'Hi there!', false],
    ],
  );
  voice.finish();
  assert.equal(conv.snapshot().status, 'listening');
  conv.stop();
});

test('an interruption stops the voice at once, and a learner who speaks shows it', async () => {
  const { conv, bridge, voice } = build();
  await conv.start(geminiOptions);
  bridge.emit({ type: 'ready', model: 'm' });
  bridge.emit({ type: 'audio', mimeType: 'audio/pcm;rate=24000', data: new Uint8Array(2) });
  bridge.emit({ type: 'activity', speaking: true });
  assert.equal(conv.snapshot().userSpeaking, true);
  bridge.emit({ type: 'interrupted' });
  assert.equal(voice.cleared, 1);
  assert.equal(conv.snapshot().status, 'listening');
  bridge.emit({ type: 'activity', speaking: false });
  assert.equal(conv.snapshot().userSpeaking, false);
  assert.equal(conv.snapshot().status, 'thinking', 'the learner stopped, so the coach is thinking');
  conv.stop();
});

test('muting keeps the microphone from sending, and manual turns send only while the talk button is held', async () => {
  const { conv, bridge, mic } = build();
  await conv.start(geminiOptions);
  bridge.emit({ type: 'ready', model: 'm' });
  conv.setMuted(true);
  mic.frame(new ArrayBuffer(8));
  assert.equal(conv.snapshot().muted, true);
  assert.ok(!bridge.calls.some((call) => call[0] === 'live.sendAudio'));
  conv.setMuted(false);
  conv.stop();

  const manual = build();
  await manual.conv.start({ ...geminiOptions, turnMode: 'manual' });
  manual.bridge.emit({ type: 'ready', model: 'm' });
  manual.mic.frame(new ArrayBuffer(8));
  assert.ok(!manual.bridge.calls.some((call) => call[0] === 'live.sendAudio'), 'nothing is sent before the button is held');
  manual.conv.setTalking(true);
  manual.mic.frame(new ArrayBuffer(8));
  manual.conv.setTalking(false);
  manual.mic.frame(new ArrayBuffer(8));
  assert.deepEqual(
    manual.bridge.calls.filter((call) => call[0] === 'live.sendAudio' || call[0] === 'live.sendActivity'),
    [
      ['live.sendActivity', 'start'],
      ['live.sendAudio', 8],
      ['live.sendActivity', 'end'],
    ],
  );
  manual.conv.stop();
});

test('a typed message reaches the model as text, and the talk shows it', async () => {
  const { conv, bridge } = build();
  await conv.start(geminiOptions);
  bridge.emit({ type: 'ready', model: 'm' });
  await conv.sendText('  I went home  ');
  assert.deepEqual(bridge.calls.at(-1), ['live.sendText', 'I went home']);
  assert.equal(conv.snapshot().status, 'thinking');
  assert.equal(conv.snapshot().lines[0].text, 'I went home');
  conv.stop();
});

test('a connection that is lost after the talk started ends it with a sentence, and releases the microphone', async () => {
  const { conv, bridge, voice, mic } = build();
  await conv.start(geminiOptions);
  bridge.emit({ type: 'ready', model: 'm' });
  bridge.emit({ type: 'closed', reason: 'connection lost' });
  const state = conv.snapshot();
  assert.equal(state.status, 'ended');
  assert.equal(state.ended, true);
  assert.equal(state.error, 'The connection was lost. Start the talk again to carry on.');
  assert.equal(mic.opened, 1);
  assert.equal(voice.ended, true);
  assert.ok(!bridge.calls.some((call) => call[0] === 'live.stop'), 'the server already closed the session');
});

test('a message from Google is shown, and it becomes the reason when the talk ends', async () => {
  const { conv, bridge } = build();
  await conv.start(geminiOptions);
  bridge.emit({ type: 'error', message: 'Google is busy right now. Please try again in a moment.' });
  assert.equal(conv.snapshot().notice, 'Google is busy right now. Please try again in a moment.');
  assert.equal(conv.snapshot().ended, false, 'a message alone does not end the talk');
  bridge.emit({ type: 'closed', reason: 'error' });
  assert.equal(conv.snapshot().error, 'Google is busy right now. Please try again in a moment.');
});

test('stopping keeps the transcript, closes the session and ignores what comes after', async () => {
  const { conv, bridge, voice, mic } = build();
  await conv.start(geminiOptions);
  bridge.emit({ type: 'ready', model: 'm' });
  bridge.emit({ type: 'transcript', role: 'model', text: 'Good morning.' });
  conv.stop();
  const state = conv.snapshot();
  assert.equal(state.status, 'ended');
  assert.equal(state.error, null);
  assert.equal(state.lines.length, 1, 'the transcript stays');
  assert.equal(mic.stopped, true);
  assert.equal(voice.ended, true);
  assert.deepEqual(bridge.calls.at(-1), ['live.stop']);
  bridge.emit({ type: 'transcript', role: 'user', text: 'Late words' });
  assert.equal(conv.snapshot().lines.length, 1);
});

test('a talk that is stopped while it is opening closes the session that opened', async () => {
  const bridge = fakeBridge();
  const finish = bridge.holdStart();
  const { conv, mic } = build({ bridge });
  const starting = conv.start(geminiOptions);
  conv.stop();
  finish();
  await starting;
  await flush();
  assert.equal(mic.opened, 0, 'no microphone opens for a talk that was stopped');
  assert.ok(bridge.calls.some((call) => call[0] === 'live.stop'), 'the session that opened is closed');
});

test('a key that is missing, or a microphone that is refused, ends the talk with the words of the app', async () => {
  const missing = bridgeModule.userError('Add a Gemini key in Settings to talk live.');
  const first = build({ bridge: fakeBridge({ startError: missing }) });
  await first.conv.start(geminiOptions);
  assert.equal(first.conv.snapshot().error, 'Add a Gemini key in Settings to talk live.');

  const second = build();
  second.mic.open = async () => {
    throw bridgeModule.userError('Danna needs the microphone. Allow it for Danna in the Windows settings, then try again.');
  };
  const conv = conversation.createLiveConversation({
    bridge: second.bridge,
    startReply: second.replies.startReply,
    openMicrophone: second.mic.open,
  });
  conv.attachVoice(second.voice);
  await conv.start(geminiOptions);
  assert.equal(conv.snapshot().ended, true);
  assert.match(conv.snapshot().error, /Danna needs the microphone/);
  assert.ok(second.bridge.calls.some((call) => call[0] === 'live.stop'), 'the session is closed when the microphone fails');
});

test('without the desktop app a talk does not start and says so', async () => {
  const replies = fakeReplies();
  const conv = conversation.createLiveConversation({ bridge: null, startReply: replies.startReply, openMicrophone: fakeMicrophone().open });
  conv.attachVoice(fakeVoice());
  await conv.start(geminiOptions);
  assert.equal(conv.snapshot().ended, true);
  assert.equal(conv.snapshot().error, 'Talk live works in the Danna desktop app.');
});

test('a talk cannot start until the coach is drawn, and the coach leaving ends the talk', async () => {
  const bridge = fakeBridge();
  const conv = conversation.createLiveConversation({ bridge, startReply: fakeReplies().startReply, openMicrophone: fakeMicrophone().open });
  await conv.start(geminiOptions);
  assert.equal(conv.snapshot().ended, true);
  assert.equal(conv.snapshot().error, 'The coach is still getting ready. Try again in a moment.');
  assert.ok(!bridge.calls.some((call) => call[0] === 'live.start'), 'no session opens without a coach');

  const { conv: talking, voice } = build();
  await talking.start(geminiOptions);
  talking.detachVoice();
  assert.equal(talking.snapshot().ended, true);
  assert.equal(voice.ended, true);
});

test('the typed engine speaks each sentence with the app’s voice, in order, as the reply is written', async () => {
  const { conv, bridge, voice, replies } = build();
  await conv.start({ engine: 'typed', instructions: 'Be kind.', voice: '', appVoice: 'builtin:amy', turnMode: 'auto' });
  await conv.sendText('Hello coach');
  const reply = replies.replies[0];
  assert.equal(reply.request.system, 'Be kind.');
  assert.deepEqual(reply.request.messages, [{ role: 'user', content: 'Hello coach' }]);
  reply.deliver('**Hi** there. How ');
  reply.deliver('are you? Fine');
  const starts = bridge.calls.filter((call) => call[0] === 'speech.start');
  assert.deepEqual(
    starts.map((call) => call[2]),
    ['Hi there.', 'How are you?'],
    'a sentence is spoken once it is complete, without markdown',
  );
  assert.equal(starts[0][3], 'builtin:amy', 'the app’s voice reads');

  // The second sentence waits until the first has been given to the voice.
  bridge.emitSpeech({ id: starts[1][1], audio: new Uint8Array([1, 2]) });
  bridge.emitSpeech({ id: starts[1][1], done: true });
  assert.deepEqual(voice.clips, []);
  bridge.emitSpeech({ id: starts[0][1], audio: new Uint8Array([3]) });
  bridge.emitSpeech({ id: starts[0][1], done: true });
  assert.deepEqual(voice.clips, [
    { sizes: [1], text: 'Hi there.' },
    { sizes: [2], text: 'How are you?' },
  ]);

  reply.finish();
  await flush();
  const all = bridge.calls.filter((call) => call[0] === 'speech.start');
  assert.equal(all[2][2], 'Fine', 'the end of the reply is spoken too');
  assert.deepEqual(
    conv.snapshot().lines.map((line) => [line.role, line.text]),
    [
      ['user', 'Hello coach'],
      ['coach', 'Hi there. How are you? Fine'],
    ],
  );
  bridge.emitSpeech({ id: all[2][1], audio: new Uint8Array([4]) });
  bridge.emitSpeech({ id: all[2][1], done: true });
  assert.equal(voice.clips.at(-1).text, 'Fine');
  voice.finish();
  assert.equal(conv.snapshot().status, 'listening');
  conv.stop();
});

test('a new message interrupts the reply and the voice that are under way', async () => {
  const { conv, bridge, voice, replies } = build();
  await conv.start({ engine: 'typed', instructions: 'x', voice: '', appVoice: 'auto', turnMode: 'auto' });
  await conv.sendText('First');
  replies.replies[0].deliver('A long answer. ');
  const pending = bridge.calls.filter((call) => call[0] === 'speech.start').map((call) => call[1]);
  assert.equal(pending.length, 1);
  await conv.sendText('Stop, please');
  assert.equal(replies.replies[0].stopped, true);
  assert.deepEqual(bridge.calls.filter((call) => call[0] === 'speech.stop').map((call) => call[1]), pending);
  assert.ok(voice.cleared >= 1, 'the coach stops speaking');
  assert.equal(conv.snapshot().status, 'thinking');
  assert.equal(replies.replies[1].request.messages.at(-1).content, 'Stop, please');
  conv.stop();
});

test('a reply that fails shows the reason and the talk goes on', async () => {
  const { conv, replies } = build();
  await conv.start({ engine: 'typed', instructions: 'x', voice: '', appVoice: 'auto', turnMode: 'auto' });
  await conv.sendText('Hi');
  replies.replies[0].fail(bridgeModule.userError('The reply took too long to start. Please try again.'));
  await flush();
  assert.equal(conv.snapshot().notice, 'The reply took too long to start. Please try again.');
  assert.equal(conv.snapshot().ended, false);
  assert.equal(conv.snapshot().status, 'listening');
  conv.stop();
});
