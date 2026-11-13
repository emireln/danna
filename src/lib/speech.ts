// Reads a passage aloud. The natural voice comes from the learner's AI key, through the desktop app, which keeps
// the keys. Without a key, or outside the desktop app, the device voice reads instead, and a note says so. A voice
// that was made is kept for a while, so the same passage does not ask the provider again.
import { bridge, errorText } from './bridge';
import { t } from './i18n';
import { DEFAULT_VOICE, pickDeviceVoice } from './voices';

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
  /** A note for the learner, such as that the device voice reads instead. */
  onNotice: (message: string) => void;
}

const KEPT_VOICES = 24;
const kept = new Map<string, Promise<string | null>>();

function keep(key: string, make: () => Promise<string | null>): Promise<string | null> {
  const known = kept.get(key);
  if (known) {
    // Used again, so it is the newest and the oldest voices are forgotten first.
    kept.delete(key);
    kept.set(key, known);
    return known;
  }
  const pending = make();
  kept.set(key, pending);
  pending
    .then((url) => {
      // Nothing is kept for a text that no key could read, because a key may be added later.
      if (url === null) kept.delete(key);
    })
    .catch(() => kept.delete(key));
  while (kept.size > KEPT_VOICES) {
    const oldest = kept.keys().next().value as string;
    const old = kept.get(oldest);
    kept.delete(oldest);
    old
      ?.then((url) => {
        if (url) URL.revokeObjectURL(url);
      })
      .catch(() => undefined);
  }
  return pending;
}

async function makeVoice(text: string, voice: string): Promise<string | null> {
  if (!bridge) return null;
  const reply = await bridge.ai.speak(text, voice);
  if (reply.unavailable || !reply.audio) return null;
  // A copy in a buffer of its own, so the Blob holds exactly these bytes.
  const bytes = new Uint8Array(reply.audio);
  return URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: reply.mime ?? 'audio/mpeg' }));
}

async function savedVoice(): Promise<string> {
  if (!bridge) return 'device';
  try {
    return (await bridge.settings.get()).voice || DEFAULT_VOICE;
  } catch {
    return DEFAULT_VOICE;
  }
}

/** Reads the text aloud. Returns a handle that stops it. */
export function narrate(text: string, options: NarrationOptions): Narration {
  let finished = false;
  let audio: HTMLAudioElement | null = null;

  const finish = () => {
    if (finished) return;
    finished = true;
    window.setTimeout(options.onEnd, 0);
  };

  const playDevice = () => {
    const synth = window.speechSynthesis;
    if (!synth || finished) {
      finish();
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickDeviceVoice(synth.getVoices());
    if (voice) utterance.voice = voice;
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.onstart = () => {
      if (!finished) options.onStart();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    synth.speak(utterance);
  };

  // True when the natural voice is playing. False when no key could make it, so the device voice reads.
  const playNatural = async (voice: string): Promise<boolean> => {
    const url = await keep(`${voice}\n${text}`, () => makeVoice(text, voice));
    if (finished) return true;
    if (!url) {
      options.onNotice(
        voice === DEFAULT_VOICE
          ? t('Using the device voice. Add an OpenAI or Google Gemini key in Settings for a more natural voice.')
          : t('Add the key for this voice in Settings. Using the device voice for now.'),
      );
      return false;
    }
    audio = new Audio(url);
    audio.onplaying = () => {
      if (!finished) options.onStart();
    };
    audio.onended = finish;
    audio.onerror = () => {
      audio = null;
      playDevice();
    };
    await audio.play();
    return true;
  };

  void (async () => {
    const voice = options.voice ?? (await savedVoice());
    if (finished) return;
    if (voice !== 'device' && bridge) {
      try {
        if (await playNatural(voice)) return;
      } catch (error) {
        options.onNotice(t('The natural voice could not be used: {reason} Using the device voice for now.', { reason: t(errorText(error)) }));
      }
    }
    if (!finished) playDevice();
  })();

  return {
    stop() {
      if (finished) return;
      audio?.pause();
      window.speechSynthesis?.cancel();
      finish();
    },
  };
}
