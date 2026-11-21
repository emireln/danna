// Reads a text aloud, and streams the sound back to the window as it is made. The choice of the learner decides the
// voice (electron/speech.cjs); when that voice cannot speak, the built-in voice reads, and a note says why. The
// finished sounds of a text are kept for a while, so reading the same passage again starts at once.
const speech = require('./speech.cjs');
const { userError } = require('./errors.cjs');

const ID = /^[\w-]{8,64}$/;
const MAX_CACHED_BYTES = 48 * 1024 * 1024;
const MAX_CACHED_TEXTS = 24;

/**
 * `kokoro` is the built-in engine (electron/kokoro.cjs), `windows` the voices of this PC, and `cloud` the providers
 * (electron/ai.cjs, with its speak function). `hasKey` and `getKey` read the learner's keys.
 */
function createSpeechService({ kokoro, windows, cloud, hasKey, getKey }) {
  const jobs = new Map();
  const cache = new Map();

  function cachedBytes() {
    let total = 0;
    for (const sounds of cache.values()) for (const sound of sounds) total += sound.audio.length;
    return total;
  }

  function remember(key, sounds) {
    cache.delete(key);
    cache.set(key, sounds);
    while (cache.size > MAX_CACHED_TEXTS || cachedBytes() > MAX_CACHED_BYTES) {
      cache.delete(cache.keys().next().value);
    }
  }

  function availability() {
    return {
      openai: Boolean(hasKey('openai')),
      gemini: Boolean(hasKey('gemini')),
      windows: windows.known() ? windows.known().map((voice) => voice.id) : null,
    };
  }

  /** The sound of one plan, as chunks: each is { audio, mime }. Throws when the plan's voice cannot speak. */
  async function produce(plan, text, emit, signal) {
    if (plan.engine === 'cloud') {
      const result = await cloud.speak(plan.provider, getKey(plan.provider), text, plan.voice);
      emit({ audio: result.bytes, mime: result.mime });
      return;
    }
    if (plan.engine === 'windows') {
      emit({ audio: await windows.synthesize(text, plan.id, { signal }), mime: 'audio/wav' });
      return;
    }
    if (!kokoro.available(plan.voice)) throw new Error('The built-in voice is not installed.');
    for await (const wav of kokoro.speakPieces(text, plan.voice, { signal })) {
      emit({ audio: wav, mime: 'audio/wav' });
    }
  }

  async function run(id, text, plan, send, signal) {
    const key = `${plan.engine}:${plan.voice ?? plan.id}\n${text}`;
    const known = cache.get(key);
    if (known) {
      for (const sound of known) send({ id, ...sound });
      send({ id, done: true });
      return;
    }
    const made = [];
    const emit = (sound) => {
      made.push(sound);
      send({ id, ...sound });
    };
    let engine = plan.engine;
    try {
      await produce(plan, text, emit, signal);
    } catch (error) {
      if (signal.aborted) {
        send({ id, done: true });
        return;
      }
      // A voice that fails before any sound is played falls back to the built-in voice. A failure in the middle
      // of a text ends it, so the learner does not hear the start twice.
      if (made.length > 0 || plan.engine === 'builtin') {
        send({ id, done: true, error: error.message || 'The voice could not speak. Try again.' });
        return;
      }
      send({ id, note: plan.engine === 'cloud' ? speech.NOTE.cloudFailed : speech.NOTE.windowsFailed });
      engine = 'builtin';
      try {
        await produce({ engine: 'builtin', voice: speech.DEFAULT_BUILTIN }, text, emit, signal);
      } catch (second) {
        if (!signal.aborted) send({ id, done: true, error: second.message || 'The voice could not speak. Try again.' });
        else send({ id, done: true });
        return;
      }
    }
    if (engine === plan.engine && !signal.aborted && made.length > 0) remember(key, made);
    send({ id, done: true });
  }

  /**
   * Starts reading a text. The reply says which engine reads it and, when the choice cannot be used as chosen, why.
   * The sound arrives through `send` as { id, audio, mime }, then { id, note } or { id, done, error }.
   */
  function start({ id, text, choice }, send) {
    if (typeof id !== 'string' || !ID.test(id)) throw userError('That reading could not be started. Try again.');
    const input = speech.speechText(text);
    if (!input) throw userError('There is nothing to read aloud.');
    if (jobs.has(id)) throw userError('That reading is already running.');
    const plan = speech.planSpeech(choice, availability());
    const controller = new AbortController();
    jobs.set(id, controller);
    // The reading is forgotten before its last event is sent, so a stop that follows it finds nothing to stop.
    const forget = () => {
      if (jobs.get(id) === controller) jobs.delete(id);
    };
    const deliver = (event) => {
      if (event.done) forget();
      send(event);
    };
    run(id, input, plan, deliver, controller.signal)
      .catch(() => undefined)
      .finally(forget);
    return { engine: plan.engine, voice: plan.voice ?? plan.id ?? null, note: plan.note ?? null };
  }

  function stop(id) {
    const controller = typeof id === 'string' ? jobs.get(id) : undefined;
    if (controller) controller.abort();
    return { stopped: Boolean(controller) };
  }

  /** The voices a learner can choose from: the built-in ones, the ones on this PC, and whether each cloud key is there. */
  async function voices() {
    const found = await windows.list();
    return {
      builtin: speech.BUILTIN_VOICES.map((voice) => ({ ...voice, ready: kokoro.available(voice.id) })),
      windows: found.voices,
      windowsError: found.error,
      recommended: found.recommended,
      cloud: { openai: Boolean(hasKey('openai')), gemini: Boolean(hasKey('gemini')) },
    };
  }

  return { start, stop, voices };
}

module.exports = { createSpeechService };
