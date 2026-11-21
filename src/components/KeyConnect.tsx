// The field where a person pastes an AI key and connects it. Settings and the last step of the setup both use it, so a
// key is checked the same way in both places: its shape is shown while it is typed, and the desktop app asks the
// provider before the key is kept.
import { useId, useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { Notice, Spinner } from './ui';
import { bridge, errorText } from '../lib/bridge';
import { useT } from '../lib/i18n/react';
import type { AIModel, Provider } from '../lib/types';
import { useAI } from '../state/ai';
import { useToast } from '../state/toast';

export const PROVIDER_LABEL: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
  deepseek: 'DeepSeek',
};

/** The providers a key could belong to, shown while it is typed. The desktop app makes the real decision. */
export function candidatesFor(key: string): Provider[] {
  if (key.startsWith('sk-ant-')) return ['anthropic'];
  if (key.startsWith('sk-or-')) return ['openrouter'];
  if (/^(AIza[\w-]{30,}|AQ\.[\w-]{30,})$/.test(key)) return ['gemini'];
  if (key.startsWith('sk-proj-') || key.startsWith('sk-svcacct-') || key.startsWith('sk-admin-')) return ['openai'];
  if (key.startsWith('sk-')) return ['openai', 'deepseek'];
  return [];
}

export interface ConnectedKey {
  provider: Provider;
  label: string;
  models: AIModel[];
}

/**
 * Paste a key and connect it. `onConnected` runs once the provider has accepted the key. Outside the desktop app
 * keys cannot be kept, so the field says so instead.
 */
export function KeyConnect({ autoFocus = false, onConnected }: { autoFocus?: boolean; onConnected?: (key: ConnectedKey) => void }) {
  const t = useT();
  const ai = useAI();
  const { notify } = useToast();
  const inputId = useId();
  const [keyDraft, setKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<string | null>(null);

  if (!ai.desktop) return <Notice tone="info">{t('Keys can be added in the danna desktop app.')}</Notice>;

  const candidates = candidatesFor(keyDraft.trim());
  const detected = candidates.length > 0;
  const detectedLabel = candidates.length === 1 ? PROVIDER_LABEL[candidates[0]] : t('OpenAI or DeepSeek');

  const connect = async () => {
    if (!bridge || !detected || busy) return;
    setBusy(true);
    setError(null);
    setConnected(null);
    try {
      const result = await bridge.keys.add(keyDraft.trim());
      setKeyDraft('');
      await ai.refresh();
      // With an account open, the new key is saved to it as well, so the other devices get it.
      const locked = ai.keysLocked;
      const problem = await ai.syncNow();
      setConnected(t('{label} is connected. The newest model is selected.', { label: result.label }));
      onConnected?.({ provider: result.provider, label: result.label, models: result.models });
      if (problem) notify(t('Your AI keys could not be saved to your account: {reason}', { reason: t(problem) }), 'error');
      else if (locked) notify(t('Your key is saved on this device. Enter your account password in Settings to save it to your account too.'));
    } catch (caught) {
      setError(t(errorText(caught)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card stack">
      <div className="stack--tight">
        <label className="field__label" htmlFor={inputId}>
          {t('Your key')}
        </label>
        <div className="input-action">
          <span className="input-wrap">
            <input
              id={inputId}
              className="input"
              type={showKey ? 'text' : 'password'}
              value={keyDraft}
              onChange={(event) => setKeyDraft(event.target.value)}
              placeholder={t('Paste your key here')}
              autoComplete="off"
              spellCheck={false}
              autoFocus={autoFocus}
              disabled={busy}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void connect();
              }}
            />
            <button
              type="button"
              className="btn btn--icon"
              onClick={() => setShowKey((value) => !value)}
              aria-label={showKey ? t('Hide key') : t('Show key')}
            >
              {showKey ? <EyeOff /> : <Eye />}
            </button>
          </span>
          <button type="button" className="btn btn--primary" onClick={() => void connect()} disabled={!detected || busy}>
            {busy ? <Spinner /> : <KeyRound />} {t('Connect')}
          </button>
        </div>
      </div>
      {keyDraft.trim() && (
        <div className="row row--wrap">
          <span className={`chip ${detected ? 'chip--blue' : ''}`}>
            {detected ? t('Looks like {provider}', { provider: detectedLabel }) : t('We do not recognize this key yet')}
          </span>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {connected && <Notice tone="info">{connected}</Notice>}
    </div>
  );
}
