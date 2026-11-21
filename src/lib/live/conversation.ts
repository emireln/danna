// The live conversation. The learner talks and the coach answers with a voice and a face. Two engines do the talking:
//  - the Gemini engine uses the Gemini Live API with the learner's Gemini key. The voice is the model's own, and the main
//    process keeps the key.
//  - the typed engine uses the learner's text provider (whichever key they set up) and reads each sentence with the app's
//    own voice, the one chosen in Settings. It is the way to talk with any key that has no live voice.
// Both keep the same transcript and drive the same character.
import type { ReplyStream } from '../../state/ai';
import { errorText, type CompletionRequest, type DannaBridge, type LiveEvent, type SpeechChunk } from '../bridge';
import { t } from '../i18n';
import type { ChatMessage } from '../types';
import { SILENCE, type SoundFrame } from './analysis';
import { openMicrophone as microphone, type Microphone } from './mic';
import { createPlayer as makePlayer, type Player } from './player';
import { takeSentences, toSpeech } from './sentences';

export type LiveEngine = 'gemini' | 'typed';
export type LiveStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'ended';

export interface LiveLine {
  id: number;
  role: 'user' | 'coach';
  text: string;
  /** The line is still being written. */
  open: boolean;
}

export interface LiveState {
  status: LiveStatus;
  engine: LiveEngine | null;
  /** The live model in use (Gemini engine). */
  model: string | null;
  lines: LiveLine[];
  /** The learner's voice is heard now (Gemini engine). */
  userSpeaking: boolean;
  muted: boolean;
  /** A short note that does not end the talk, such as a reconnection. */
  notice: string | null;
  /** Why the talk ended with a problem, or null. */
  error: string | null;
  /** The talk has ended, for any reason. The transcript stays, so it can be saved. */
  ended: boolean;
}

export interface LiveStartOptions {
  engine: LiveEngine;
  instructions: string;
  /** A Gemini voice name, such as 'Puck' (Gemini engine). */
  voice: string;
  /** The app's voice, chosen in Settings (typed engine). */
  appVoice: string;
  turnMode: 'auto' | 'manual';
  /** A live model name (Gemini engine). Left out, the default is used. */
  model?: string;
}

export interface LiveConversation {
  snapshot: () => LiveState;
  subscribe: (listener: () => void) => () => void;
  /** The sound now: the coach's voice, and how loud the learner is. The character reads it every frame. */
  sound: () => { coach: SoundFrame; user: number };
  start: (options: LiveStartOptions) => Promise<void>;
  /** A typed message. It interrupts the coach, if the coach is speaking. */
  sendText: (text: string) => Promise<void>;
  /** Stops the coach at once, and keeps the talk going. */
  interrupt: () => void;
  setMuted: (muted: boolean) => void;
  /** Manual turns only: true while the learner holds the talk button. */
  setTalking: (talking: boolean) => void;
  /** Ends the talk. The transcript stays. */
  stop: () => void;
}

export interface LiveDependencies {
  /** The desktop bridge. Null in a browser, where a talk cannot start. */
  bridge: DannaBridge | null;
  startReply: (request: CompletionRequest, onDelta: (piece: string) => void) => ReplyStream;
  openMicrophone?: (onFrame: (frame: ArrayBuffer, level: number) => void, sending: () => boolean) => Promise<Microphone>;
  createPlayer?: () => Player;
}

/** A reply is short: a few sentences, as a talk needs. */
const REPLY_TOKENS = 500;
/** The lines the typed engine sends back with each reply. */
const HISTORY_LINES = 30;

const IDLE: LiveState = {
  status: 'idle',
  engine: null,
  model: null,
  lines: [],
  userSpeaking: false,
  muted: false,
  notice: null,
  error: null,
  ended: false,
};

/** One sentence of the coach's voice, made by the app's voice. Its pieces arrive by id and play in order. */
interface Clip {
  id: string;
  parts: Uint8Array[];
  pushed: number;
  done: boolean;
}

interface Session {
  engine: LiveEngine;
  options: LiveStartOptions;
  bridge: DannaBridge | null;
  closed: boolean;
  /** The Gemini session was opened, so it must be closed with this talk. */
  started: boolean;
  player: Player | null;
  mic: Microphone | null;
  micLevel: number;
  unsubscribe: Array<() => void>;
  lastError: string | null;
  // Typed engine.
  reply: ReplyStream | null;
  replyToken: number;
  clips: Clip[];
  clipById: Map<string, Clip>;
  playhead: number;
}

function randomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `live-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function historyOf(lines: LiveLine[]): ChatMessage[] {
  return lines
    .filter((line) => line.text.trim() !== '')
    .slice(-HISTORY_LINES)
    .map((line) => ({ role: line.role === 'user' ? 'user' : 'assistant', content: line.text }));
}

function reasonText(reason: string): string {
  if (reason === 'connection lost') return t('The connection was lost. Start the talk again to carry on.');
  if (reason === 'connection failed') return t('Could not reach Google. Check your internet connection.');
  return t('The live conversation stopped. Try again.');
}

export function createLiveConversation(deps: LiveDependencies): LiveConversation {
  const openMic = deps.openMicrophone ?? microphone;
  const makeVoice = deps.createPlayer ?? makePlayer;
  let state: LiveState = IDLE;
  const listeners = new Set<() => void>();
  let session: Session | null = null;
  let lineCounter = 0;
  let replyCounter = 0;
  let muted = false;
  let talking = false;

  const publish = (patch: Partial<LiveState>): void => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener();
  };

  const setStatus = (status: LiveStatus): void => {
    if (state.status !== status && !state.ended) publish({ status });
  };

  const note = (message: string): void => publish({ notice: message });

  const addLine = (role: 'user' | 'coach', text: string): number => {
    const last = state.lines[state.lines.length - 1];
    if (last && last.open && last.role === role) {
      publish({ lines: [...state.lines.slice(0, -1), { ...last, text: last.text + text }] });
      return last.id;
    }
    lineCounter += 1;
    const closed = state.lines.map((line) => (line.open ? { ...line, open: false } : line));
    publish({ lines: [...closed, { id: lineCounter, role, text, open: true }] });
    return lineCounter;
  };

  const replaceLine = (id: number, text: string, open: boolean): void => {
    publish({ lines: state.lines.map((line) => (line.id === id ? { ...line, text, open } : line)) });
  };

  const closeLines = (): void => {
    if (state.lines.some((line) => line.open)) publish({ lines: state.lines.map((line) => ({ ...line, open: false })) });
  };

  // ----- typed engine -----

  /** The status of the typed engine: speaking while a voice plays or waits, thinking while a reply is written. */
  const settleTyped = (current: Session): void => {
    if (current.player?.busy() || current.playhead < current.clips.length) setStatus('speaking');
    else if (current.reply) setStatus('thinking');
    else setStatus('listening');
  };

  /** Plays the clips in order: a clip's pieces go to the player only when every clip before it has finished. */
  const pump = (current: Session): void => {
    while (current.playhead < current.clips.length) {
      const clip = current.clips[current.playhead];
      while (clip.pushed < clip.parts.length) current.player?.pushFile(clip.parts[clip.pushed++]);
      if (!clip.done) break;
      current.playhead += 1;
    }
    settleTyped(current);
  };

  const speak = (current: Session, sentence: string): void => {
    // A voice reads words, so the markdown of the reply is left out before the sentence is made.
    const words = toSpeech(sentence);
    const api = current.bridge;
    if (!words || !api) return;
    const clip: Clip = { id: randomId(), parts: [], pushed: 0, done: false };
    current.clips.push(clip);
    current.clipById.set(clip.id, clip);
    api.speech
      .start(clip.id, words, current.options.appVoice)
      .then((info) => {
        if (info.note) note(t(info.note));
      })
      .catch((error: unknown) => {
        if (current.closed) return;
        clip.done = true;
        note(t(errorText(error)));
        pump(current);
      });
  };

  const onSpeechChunk = (current: Session, chunk: SpeechChunk): void => {
    const clip = current.clipById.get(chunk.id);
    if (!clip || current.closed) return;
    if (chunk.note) note(t(chunk.note));
    if (chunk.audio && chunk.audio.byteLength > 0) clip.parts.push(chunk.audio);
    if (chunk.error) note(t(chunk.error));
    if (chunk.done) clip.done = true;
    pump(current);
  };

  /** Stops the reply and the voice of the typed engine. The transcript stays. */
  const cancelTyped = (current: Session): void => {
    const reply = current.reply;
    current.reply = null;
    current.replyToken = 0;
    reply?.stop();
    for (const clip of current.clips) {
      if (!clip.done) void current.bridge?.speech.stop(clip.id).catch(() => undefined);
    }
    current.clips = [];
    current.clipById.clear();
    current.playhead = 0;
    current.player?.clear();
  };

  const sendTyped = (current: Session, text: string): void => {
    cancelTyped(current);
    addLine('user', text);
    closeLines();
    const history = historyOf(state.lines);
    const id = addLine('coach', '');
    const token = ++replyCounter;
    current.replyToken = token;
    let full = '';
    let buffer = '';
    const reply = deps.startReply(
      { system: current.options.instructions, messages: history, maxTokens: REPLY_TOKENS },
      (piece) => {
        if (current.replyToken !== token || current.closed) return;
        full += piece;
        buffer += piece;
        replaceLine(id, toSpeech(full), true);
        const cut = takeSentences(buffer);
        buffer = cut.rest;
        for (const sentence of cut.sentences) speak(current, sentence);
        settleTyped(current);
      },
    );
    current.reply = reply;
    setStatus('thinking');
    reply.done
      .then(() => {
        if (current.replyToken !== token || current.closed) return;
        current.reply = null;
        const rest = takeSentences(buffer, true);
        buffer = '';
        for (const sentence of rest.sentences) speak(current, sentence);
        replaceLine(id, toSpeech(full), false);
        settleTyped(current);
      })
      .catch((error: unknown) => {
        if (current.replyToken !== token || current.closed) return;
        current.reply = null;
        replaceLine(id, toSpeech(full), false);
        note(t(errorText(error)));
        settleTyped(current);
      });
  };

  // ----- Gemini engine -----

  const finishGemini = (current: Session, reason: string): void => {
    const ended = reason === 'ended' || reason === 'replaced';
    current.started = false;
    teardown(current);
    if (session === current) session = null;
    publish({
      status: 'ended',
      ended: true,
      userSpeaking: false,
      notice: null,
      error: ended ? null : (current.lastError ?? reasonText(reason)),
    });
  };

  const onGeminiEvent = (current: Session, event: LiveEvent): void => {
    if (current.closed) return;
    switch (event.type) {
      case 'ready':
        publish({ notice: null });
        setStatus('listening');
        return;
      case 'audio':
        current.player?.pushPcm(event.data);
        setStatus('speaking');
        return;
      case 'transcript':
        addLine(event.role === 'user' ? 'user' : 'coach', event.text);
        return;
      case 'interrupted':
        current.player?.clear();
        closeLines();
        setStatus('listening');
        return;
      case 'turn-complete':
        closeLines();
        if (!current.player?.busy()) setStatus('listening');
        return;
      case 'activity':
        publish({ userSpeaking: event.speaking });
        if (event.speaking) setStatus('listening');
        else if (!current.player?.busy()) setStatus('thinking');
        return;
      case 'go-away':
        note(t('The connection is being renewed. The talk goes on.'));
        return;
      case 'reconnecting':
        note(t('The connection dropped. Reconnecting…'));
        setStatus('connecting');
        return;
      case 'error':
        current.lastError = t(event.message);
        note(t(event.message));
        return;
      case 'closed':
        finishGemini(current, event.reason);
        return;
      default:
        return;
    }
  };

  const sendGemini = (current: Session, text: string): void => {
    const api = current.bridge;
    if (!api) return;
    addLine('user', text);
    closeLines();
    setStatus('thinking');
    api.live.sendText(text).catch((error: unknown) => note(t(errorText(error))));
  };

  // ----- shared -----

  /** Frees what the talk holds: the microphone, the voice, the listeners and the engine's session. */
  const teardown = (current: Session): void => {
    if (current.closed) return;
    current.closed = true;
    for (const off of current.unsubscribe.splice(0)) off();
    current.mic?.stop();
    current.mic = null;
    current.player?.close();
    current.player = null;
    if (current.engine === 'typed') cancelTyped(current);
    if (current.engine === 'gemini' && current.started) void current.bridge?.live.stop().catch(() => undefined);
  };

  const fail = (current: Session, message: string): void => {
    teardown(current);
    if (session === current) session = null;
    publish({ status: 'ended', ended: true, userSpeaking: false, error: message });
  };

  const stopSession = (report: boolean): void => {
    const current = session;
    if (!current) return;
    session = null;
    teardown(current);
    if (report) publish({ status: 'ended', ended: true, userSpeaking: false, notice: null, error: null });
  };

  const startGemini = async (current: Session, api: DannaBridge, options: LiveStartOptions): Promise<void> => {
    // The voice is made first, so the learner's click is what allows the sound to play.
    current.player = makeVoice();
    current.player.onIdle(() => {
      if (session === current && state.status === 'speaking') setStatus('listening');
    });
    current.unsubscribe.push(api.live.onEvent((event) => onGeminiEvent(current, event)));
    let started: { started: true; model: string };
    try {
      started = await api.live.start({
        instructions: options.instructions,
        voice: options.voice,
        turnMode: options.turnMode,
        model: options.model,
      });
    } catch (error) {
      fail(current, t(errorText(error)));
      return;
    }
    if (current.closed) {
      // The talk was stopped while it was opening, so the session that opened is closed here.
      void api.live.stop().catch(() => undefined);
      return;
    }
    current.started = true;
    publish({ model: started.model });
    try {
      const mic = await openMic(
        (frame, level) => {
          current.micLevel = level;
          api.live.sendAudio(frame);
        },
        () => !muted && (options.turnMode !== 'manual' || talking),
      );
      if (current.closed) {
        mic.stop();
        return;
      }
      current.mic = mic;
    } catch (error) {
      fail(current, t(errorText(error)));
    }
  };

  const startTyped = (current: Session): void => {
    current.player = makeVoice();
    current.player.onIdle(() => {
      if (session === current) settleTyped(current);
    });
    if (current.bridge) current.unsubscribe.push(current.bridge.speech.onChunk((chunk) => onSpeechChunk(current, chunk)));
    setStatus('listening');
  };

  const start = async (options: LiveStartOptions): Promise<void> => {
    stopSession(false);
    const current: Session = {
      engine: options.engine,
      options: { ...options, appVoice: options.appVoice || 'auto' },
      bridge: deps.bridge,
      closed: false,
      started: false,
      player: null,
      mic: null,
      micLevel: 0,
      unsubscribe: [],
      lastError: null,
      reply: null,
      replyToken: 0,
      clips: [],
      clipById: new Map(),
      playhead: 0,
    };
    session = current;
    muted = false;
    talking = false;
    publish({ ...IDLE, status: 'connecting', engine: options.engine, muted: false });
    const api = deps.bridge;
    if (!api) {
      fail(current, t('Talk live works in the danna desktop app.'));
      return;
    }
    if (options.engine === 'gemini') await startGemini(current, api, options);
    else startTyped(current);
  };

  return {
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    sound() {
      const current = session;
      return {
        coach: current?.player?.sound() ?? SILENCE,
        user: current && !muted ? current.micLevel : 0,
      };
    },
    start,
    async sendText(text) {
      const clean = text.trim();
      const current = session;
      if (!clean || !current || current.closed) return;
      if (current.engine === 'gemini') sendGemini(current, clean);
      else sendTyped(current, clean);
    },
    interrupt() {
      const current = session;
      if (!current) return;
      if (current.engine === 'typed') {
        cancelTyped(current);
        closeLines();
        settleTyped(current);
        return;
      }
      current.player?.clear();
      closeLines();
      setStatus('listening');
    },
    setMuted(value) {
      muted = value;
      publish({ muted: value });
    },
    setTalking(value) {
      const current = session;
      talking = value;
      if (!current || current.engine !== 'gemini' || !current.started || current.options.turnMode !== 'manual') return;
      current.bridge?.live.sendActivity(value ? 'start' : 'end');
    },
    stop() {
      stopSession(true);
    },
  };
}
