// Reads a passage aloud. In the desktop app the sound is made on this computer: by the built-in voice, by a voice
// installed on this PC, or, with the learner's own key, by a cloud voice. The sound comes in pieces, so the first words
// play while the rest is still being made. In a browser, the browser's own voice reads, and a note says so.
import { bridge, errorText, type DannaBridge, type SpeechChunk } from './bridge';
import { t } from './i18n';
import { DEFAULT_VOICE, DEFAULT_VOLUME, pickDeviceVoice, volumeLevel } from './voices';

export interface Narration {
  stop: () => void;
}

export interface NarrationOptions {
  /** The voice to use. Without it, the voice the learner chose in Settings is used. */
  voice?: string;
  /** The voice has started. */
  onStart: () => void;
  /** The voice has finished or was stopped. Called once, after the caller has the handle from narrate. */
  onEnd: () => void;
  /** A note for the learner, such as that another voice reads instead. */
  onNotice: (message: string) => void;
}

/** Reads the text aloud. Returns a handle that stops it. */
export function narrate(text: string, options: NarrationOptions): Narration {
  if (!bridge) return narrateInBrowser(text, options);
  return narrateInApp(bridge, text, options);
}

/** The loudness and the voice the learner chose in Settings. */
async function savedSettings(api: DannaBridge): Promise<{ voice: string; volume: number }> {
  try {
    const settings = await api.settings.get();
    return { voice: settings.voice || DEFAULT_VOICE, volume: volumeLevel(settings.voiceVolume) };
  } catch {
    return { voice: DEFAULT_VOICE, volume: DEFAULT_VOLUME };
  }
}

function randomReadingId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `read-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Reads with the browser's own voice. It is used in a browser, and when the desktop app cannot read. */
function speakInBrowser(text: string, loudness: number, onStart: () => void, onEnd: () => void): () => void {
  const synth = window.speechSynthesis;
  if (!synth) {
    window.setTimeout(onEnd, 0);
    return () => undefined;
  }
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onEnd();
  };
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickDeviceVoice(synth.getVoices());
  if (voice) utterance.voice = voice;
  utterance.lang = 'en-US';
  utterance.rate = 0.95;
  utterance.volume = loudness;
  utterance.onstart = () => {
    if (!finished) onStart();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  synth.speak(utterance);
  return () => {
    synth.cancel();
    finish();
  };
}

function narrateInBrowser(text: string, options: NarrationOptions): Narration {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.setTimeout(options.onEnd, 0);
  };
  options.onNotice(t('The built-in voices are in the desktop app. Here the browser’s own voice reads.'));
  const stopSpeaking = speakInBrowser(text, DEFAULT_VOLUME / 100, () => options.onStart(), finish);
  return {
    stop() {
      if (finished) return;
      stopSpeaking();
      finish();
    },
  };
}

/** The desktop app makes the sound. The pieces of it arrive by id, and each one is played as soon as it is there. */
function narrateInApp(api: DannaBridge, text: string, options: NarrationOptions): Narration {
  const readingId = randomReadingId();
  const queue: string[] = [];
  let audio: HTMLAudioElement | null = null;
  let loudness = DEFAULT_VOLUME / 100;
  let finished = false;
  let started = false;
  let streamEnded = false;
  let stopListening: () => void = () => undefined;
  let stopBrowser: (() => void) | null = null;

  const finish = () => {
    if (finished) return;
    finished = true;
    stopListening();
    for (const url of queue.splice(0)) URL.revokeObjectURL(url);
    window.setTimeout(options.onEnd, 0);
  };

  const beginSound = () => {
    if (started || finished) return;
    started = true;
    options.onStart();
  };

  const playNext = () => {
    if (finished) return;
    const url = queue.shift();
    if (!url) {
      audio = null;
      if (streamEnded) finish();
      return;
    }
    const element = new Audio(url);
    element.volume = loudness;
    element.onplaying = beginSound;
    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      URL.revokeObjectURL(url);
      audio = null;
      playNext();
    };
    element.onended = advance;
    element.onerror = advance;
    audio = element;
    element.play().catch(advance);
  };

  const onChunk = (chunk: SpeechChunk) => {
    if (chunk.id !== readingId || finished) return;
    if (chunk.note) options.onNotice(t(chunk.note));
    if (chunk.audio) {
      // A copy in a buffer of its own, so the Blob holds exactly these bytes.
      const bytes = new Uint8Array(chunk.audio);
      queue.push(URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: chunk.mime ?? 'audio/wav' })));
      if (!audio) playNext();
    }
    if (!chunk.done) return;
    streamEnded = true;
    if (chunk.error && !started) {
      // Nothing was heard yet, so the browser's voice reads the text instead.
      for (const url of queue.splice(0)) URL.revokeObjectURL(url);
      options.onNotice(t('The voice could not be used. Using the browser voice for now.'));
      stopBrowser = speakInBrowser(text, loudness, beginSound, finish);
      return;
    }
    if (chunk.error) options.onNotice(t(chunk.error));
    if (!audio && queue.length === 0) finish();
  };

  stopListening = api.speech.onChunk(onChunk);

  void (async () => {
    const saved = await savedSettings(api);
    loudness = saved.volume / 100;
    if (finished) return;
    try {
      const reply = await api.speech.start(readingId, text, options.voice ?? saved.voice);
      if (reply.note) options.onNotice(t(reply.note));
      // Stopped while the reading was starting: the desktop app is told to stop as well.
      if (finished) void api.speech.stop(readingId).catch(() => undefined);
    } catch (error) {
      if (finished) return;
      options.onNotice(t(errorText(error)));
      stopBrowser = speakInBrowser(text, loudness, beginSound, finish);
    }
  })();

  return {
    stop() {
      if (finished) return;
      audio?.pause();
      audio = null;
      stopBrowser?.();
      void api.speech.stop(readingId).catch(() => undefined);
      finish();
    },
  };
}
