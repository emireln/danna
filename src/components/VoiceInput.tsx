// Speaking to the coach: a press starts a recording, and a second press sends it to be written down. The words come
// back to the message box, or go straight to the coach in speaking practice. The recording is written down by an
// OpenAI or Gemini key, so the button is off without one.
import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useT } from '../lib/i18n/react';

/** A recording stops by itself after this long, so one forgotten press cannot record for good. */
const LONGEST_RECORDING_MS = 120_000;

export type VoicePhase = 'idle' | 'recording' | 'writing';

/** The microphone of the coach: records, writes the words down, and hands them on. */
export function useVoiceInput(
  transcribe: (audio: Blob) => Promise<string>,
  onText: (text: string) => void,
  onError: (error: unknown) => void,
) {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  // The latest callbacks, so the words reach the screen as it is now, not as it was when the press started.
  const handlers = useRef({ transcribe, onText, onError });
  handlers.current = { transcribe, onText, onError };
  const supported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices) && typeof MediaRecorder !== 'undefined';

  const release = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  useEffect(
    () => () => {
      if (recorder.current && recorder.current.state === 'recording') recorder.current.stop();
      release();
    },
    [],
  );

  const stop = () => {
    if (recorder.current && recorder.current.state === 'recording') recorder.current.stop();
  };

  const start = async () => {
    if (!supported) {
      handlers.current.onError(new Error('Recording is not available on this device.'));
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const instance = new MediaRecorder(stream.current);
      recorder.current = instance;
      instance.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      instance.onstop = () => {
        release();
        recorder.current = null;
        const blob = new Blob(chunks, { type: instance.mimeType || 'audio/webm' });
        if (blob.size === 0) {
          setPhase('idle');
          return;
        }
        setPhase('writing');
        handlers.current
          .transcribe(blob)
          .then((text) => {
            const words = text.trim();
            if (words) handlers.current.onText(words);
          })
          .catch((error: unknown) => handlers.current.onError(error))
          .finally(() => setPhase('idle'));
      };
      instance.start();
      setPhase('recording');
      timer.current = window.setTimeout(stop, LONGEST_RECORDING_MS);
    } catch (error) {
      release();
      setPhase('idle');
      handlers.current.onError(error);
    }
  };

  return { phase, start, stop, supported };
}

/** The microphone button. It is off while the words are being written down, or without an OpenAI or Gemini key. */
export function VoiceButton({
  phase,
  supported,
  enabled,
  onStart,
  onStop,
}: {
  phase: VoicePhase;
  supported: boolean;
  enabled: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const t = useT();
  const recording = phase === 'recording';
  const label = !enabled
    ? t('Add an OpenAI or Gemini key in Settings to speak to your coach.')
    : recording
      ? t('Stop and send what you said')
      : phase === 'writing'
        ? t('Writing down what you said…')
        : t('Speak to your coach');
  return (
    <button
      type="button"
      className={`btn btn--ghost btn--icon coach-voice${recording ? ' is-recording' : ''}`}
      onClick={recording ? onStop : onStart}
      disabled={!enabled || !supported || phase === 'writing'}
      aria-label={label}
      aria-pressed={recording}
      title={label}
    >
      {recording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
    </button>
  );
}
