// The voices a learner can listen with, in four groups: automatic, the voices built into DANNA, the voices installed on
// this PC (the natural ones first), and the cloud voices of the keys the learner added. Each voice can be heard before
// it is chosen, and a voice that is not available is shown, with the reason.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { Notice } from './ui';
import { bridge, type SpeechVoices } from '../lib/bridge';
import { useT } from '../lib/i18n/react';
import { narrate, type Narration } from '../lib/speech';
import { BUILTIN_VOICES, GEMINI_VOICES, OPENAI_VOICES, windowsChoice } from '../lib/voices';

// The sample is English, whatever the language of the screen.
const SAMPLE = 'Hello! Listen closely to how this voice sounds. Then try to repeat each sentence after it.';

function title(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

interface VoicePickerProps {
  /** The choice that is saved now: 'auto', 'builtin:<id>', 'windows:<id>', or a cloud voice such as 'openai:coral'. */
  value: string;
  onChoose: (choice: string) => void;
}

export function VoicePicker({ value, onChoose }: VoicePickerProps) {
  const t = useT();
  const [voices, setVoices] = useState<SpeechVoices | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookFailed, setLookFailed] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reading = useRef<{ choice: string; handle: Narration } | null>(null);

  const look = useCallback(() => {
    if (!bridge) return;
    setLooking(true);
    setLookFailed(false);
    bridge.speech
      .voices()
      .then((found) => setVoices(found))
      .catch(() => setLookFailed(true))
      .finally(() => setLooking(false));
  }, []);

  useEffect(() => {
    look();
    return () => reading.current?.handle.stop();
  }, [look]);

  const listen = (choice: string) => {
    const current = reading.current;
    reading.current = null;
    current?.handle.stop();
    if (current?.choice === choice) {
      setPlaying(null);
      return;
    }
    setNotice(null);
    setPlaying(choice);
    const handle = narrate(SAMPLE, {
      voice: choice,
      onStart: () => undefined,
      onEnd: () => setPlaying((now) => (now === choice ? null : now)),
      onNotice: (message) => setNotice(message),
    });
    reading.current = { choice, handle };
  };

  const builtinReady = (id: string) => voices?.builtin.find((voice) => voice.id === id)?.ready ?? true;

  // One row: the choice itself (a radio), and a button that plays the sample with that voice.
  const row = (choice: string, label: string, meta: string | null, { disabled = false, tag }: { disabled?: boolean; tag?: string } = {}) => (
    <div className="voice-row" key={choice}>
      <button
        type="button"
        role="radio"
        aria-checked={value === choice}
        className="model voice-row__choice"
        disabled={disabled}
        onClick={() => onChoose(choice)}
      >
        <span className="model__radio" aria-hidden="true" />
        <span className="model__label">
          {label}
          {meta && <span className="voice-row__meta">{meta}</span>}
        </span>
        {tag && <span className="latest">{tag}</span>}
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--sm voice-row__listen"
        disabled={disabled}
        aria-pressed={playing === choice}
        aria-label={`${playing === choice ? t('Stop reading') : t('Listen')}: ${label}`}
        onClick={() => listen(choice)}
      >
        {playing === choice ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        <span>{playing === choice ? t('Stop reading') : t('Listen')}</span>
      </button>
    </div>
  );

  const genderOf = (gender: string) => (gender === 'female' ? t('female') : gender === 'male' ? t('male') : '');

  return (
    <div className="stack">
      <p className="small muted">
        {t('Reads the listening passages and the coach’s replies aloud. The built-in voices work offline, with no key.')}
      </p>

      <p className="field__label">{t('Automatic')}</p>
      <div className="model-list" role="radiogroup" aria-label={t('Automatic')}>
        {row('auto', t('Automatic'), t('A cloud voice when you have an AI key, otherwise the built-in voice.'))}
      </div>

      <p className="field__label">{t('Built-in voices, offline')}</p>
      <div className="model-list" role="radiogroup" aria-label={t('Built-in voices, offline')}>
        {BUILTIN_VOICES.map((voice) => {
          const ready = builtinReady(voice.id);
          const accent = voice.accent === 'uk' ? t('UK English') : t('US English');
          const meta = [accent, genderOf(voice.gender)].filter(Boolean).join(' · ');
          return row(`builtin:${voice.id}`, voice.name, ready ? meta : t('Not in this copy of DANNA'), { disabled: !ready });
        })}
      </div>

      <div className="voice-group__head">
        <p className="field__label">{t('On this PC')}</p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={look} disabled={looking}>
          {looking ? t('Looking for the voices on this PC…') : t('Look again')}
        </button>
      </div>
      {lookFailed && <Notice tone="warn">{t('Could not read the voices on this PC.')}</Notice>}
      {voices?.windowsError && <Notice tone="warn">{t(voices.windowsError)}</Notice>}
      {voices && voices.windows.length === 0 && !voices.windowsError && (
        <p className="small muted">{t('No voices were found on this PC.')}</p>
      )}
      <div className="model-list" role="radiogroup" aria-label={t('On this PC')}>
        {(voices?.windows ?? []).map((voice) => {
          const meta = [voice.language, genderOf(voice.gender)].filter(Boolean).join(' · ');
          return row(windowsChoice(voice.id), voice.name, meta, { tag: voice.natural ? t('Natural') : undefined });
        })}
      </div>

      <p className="field__label">{t('With your AI keys')}</p>
      <div className="model-list" role="radiogroup" aria-label={t('With your AI keys')}>
        {OPENAI_VOICES.map((name) =>
          row(`openai:${name}`, `OpenAI · ${title(name)}`, voices?.cloud.openai ? null : t('Needs the key for {provider}', { provider: 'OpenAI' }), {
            disabled: !voices?.cloud.openai,
          }),
        )}
        {GEMINI_VOICES.map((name) =>
          row(`gemini:${name}`, `Google Gemini · ${name}`, voices?.cloud.gemini ? null : t('Needs the key for {provider}', { provider: 'Google Gemini' }), {
            disabled: !voices?.cloud.gemini,
          }),
        )}
      </div>

      {notice && <p className="small muted">{notice}</p>}
    </div>
  );
}
