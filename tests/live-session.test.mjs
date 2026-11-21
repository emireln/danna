// Gemini Live (electron/live.cjs): the messages the session sends and reads, and the session itself against a fake
// socket: setup, audio in and out, reconnection with the resumption handle, the hand-over at goAway, the model fallback,
// the errors, and the rule that the key never leaves the main process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const live = require('../electron/live.cjs');

const KEY = 'TEST-KEY-123';

class FakeSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.closed = false;
    this.binaryType = 'blob';
    FakeSocket.instances.push(this);
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.({ code: 1000 });
  }
  open() {
    this.onopen?.();
  }
  serve(msg) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop() {
    this.closed = true;
    this.onclose?.({ code: 1011 });
  }
}

const tick = (ms = 15) => new Promise((resolve) => setTimeout(resolve, ms));

function harness(options = {}) {
  FakeSocket.instances.length = 0;
  const events = [];
  const send = (channel, payload) => events.push({ channel, payload });
  const sessions = live.createLiveSessions({
    send,
    getKey: (provider) => (provider === 'gemini' ? KEY : null),
    WebSocketImpl: FakeSocket,
    backoffMs: options.backoffMs ?? [1, 1, 1],
  });
  const latest = () => FakeSocket.instances[FakeSocket.instances.length - 1];
  const kinds = () => events.filter((item) => item.channel === 'live:event').map((item) => item.payload);
  return { sessions, events, latest, kinds };
}

test('the setup message sends the model, the voice, audio only, both transcripts and the session settings', () => {
  const setup = live.buildSetup({ model: 'gemini-3.8-live', voice: 'Puck', instructions: 'Be kind.' }).setup;
  assert.equal(setup.model, 'models/gemini-3.8-live');
  assert.deepEqual(setup.generationConfig.responseModalities, ['AUDIO']);
  assert.equal(setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Puck');
  assert.equal(setup.systemInstruction.parts[0].text, 'Be kind.');
  assert.deepEqual(setup.inputAudioTranscription, {});
  assert.deepEqual(setup.outputAudioTranscription, {});
  assert.deepEqual(setup.contextWindowCompression, { slidingWindow: {} });
  assert.deepEqual(setup.sessionResumption, {});
  assert.equal(setup.realtimeInputConfig.automaticActivityDetection.disabled, undefined);
});

test('an unknown voice falls back to the default, and a model name may come with its models/ prefix', () => {
  const setup = live.buildSetup({ model: 'models/gemini-3.8-live', voice: 'NoSuchVoice', instructions: '' }).setup;
  assert.equal(setup.model, 'models/gemini-3.8-live');
  assert.equal(setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, live.DEFAULT_VOICE);
});

test('a resumption handle and manual turn-taking are written into the setup', () => {
  const resumed = live.buildSetup({ model: 'gemini-3.8-live', voice: 'Kore', instructions: '', handle: 'abc' }).setup;
  assert.deepEqual(resumed.sessionResumption, { handle: 'abc' });
  const manual = live.buildSetup({ model: 'gemini-3.8-live', voice: 'Kore', instructions: '', turnMode: 'manual' }).setup;
  assert.deepEqual(manual.realtimeInputConfig.automaticActivityDetection, { disabled: true });
});

test('a model name that is not a model name is refused before any connection', () => {
  assert.throws(() => live.buildSetup({ model: '../../etc', voice: 'Kore', instructions: '' }), /not available/);
});

test('audio frames are sent as 16 kHz PCM in base64, and a text turn ends the turn', () => {
  const frame = Buffer.from([1, 2, 3, 4]);
  const audio = live.buildAudioMessage(frame).realtimeInput.audio;
  assert.equal(audio.mimeType, 'audio/pcm;rate=16000');
  assert.deepEqual(Buffer.from(audio.data, 'base64'), frame);
  const turn = live.buildTextTurn('Hello').clientContent;
  assert.equal(turn.turnComplete, true);
  assert.deepEqual(turn.turns[0], { role: 'user', parts: [{ text: 'Hello' }] });
  assert.deepEqual(live.buildActivityMessage('start'), { realtimeInput: { activityStart: {} } });
});

test('server messages become small events: audio, transcripts, interruption, turn end, hand-over, resumption', () => {
  const pcm = Buffer.from([5, 6, 7, 8]);
  const events = live.parseServerMessage({
    serverContent: {
      modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: pcm.toString('base64') } }] },
      outputTranscription: { text: 'Hi there.' },
      inputTranscription: { text: 'I went home.' },
      interrupted: true,
      turnComplete: true,
    },
  });
  assert.deepEqual(events.map((item) => item.type), ['audio', 'transcript', 'transcript', 'interrupted', 'turn-complete']);
  assert.equal(events[0].mimeType, 'audio/pcm;rate=24000');
  assert.deepEqual(events[0].data, pcm);
  assert.deepEqual(events[1], { type: 'transcript', role: 'user', text: 'I went home.' });
  assert.deepEqual(events[2], { type: 'transcript', role: 'model', text: 'Hi there.' });
  assert.deepEqual(live.parseServerMessage({ goAway: { timeLeft: '50s' } }), [{ type: 'go-away', timeLeftMs: 50000 }]);
  assert.deepEqual(live.parseServerMessage({ sessionResumptionUpdate: { newHandle: 'h2', resumable: true } }), [{ type: 'resumption', handle: 'h2' }]);
  assert.deepEqual(live.parseServerMessage({ sessionResumptionUpdate: { newHandle: '', resumable: false } }), [{ type: 'resumption', handle: null }]);
  assert.deepEqual(live.parseServerMessage({ voiceActivity: { type: 'ACTIVITY_START' } }), [{ type: 'activity', speaking: true }]);
  assert.deepEqual(live.parseServerMessage({ usageMetadata: {} }), []);
  assert.deepEqual(live.parseServerMessage(null), []);
});

test('a server error is turned into a short sentence, and a model error is marked as one', () => {
  const [denied] = live.parseServerMessage({ error: { status: 'PERMISSION_DENIED', message: 'API key not valid for ' + KEY } });
  assert.equal(denied.type, 'error');
  assert.match(denied.message, /did not accept the Gemini key/);
  assert.equal(denied.message.includes(KEY), false);
  const [missing] = live.parseServerMessage({ error: { message: 'Model gemini-x is not found for this API version.' } });
  assert.equal(missing.model, true);
});

test('the key is removed from any text that is shown or logged', () => {
  assert.equal(live.redact(`failed at wss://host/?key=${KEY}&alt=1 with ${KEY}`, KEY), 'failed at wss://host/?key=[key]&alt=1 with [key]');
  assert.equal(live.durationMs('1.5s'), 1500);
  assert.equal(live.durationMs('soon'), null);
});

test('without a Gemini key the session does not start, with a sentence the learner can act on', () => {
  const sessions = live.createLiveSessions({ send: () => {}, getKey: () => null, WebSocketImpl: FakeSocket });
  assert.throws(() => sessions.start({ instructions: '' }), /Add a Gemini key in Settings/);
});

test('a session connects, sends its setup, and streams audio both ways until it is stopped', async () => {
  const { sessions, latest, kinds } = harness();
  const started = sessions.start({ instructions: 'Coach.', voice: 'Aoede' });
  assert.equal(started.model, 'gemini-3.8-live');
  assert.match(latest().url, /BidiGenerateContent\?key=TEST-KEY-123$/);
  assert.equal(sessions.sendAudio(Buffer.alloc(640)), false, 'nothing is sent before the setup is complete');
  latest().open();
  assert.equal(latest().sent[0].setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Aoede');
  latest().serve({ setupComplete: {} });
  assert.equal(sessions.state(), 'ready');
  assert.equal(sessions.sendAudio(Buffer.alloc(640)), true);
  assert.equal(latest().sent.at(-1).realtimeInput.audio.mimeType, 'audio/pcm;rate=16000');
  latest().serve({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: Buffer.from([9, 9]).toString('base64') } }] } } });
  const types = kinds().map((item) => item.type);
  assert.deepEqual(types, ['ready', 'audio']);
  sessions.stop();
  assert.equal(latest().closed, true);
  assert.deepEqual(kinds().at(-1), { type: 'closed', reason: 'ended' });
  assert.equal(sessions.state(), 'idle');
});

test('a dropped connection resumes with the handle the server gave, so the conversation carries on', async () => {
  const { sessions, latest, kinds } = harness();
  sessions.start({ instructions: '' });
  latest().open();
  latest().serve({ setupComplete: {} });
  latest().serve({ sessionResumptionUpdate: { newHandle: 'handle-1', resumable: true } });
  latest().drop();
  assert.ok(kinds().some((item) => item.type === 'reconnecting'), 'the learner sees that it is reconnecting');
  await tick();
  assert.equal(FakeSocket.instances.length, 2, 'a new socket is opened');
  latest().open();
  assert.deepEqual(latest().sent[0].setup.sessionResumption, { handle: 'handle-1' });
  latest().serve({ setupComplete: {} });
  assert.equal(sessions.state(), 'ready');
});

test('at goAway the session opens a new socket first, and the old one closes only when the new one is ready', async () => {
  const { sessions, latest, kinds } = harness();
  sessions.start({ instructions: '' });
  const first = latest();
  first.open();
  first.serve({ setupComplete: {} });
  first.serve({ sessionResumptionUpdate: { newHandle: 'handle-2', resumable: true } });
  first.serve({ goAway: { timeLeft: '50s' } });
  assert.deepEqual(kinds().find((item) => item.type === 'go-away'), { type: 'go-away', timeLeftMs: 50000 });
  assert.equal(FakeSocket.instances.length, 2);
  assert.equal(first.closed, false, 'the old socket keeps the conversation until the new one is ready');
  const second = latest();
  second.open();
  assert.deepEqual(second.sent[0].setup.sessionResumption, { handle: 'handle-2' });
  second.serve({ setupComplete: {} });
  assert.equal(first.closed, true);
  assert.equal(sessions.sendAudio(Buffer.alloc(640)), true);
  assert.equal(second.sent.at(-1).realtimeInput.audio.mimeType, 'audio/pcm;rate=16000');
});

test('a model this key cannot use is replaced by the next one in the list, without a visible error', () => {
  const { sessions, latest, kinds } = harness();
  sessions.start({ instructions: '' });
  latest().open();
  assert.equal(latest().sent[0].setup.model, 'models/gemini-3.8-live');
  latest().serve({ error: { message: 'Model gemini-3.8-live is not found for this API version.' } });
  assert.equal(FakeSocket.instances.length, 2);
  assert.equal(kinds().some((item) => item.type === 'error'), false);
  latest().open();
  assert.equal(latest().sent[0].setup.model, `models/${live.LIVE_MODELS[1]}`);
  latest().serve({ setupComplete: {} });
  assert.equal(sessions.state(), 'ready');
});

test('a setup error that is not about the model ends the session with a sentence and no key', () => {
  const { sessions, latest, kinds } = harness();
  sessions.start({ instructions: '' });
  latest().open();
  latest().serve({ error: { status: 'PERMISSION_DENIED', message: `API key not valid: ${KEY}` } });
  const types = kinds().map((item) => item.type);
  assert.deepEqual(types, ['error', 'closed']);
  assert.equal(JSON.stringify(kinds()).includes(KEY), false);
});

test('a connection that never opens reports that Google could not be reached', () => {
  const { sessions, latest, kinds } = harness();
  sessions.start({ instructions: '' });
  latest().drop();
  assert.deepEqual(kinds().map((item) => item.type), ['error', 'closed']);
  assert.match(kinds()[0].message, /Could not reach Google/);
  assert.equal(sessions.state(), 'idle');
});

test('the manual turn signals are sent only in manual mode, and text is sent only when the session is ready', () => {
  const auto = harness();
  auto.sessions.start({ instructions: '' });
  auto.latest().open();
  auto.latest().serve({ setupComplete: {} });
  assert.equal(auto.sessions.sendActivity('start'), false);
  assert.equal(auto.sessions.sendText('  hi  '), true);
  assert.deepEqual(auto.latest().sent.at(-1).clientContent.turns[0].parts[0].text, 'hi');

  const manual = harness();
  manual.sessions.start({ instructions: '', turnMode: 'manual' });
  manual.latest().open();
  manual.latest().serve({ setupComplete: {} });
  assert.equal(manual.sessions.sendActivity('start'), true);
  assert.deepEqual(manual.latest().sent.at(-1), { realtimeInput: { activityStart: {} } });
  assert.equal(manual.sessions.sendActivity('end'), true);
  assert.deepEqual(manual.latest().sent.at(-1), { realtimeInput: { activityEnd: {} } });
});
