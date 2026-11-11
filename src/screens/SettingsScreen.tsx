import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Lock, Megaphone, Trash2 } from 'lucide-react';
import { Empty, Field, Notice, Spinner } from '../components/ui';
import { bridge, errorText } from '../lib/bridge';
import { useAI } from '../state/ai';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import type { AIModel, Provider } from '../lib/types';

const PROVIDER_LABEL: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
};

/** Mirrors the main-process detection so the label appears while typing. The main process decides for real. */
function detectClient(key: string): Provider | null {
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-or-')) return 'openrouter';
  if (/^AIza[\w-]{30,}$/.test(key)) return 'gemini';
  if (key.startsWith('sk-')) return 'openai';
  return null;
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const { mode, email, signOut } = useAuth();
  const ai = useAI();
  const { notify } = useToast();
  const [version, setVersion] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelsFor, setModelsFor] = useState<Provider | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const detected = detectClient(keyDraft.trim());

  useEffect(() => {
    bridge
      ?.info()
      .then((info) => setVersion(info.version))
      .catch(() => undefined);
  }, []);

  const connect = async () => {
    if (!bridge) return;
    setBusy(true);
    setError(null);
    try {
      const result = await bridge.keys.add(keyDraft.trim());
      setKeyDraft('');
      await ai.refresh();
      setModelsFor(result.provider);
      setModels(result.models);
      notify(`${result.label} connected. The latest model is selected.`, 'ok');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const showModels = async (provider: Provider) => {
    if (!bridge) return;
    setModelsFor(provider);
    setLoadingModels(true);
    setError(null);
    try {
      setModels(await bridge.keys.models(provider));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoadingModels(false);
    }
  };

  const choose = async (provider: Provider, model: string) => {
    if (!bridge) return;
    try {
      await bridge.keys.select(provider, model);
      await ai.refresh();
      notify(`Now using ${model}.`, 'ok');
    } catch (caught) {
      notify(errorText(caught), 'error');
    }
  };

  const remove = async (provider: Provider) => {
    if (!bridge) return;
    if (!window.confirm(`Remove your ${PROVIDER_LABEL[provider]} key from this device?`)) return;
    try {
      await bridge.keys.remove(provider);
      await ai.refresh();
      if (modelsFor === provider) {
        setModelsFor(null);
        setModels([]);
      }
      notify(`${PROVIDER_LABEL[provider]} key removed.`, 'ok');
    } catch (caught) {
      notify(errorText(caught), 'error');
    }
  };

  return (
    <div className="page">
      <h1 style={{ marginBottom: 6 }}>Settings</h1>
      <p className="muted">Your AI key, your model and your account.</p>

      <section className="stack" style={{ marginTop: 26, gap: 14 }}>
        <div>
          <p className="eyebrow">AI connections</p>
          <h2 style={{ marginTop: 4 }}>Bring your own key</h2>
          <p className="muted small" style={{ marginTop: 6, maxWidth: 640 }}>
            Paste a key from OpenAI, Anthropic, Google Gemini or OpenRouter. danna detects the provider, checks the key with
            the provider, and lists its latest models. Keys are encrypted with Windows on this device and sent only to the
            provider you choose.
          </p>
        </div>

        {!ai.desktop && (
          <Notice tone="info">
            <span>
              <Lock aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> AI keys are stored securely in
              the danna desktop app. Open danna for Windows to connect one.
            </span>
          </Notice>
        )}

        {ai.desktop && (
          <div className="card stack--tight" style={{ gap: 12 }}>
            <Field label="API key">
              <span className="input-wrap">
                <input
                  className="input"
                  type={showKey ? 'text' : 'password'}
                  value={keyDraft}
                  onChange={(event) => setKeyDraft(event.target.value)}
                  placeholder="sk-…, sk-ant-…, AIza… or sk-or-v1-…"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && detected && !busy) void connect();
                  }}
                />
                <button type="button" className="btn btn--icon" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? 'Hide key' : 'Show key'}>
                  {showKey ? <EyeOff /> : <Eye />}
                </button>
              </span>
            </Field>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {keyDraft.trim() && (
                <span className={`chip ${detected ? 'chip--blue' : ''}`}>
                  {detected ? `Detected: ${PROVIDER_LABEL[detected]}` : 'Unrecognised key format'}
                </span>
              )}
              <button className="btn btn--primary" onClick={connect} disabled={!detected || busy}>
                {busy ? <Spinner /> : <KeyRound />} Verify and connect
              </button>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
          </div>
        )}

        {ai.desktop && ai.connections.length === 0 && (
          <Empty title="No key connected yet">Paste a key above. Without one, writing and speaking are self-rated.</Empty>
        )}

        {ai.connections.length > 0 && (
          <div className="set-list">
            {ai.connections.map((connection) => {
              const active = ai.selection?.provider === connection.provider;
              return (
                <div key={connection.provider} className="connection">
                  <div className="connection__body">
                    <div className="row" style={{ gap: 8 }}>
                      <span style={{ fontWeight: 650 }}>{connection.label}</span>
                      {active && <span className="latest">In use</span>}
                    </div>
                    <div className="small muted" style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>
                      {connection.masked}
                    </div>
                  </div>
                  <button className="btn btn--ghost btn--sm" onClick={() => showModels(connection.provider)} disabled={loadingModels && modelsFor === connection.provider}>
                    {loadingModels && modelsFor === connection.provider ? <Spinner dark /> : null} Models
                  </button>
                  <button className="btn btn--icon" onClick={() => remove(connection.provider)} aria-label={`Remove ${connection.label} key`}>
                    <Trash2 />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {modelsFor && models.length > 0 && (
          <div className="stack--tight">
            <span className="field__label">Choose a model from {PROVIDER_LABEL[modelsFor]}</span>
            <div className="model-list" role="radiogroup" aria-label="Models">
              {models.map((model) => {
                const selected = ai.selection?.provider === modelsFor && ai.selection?.model === model.id;
                return (
                  <button
                    key={model.id}
                    role="radio"
                    aria-checked={selected}
                    className="model"
                    onClick={() => choose(modelsFor, model.id)}
                  >
                    <span className="model__radio" aria-hidden="true" />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 620 }}>{model.label}</span>
                      <span className="model__id">{model.id}</span>
                    </span>
                    {model.latest && <span className="latest">Latest</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="stack" style={{ marginTop: 34, gap: 12 }}>
        <p className="eyebrow">Account</p>
        <div className="connection">
          <div className="connection__body">
            <div style={{ fontWeight: 620 }}>{mode === 'local' ? 'Offline profile' : email ?? 'Signed in'}</div>
            <div className="small muted">
              {mode === 'local' ? 'Your progress is stored on this device only.' : 'Progress, friends and shared results sync to your account.'}
            </div>
          </div>
          <button
            className="btn btn--ghost btn--sm"
            onClick={async () => {
              await signOut();
              navigate('/auth', { replace: true });
            }}
          >
            {mode === 'local' ? 'Leave offline mode' : 'Sign out'}
          </button>
        </div>
      </section>

      <section className="stack" style={{ marginTop: 34, gap: 12 }}>
        <p className="eyebrow">About</p>
        <div className="connection">
          <Megaphone aria-hidden="true" style={{ width: 20, height: 20, color: 'var(--primary)' }} />
          <div className="connection__body">
            <div style={{ fontWeight: 620 }}>danna {version || ''}</div>
            <div className="small muted">Estimates are for practice and are not official ETS scores.</div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/whats-new')}>
            What&apos;s new
          </button>
        </div>
      </section>
    </div>
  );
}
