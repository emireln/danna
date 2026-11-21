// The coach's voice, played as it arrives. The Gemini voice comes as 16-bit PCM at 24 kHz; the app's own voices come as
// small sound files, which are decoded first. Both go through one analyser, which tells the character how loud the voice
// is, where its energy sits and its pitch.
import { bandsOf, loudnessOf, pitchOf, SILENCE, type SoundFrame } from './analysis';
import { pcm16ToFloat, VOICE_RATE } from './pcm';

export interface Player {
  /** A piece of the coach's voice: 16-bit mono PCM at 24 kHz. It plays after what is already queued. */
  pushPcm: (bytes: Uint8Array) => void;
  /** A sound file, such as the app's voices make. It is decoded, then plays after what is already queued. */
  pushFile: (bytes: Uint8Array) => void;
  /** Stops the voice at once, and drops what is queued. */
  clear: () => void;
  /** True while a sound plays or a file is being decoded. */
  busy: () => boolean;
  /** The sound now, for the character. It is silence when nothing plays. */
  sound: () => SoundFrame;
  /** Calls the listener when the voice has stopped: nothing plays and nothing waits. Returns the way to stop listening. */
  onIdle: (listener: () => void) => () => void;
  close: () => void;
}

/** How long a sound waits before it starts, so that its first moment is not cut. */
const LEAD_SECONDS = 0.08;

export function createPlayer(): Player {
  const context = new AudioContext({ sampleRate: VOICE_RATE });
  const gain = context.createGain();
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.4;
  gain.connect(analyser);
  analyser.connect(context.destination);
  const wave = new Float32Array(analyser.fftSize);
  const spectrum = new Uint8Array(analyser.frequencyBinCount);
  const playing = new Set<AudioBufferSourceNode>();
  const listeners = new Set<() => void>();
  let nextStart = 0;
  let decoding = 0;
  // Each clear() starts a new generation, so a file that was being decoded then is dropped.
  let generation = 0;
  let queue: Promise<void> = Promise.resolve();

  const busy = (): boolean => playing.size > 0 || decoding > 0;

  const announce = (): void => {
    if (busy()) return;
    for (const listener of [...listeners]) listener();
  };

  const resume = (): void => {
    if (context.state !== 'running') void context.resume().catch(() => undefined);
  };

  const schedule = (buffer: AudioBuffer): void => {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    const now = context.currentTime;
    if (nextStart < now + 0.02) nextStart = now + LEAD_SECONDS;
    source.start(nextStart);
    nextStart += buffer.duration;
    playing.add(source);
    source.onended = () => {
      playing.delete(source);
      announce();
    };
  };

  const clear = (): void => {
    generation += 1;
    for (const source of playing) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // The source has already stopped.
      }
    }
    playing.clear();
    nextStart = 0;
    announce();
  };

  return {
    pushPcm(bytes) {
      const samples = pcm16ToFloat(bytes);
      if (samples.length === 0) return;
      resume();
      const buffer = context.createBuffer(1, samples.length, VOICE_RATE);
      buffer.copyToChannel(samples, 0);
      schedule(buffer);
    },
    pushFile(bytes) {
      const token = generation;
      const copy = bytes.slice().buffer;
      decoding += 1;
      // Files are decoded one after the other, so they play in the order they were given.
      queue = queue
        .then(() => context.decodeAudioData(copy).catch(() => null))
        .then((buffer) => {
          decoding -= 1;
          if (buffer && token === generation) {
            resume();
            schedule(buffer);
          }
        })
        .catch(() => {
          // A file that cannot be played is skipped; the text is still on the screen.
        })
        .then(announce);
    },
    clear,
    busy,
    sound() {
      if (playing.size === 0) return SILENCE;
      analyser.getFloatTimeDomainData(wave);
      analyser.getByteFrequencyData(spectrum);
      const level = loudnessOf(wave);
      return {
        level,
        pitch: level > 0.02 ? pitchOf(wave, context.sampleRate) : 0,
        ...bandsOf(spectrum, context.sampleRate / analyser.fftSize),
      };
    },
    onIdle(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      clear();
      listeners.clear();
      void context.close().catch(() => undefined);
    },
  };
}
