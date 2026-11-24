// The coach's voice in a talk, as the talk uses it. With the Gemini engine the model's audio streams in while it speaks,
// with the words it says for the lip-sync. With the typed engine, each finished sentence of the app's voice is spoken in
// order. The avatar does the speaking and the lip-sync (src/avatar); this file keeps the order, the timing of the words
// and the moment the voice is idle. Pure logic, so the rules are tested with a fake avatar.
import { GAP_MS, splitWords, wordSchedule } from './wordTiming';

export type VoiceEngine = 'gemini' | 'typed';

/** What a talk needs from the coach's voice. */
export interface LiveVoice {
  /** Opens the voice for an engine: a streamed voice for Gemini, the speech queue for the typed engine. */
  begin(engine: VoiceEngine): Promise<void>;
  /** Gemini: a chunk of 24 kHz 16-bit PCM from the model. */
  pushPcm(data: Uint8Array): void;
  /** Gemini: the words the model is saying now, for the lip-sync. */
  pushWords(text: string): void;
  /** Gemini: the model's turn is complete. */
  endTurn(): void;
  /** Typed: a whole sentence of the app's voice (its audio pieces, in order) and the text those pieces say. */
  speakClip(pieces: Uint8Array[], text: string): void;
  /** Stops the coach's voice at once. */
  clear(): void;
  /** True while the voice speaks or has speech waiting. */
  busy(): boolean;
  /** Called when the voice has nothing left to say. Returns a function that removes the listener. */
  onIdle(listener: () => void): () => void;
  /** Ends the voice for this talk. The face stays on the stage. */
  end(): void;
}

/** The avatar's voice calls that the voice uses. The avatar (src/avatar/avatarHead.ts) implements them. */
export interface VoiceHead {
  /** Reads the audio pieces of one sentence as one buffer, or returns null when nothing can be read. */
  decode(pieces: Uint8Array[]): Promise<AudioBuffer | null>;
  streamStart(onAudioStart: () => void, onAudioEnd: () => void): Promise<void>;
  streamAudio(chunk: { audio?: Uint8Array; words?: string[]; wtimes?: number[]; wdurations?: number[] }): void;
  streamNotifyEnd(): void;
  streamInterrupt(): void;
  streamStop(): void;
  speak(audio: AudioBuffer, words: string[], wtimes: number[], wdurations: number[], onDone: () => void): void;
  stopSpeaking(): void;
}

export function createLiveVoice(head: VoiceHead): LiveVoice {
  let engine: VoiceEngine | null = null;
  // Gemini: the model's audio is playing now.
  let playing = false;
  // Gemini: an utterance is open. Its words count from its own start, cursor milliseconds in.
  let open = false;
  let cursor = 0;
  // Typed: sentences queued and not yet finished.
  let pending = 0;
  // Changes when the voice is cleared or ended, so a sentence still being read, or a late end signal, is ignored.
  let generation = 0;
  let chain: Promise<void> = Promise.resolve();
  const idleListeners = new Set<() => void>();
  let wasBusy = false;

  const busy = (): boolean => playing || pending > 0;

  // Tells the listeners once when the voice goes from speaking to idle.
  const settle = (): void => {
    const now = busy();
    if (wasBusy && !now) for (const listener of [...idleListeners]) listener();
    wasBusy = now;
  };

  const beginUtterance = (): void => {
    if (open) return;
    open = true;
    cursor = 0;
  };

  const resetState = (): void => {
    generation += 1;
    playing = false;
    open = false;
    cursor = 0;
    pending = 0;
  };

  return {
    async begin(next) {
      resetState();
      engine = next;
      if (next === 'gemini') {
        await head.streamStart(
          () => {
            playing = true;
            settle();
          },
          () => {
            playing = false;
            open = false;
            settle();
          },
        );
      } else {
        head.streamStop();
      }
      wasBusy = false;
    },

    pushPcm(data) {
      if (engine !== 'gemini') return;
      beginUtterance();
      head.streamAudio({ audio: data });
    },

    pushWords(text) {
      if (engine !== 'gemini') return;
      const words = splitWords(text);
      if (words.length === 0) return;
      beginUtterance();
      const times = wordSchedule(words, cursor);
      cursor = times.endMs + GAP_MS;
      head.streamAudio({ words, wtimes: times.wtimes, wdurations: times.wdurations });
    },

    endTurn() {
      if (engine !== 'gemini') return;
      head.streamNotifyEnd();
      open = false;
    },

    speakClip(pieces, text) {
      if (engine !== 'typed') return;
      pending += 1;
      settle();
      const token = generation;
      const done = (): void => {
        if (token !== generation) return;
        pending = Math.max(0, pending - 1);
        settle();
      };
      // Sentences are decoded one after another, so they are spoken in the order they were written.
      chain = chain.then(async () => {
        if (token !== generation) return;
        let buffer: AudioBuffer | null = null;
        try {
          buffer = await head.decode(pieces);
        } catch {
          buffer = null;
        }
        const words = splitWords(text);
        if (token !== generation || !buffer || words.length === 0) {
          done();
          return;
        }
        const times = wordSchedule(words, 0, buffer.duration * 1000);
        head.speak(buffer, words, times.wtimes, times.wdurations, done);
      });
    },

    clear() {
      resetState();
      if (engine === 'gemini') head.streamInterrupt();
      head.stopSpeaking();
      settle();
    },

    busy,

    onIdle(listener) {
      idleListeners.add(listener);
      return () => {
        idleListeners.delete(listener);
      };
    },

    end() {
      resetState();
      if (engine === 'gemini') head.streamStop();
      head.stopSpeaking();
      engine = null;
      settle();
    },
  };
}
