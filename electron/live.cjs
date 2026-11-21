// Gemini Live: a real-time voice conversation over the Live API's WebSocket (see docs/live-coach.md). It runs in the main
// process, so the key never reaches the interface. The interface sends microphone frames (16 kHz, 16-bit mono PCM) and
// receives the coach's voice (24 kHz, 16-bit mono PCM) with the transcripts. Messages are built and read by pure
// functions, so the tests need no network.
const { userError } = require('./errors.cjs');

const URL_BASE =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
// The first model is tried first. A model that this key cannot use is replaced by the next one in the list.
const LIVE_MODELS = Object.freeze(['gemini-3.8-live', 'gemini-3.1-flash-live-preview', 'gemini-2.5-flash-native-audio-latest']);
// The prebuilt voices named in the Gemini documentation. The server accepts any name at setup, so this list decides.
const VOICES = Object.freeze([
  'Kore', 'Puck', 'Aoede', 'Charon', 'Fenrir', 'Leda', 'Orus', 'Zephyr', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus',
  'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar',
  'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
]);
const DEFAULT_VOICE = 'Kore';
const MAX_INSTRUCTIONS = 12000;
const MAX_TEXT = 2000;
// A 40 ms frame of 16 kHz, 16-bit mono audio is 1280 bytes; anything much larger is refused.
const MAX_FRAME_BYTES = 16 * 1024;
// Pauses before each reconnection with the resumption handle; after the last one the conversation ends.
const RECONNECT_MS = Object.freeze([500, 1000, 2000, 4000, 8000]);
const MODEL_PATTERN = /^[a-z0-9][a-z0-9.-]{2,60}$/;

function normalizeModel(model) {
  const name = String(model || LIVE_MODELS[0]).replace(/^models\//, '');
  if (!MODEL_PATTERN.test(name)) throw userError('That live model is not available.');
  return name;
}

function voiceOf(voice) {
  return VOICES.includes(voice) ? voice : DEFAULT_VOICE;
}

/** Removes the key from any text before it leaves this process. */
function redact(text, key) {
  let out = String(text ?? '');
  if (key) out = out.split(key).join('[key]');
  return out.replace(/key=[^&\s"']+/g, 'key=[key]');
}

/** A protobuf duration such as "60s" or "1.5s", in milliseconds, or null. */
function durationMs(value) {
  const match = /^(\d+(?:\.\d+)?)s$/.exec(String(value ?? ''));
  return match ? Math.round(Number(match[1]) * 1000) : null;
}

function isModelError(error) {
  const text = `${error?.message ?? ''}`;
  return (/model/i.test(text) && /not found|not supported|does not exist|unavailable|not available|unsupported/i.test(text)) ||
    /NOT_FOUND/.test(String(error?.status ?? ''));
}

// A short sentence for the interface. The server's own text is not shown, because it may repeat parts of the request.
function errorMessage(error) {
  const text = `${error?.status ?? ''} ${error?.message ?? ''}`;
  if (/API key|API_KEY|PERMISSION_DENIED|UNAUTHENTICATED/i.test(text)) return 'Google did not accept the Gemini key. Check that it is still active.';
  if (/RESOURCE_EXHAUSTED|quota|rate limit|429/i.test(text)) return 'Google is busy right now. Please try again in a moment.';
  if (isModelError(error)) return 'That live model is not available for this key.';
  return 'The live conversation stopped. Try again.';
}

/** The first client message: the whole session's settings. They cannot change while the socket is open. */
function buildSetup({ model, voice, instructions, turnMode = 'auto', handle = null }) {
  const detection =
    turnMode === 'manual'
      ? { disabled: true }
      : { startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH', endOfSpeechSensitivity: 'END_SENSITIVITY_LOW', silenceDurationMs: 700 };
  return {
    setup: {
      model: `models/${normalizeModel(model)}`,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceOf(voice) } } },
      },
      systemInstruction: { parts: [{ text: String(instructions || '').slice(0, MAX_INSTRUCTIONS) }] },
      realtimeInputConfig: { automaticActivityDetection: detection, activityHandling: 'START_OF_ACTIVITY_INTERRUPTS' },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      // Without this the session ends after 15 minutes of audio; with it, the session has no time limit.
      contextWindowCompression: { slidingWindow: {} },
      sessionResumption: handle ? { handle } : {},
    },
  };
}

function buildAudioMessage(pcm) {
  const bytes = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm);
  return { realtimeInput: { audio: { data: bytes.toString('base64'), mimeType: 'audio/pcm;rate=16000' } } };
}

function buildActivityMessage(kind) {
  return { realtimeInput: kind === 'start' ? { activityStart: {} } : { activityEnd: {} } };
}

function buildTextTurn(text) {
  return { clientContent: { turns: [{ role: 'user', parts: [{ text: String(text).slice(0, MAX_TEXT) }] }], turnComplete: true } };
}

/** Reads one server message into small events. Unknown messages give no events. */
function parseServerMessage(msg) {
  const events = [];
  if (!msg || typeof msg !== 'object') return events;
  if (msg.setupComplete !== undefined) events.push({ type: 'ready' });
  const content = msg.serverContent;
  if (content) {
    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData && typeof part.inlineData.data === 'string' && part.inlineData.data) {
        events.push({ type: 'audio', mimeType: part.inlineData.mimeType || '', data: Buffer.from(part.inlineData.data, 'base64') });
      }
    }
    if (content.inputTranscription?.text) events.push({ type: 'transcript', role: 'user', text: content.inputTranscription.text });
    if (content.outputTranscription?.text) events.push({ type: 'transcript', role: 'model', text: content.outputTranscription.text });
    if (content.interrupted) events.push({ type: 'interrupted' });
    if (content.turnComplete) events.push({ type: 'turn-complete' });
  }
  if (msg.goAway) events.push({ type: 'go-away', timeLeftMs: durationMs(msg.goAway.timeLeft) });
  if (msg.sessionResumptionUpdate) {
    const update = msg.sessionResumptionUpdate;
    events.push({ type: 'resumption', handle: update.resumable && update.newHandle ? update.newHandle : null });
  }
  if (msg.voiceActivity && (msg.voiceActivity.type === 'ACTIVITY_START' || msg.voiceActivity.type === 'ACTIVITY_END')) {
    events.push({ type: 'activity', speaking: msg.voiceActivity.type === 'ACTIVITY_START' });
  }
  if (msg.error) events.push({ type: 'error', message: errorMessage(msg.error), model: isModelError(msg.error) });
  return events;
}

/**
 * The session manager. `send(channel, payload)` reaches the window, `getKey(provider)` reads the key from the key store,
 * and `WebSocketImpl` is the WebSocket class (the tests pass a fake one).
 */
function createLiveSessions({ send, getKey, WebSocketImpl = globalThis.WebSocket, backoffMs = RECONNECT_MS }) {
  let active = null;

  const emit = (record, event) => {
    if (active !== record || record.closed) return;
    // The audio is copied into a buffer of its own, so the window receives exactly these bytes.
    send('live:event', event.type === 'audio' ? { ...event, data: new Uint8Array(event.data) } : event);
  };

  // Sends one message on the open socket. A socket that is closing refuses it, and the caller says so.
  function transmit(record, message) {
    try {
      record.link.socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  function endSession(record, reason) {
    if (record.closed) return;
    record.closed = true;
    record.ready = false;
    for (const link of [record.link, record.pending]) {
      if (link) {
        link.abandoned = true;
        try {
          link.socket.close();
        } catch {
          // The socket is already closed.
        }
      }
    }
    if (active === record) active = null;
    // A talk that a new start replaces is closed quietly: the window that starts the new talk must not read the old
    // talk's ending as its own. (A window that reloaded can leave a talk open behind it.)
    if (reason !== 'replaced') send('live:event', { type: 'closed', reason });
  }

  function open(record, takeover = false) {
    const socket = new WebSocketImpl(`${URL_BASE}?key=${record.key}`);
    socket.binaryType = 'arraybuffer';
    const link = { socket, setupDone: false, abandoned: false };
    if (takeover) record.pending = link;
    else record.link = link;
    socket.onopen = () => {
      socket.send(
        JSON.stringify(
          buildSetup({ model: record.model, voice: record.voice, instructions: record.instructions, turnMode: record.turnMode, handle: record.handle }),
        ),
      );
    };
    socket.onmessage = (event) => receive(record, link, event);
    socket.onclose = () => lost(record, link);
    socket.onerror = () => {
      // The close event follows an error, and it decides what happens next.
    };
    return link;
  }

  function receive(record, link, event) {
    if (record.closed || link.abandoned) return;
    let msg;
    try {
      msg = JSON.parse(typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8'));
    } catch {
      return;
    }
    for (const item of parseServerMessage(msg)) handleEvent(record, link, item);
  }

  function handleEvent(record, link, item) {
    switch (item.type) {
      case 'ready': {
        if (link.setupDone) return;
        link.setupDone = true;
        if (record.pending === link) {
          // The takeover socket is ready: it becomes the session and the old socket closes.
          const old = record.link;
          record.link = link;
          record.pending = null;
          if (old) {
            old.abandoned = true;
            old.socket.close();
          }
        }
        record.ready = true;
        record.attempts = 0;
        emit(record, { type: 'ready', model: record.model });
        return;
      }
      case 'error': {
        if (record.pending === link) {
          // The takeover could not start: the socket that is open keeps the conversation going.
          link.abandoned = true;
          record.pending = null;
          try {
            link.socket.close();
          } catch {
            // The socket is already closed.
          }
          return;
        }
        if (!link.setupDone && item.model && record.modelIndex >= 0 && record.modelIndex + 1 < LIVE_MODELS.length) {
          // This key cannot use the model: try the next one on a fresh socket.
          record.modelIndex += 1;
          record.model = LIVE_MODELS[record.modelIndex];
          link.abandoned = true;
          link.socket.close();
          open(record);
          return;
        }
        emit(record, { type: 'error', message: item.message });
        if (!link.setupDone) endSession(record, 'error');
        return;
      }
      case 'resumption':
        if (item.handle) record.handle = item.handle;
        return;
      case 'go-away':
        if (record.link === link && !record.pending) {
          emit(record, { type: 'go-away', timeLeftMs: item.timeLeftMs });
          open(record, true);
        }
        return;
      default:
        if (record.link === link) emit(record, item);
    }
  }

  function lost(record, link) {
    if (link.abandoned || record.closed) return;
    if (record.pending === link) {
      // The takeover failed; the old socket keeps the conversation going.
      record.pending = null;
      return;
    }
    if (record.link !== link) return;
    record.ready = false;
    if (!link.setupDone) {
      emit(record, { type: 'error', message: 'Could not reach Google. Check your internet connection.' });
      endSession(record, 'connection failed');
      return;
    }
    if (record.handle && record.attempts < backoffMs.length) {
      const delay = backoffMs[record.attempts];
      record.attempts += 1;
      emit(record, { type: 'reconnecting', attempt: record.attempts });
      setTimeout(() => {
        if (!record.closed) open(record);
      }, delay);
      return;
    }
    endSession(record, 'connection lost');
  }

  function start(options = {}) {
    const key = getKey('gemini');
    if (!key) throw userError('Add a Gemini key in Settings to talk live.');
    if (active) endSession(active, 'replaced');
    const chosenModel = options.model ? normalizeModel(options.model) : null;
    const record = {
      key,
      instructions: String(options.instructions || ''),
      voice: voiceOf(options.voice),
      turnMode: options.turnMode === 'manual' ? 'manual' : 'auto',
      model: chosenModel || LIVE_MODELS[0],
      // A model chosen by the caller is used as it is; the default list may be walked down on errors.
      modelIndex: chosenModel ? -1 : 0,
      handle: null,
      link: null,
      pending: null,
      ready: false,
      closed: false,
      attempts: 0,
    };
    active = record;
    open(record);
    return { started: true, model: record.model };
  }

  function stop() {
    if (active) endSession(active, 'ended');
    return { stopped: true };
  }

  function sendAudio(frame) {
    const record = active;
    if (!record || !record.ready || !record.link) return false;
    const bytes = Buffer.isBuffer(frame) ? frame : Buffer.from(frame);
    if (bytes.length === 0 || bytes.length > MAX_FRAME_BYTES) return false;
    return transmit(record, buildAudioMessage(bytes));
  }

  function sendText(text) {
    const record = active;
    if (!record || !record.ready || !record.link) throw userError('The conversation is not ready yet.');
    const clean = String(text || '').trim();
    if (!clean) return false;
    if (!transmit(record, buildTextTurn(clean))) throw userError('The conversation was interrupted. Try again.');
    return true;
  }

  function sendActivity(kind) {
    const record = active;
    if (!record || !record.ready || !record.link || record.turnMode !== 'manual') return false;
    if (kind !== 'start' && kind !== 'end') return false;
    return transmit(record, buildActivityMessage(kind));
  }

  return {
    start,
    stop,
    sendAudio,
    sendText,
    sendActivity,
    state: () => (active ? (active.ready ? 'ready' : 'connecting') : 'idle'),
  };
}

module.exports = {
  LIVE_MODELS,
  VOICES,
  DEFAULT_VOICE,
  MAX_FRAME_BYTES,
  buildSetup,
  buildAudioMessage,
  buildActivityMessage,
  buildTextTurn,
  parseServerMessage,
  redact,
  durationMs,
  createLiveSessions,
};
