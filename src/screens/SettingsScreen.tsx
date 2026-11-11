import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, Eye, EyeOff, KeyRound, Laptop, Trash2 } from 'lucide-react';
import { Empty, Field, Notice, Sheet, Spinner } from '../components/ui';
import { bridge, errorText, type AppSettings } from '../lib/bridge';
import { onlineAvailable } from '../lib/session';
import { useAI } from '../state/ai';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useToast } from '../state/toast';
import type { AIModel, Provider } from '../lib/types';

const PROVIDER_LABEL: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
};

/** Shows the provider name while typing. The desktop app makes the real decision. */
function detectClient(key: string): Provider | null {
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-or-')) return 'openrouter';
  if (/^AIza[\w-]{30,}$/.test(key)) return 'gemini';
  if (key.startsWith('sk-')) return 'openai';
  return null;
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const { mode, email, signOut, moveToDevice } = useAuth();
  const ai = useAI();
  const { refresh } = useAppData();
  const { notify } = useToast();
  const online = onlineAvailable();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [version, setVersion] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelsFor, setModelsFor] = useState<Provider | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const detected = detectClient(keyDraft.trim());

  useEffect(() => {
    bridge
      ?.info()
      .then((info) => setVersion(info.version))
      .catch(() => undefined);
    bridge
      ?.settings.get()
      .then(setSettings)
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
      notify(`${result.label} is connected. The newest model is selected.`, 'ok');
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
      notify('Model updated.', 'ok');
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

  const toggleTray = async () => {
    if (!bridge || !settings) return;
    try {
      setSettings(await bridge.settings.set({ closeToTray: !settings.closeToTray }));
    } catch (caught) {
      notify(errorText(caught), 'error');
    }
  };

  const switchToDevice = async (keepCopy: boolean) => {
    setSwitching(true);
    try {
      await moveToDevice(keepCopy);
      setSwitchOpen(false);
      await refresh();
      notify('You are now using danna on this device.', 'ok');
    } catch (caught) {
      notify(errorText(caught), 'error');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="page">
      <h1 style={{ marginBottom: 22 }}>Settings</h1>

      <section className="stack" style={{ gap: 14 }}>
        <div className="section-head">
          <p className="eyebrow">How you use danna</p>
        </div>
        <div className="mode-grid" role="radiogroup" aria-label="How you use danna">
          <button
            role="radio"
            aria-checked={mode === 'local'}
            className="mode-card"
            onClick={() => {
              if (mode === 'supabase') setSwitchOpen(true);
            }}
          >
            <span className="mode-card__icon">
              <Laptop aria-hidden="true" />
            </span>
            <span className="mode-card__title">On this device</span>
            <span className="mode-card__text">Everything stays on this device.</span>
            <span className="mode-card__tick">{mode === 'local' && <span aria-hidden="true">✓</span>}</span>
          </button>
          <button
            role="radio"
            aria-checked={mode === 'supabase'}
            className="mode-card"
            disabled={!online}
            onClick={() => {
              if (mode === 'local') navigate('/auth', { state: { next: '/settings', switchingFrom: 'local' } });
            }}
          >
            <span className="mode-card__icon">
              <Cloud aria-hidden="true" />
            </span>
            <span className="mode-card__title">Online account</span>
            <span className="mode-card__text">
              {online ? 'Sync across your devices and connect with friends.' : 'Not available yet.'}
            </span>
            <span className="mode-card__tick">{mode === 'supabase' && <span aria-hidden="true">✓</span>}</span>
          </button>
        </div>
      </section>

      <section className="stack" style={{ marginTop: 34, gap: 14 }}>
        <div className="section-head">
          <p className="eyebrow">AI assistant</p>
          <h2>Bring your own key</h2>
          <p className="muted small" style={{ maxWidth: 640 }}>
            Add a key from OpenAI, Anthropic, Google Gemini or OpenRouter. It unlocks generated sets and coach feedback.
            The key stays on this device.
          </p>
        </div>

        {!ai.desktop && <Notice tone="info">Keys can be added in the danna desktop app.</Notice>}

        {ai.desktop && (
          <div className="card stack--tight" style={{ gap: 12 }}>
            <Field label="Your key">
              <span className="input-wrap">
                <input
                  className="input"
                  type={showKey ? 'text' : 'password'}
                  value={keyDraft}
                  onChange={(event) => setKeyDraft(event.target.value)}
                  placeholder="Paste your key here"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && detected && !busy) void connect();
                  }}
                />
                <button
                  type="button"
                  className="btn btn--icon"
                  onClick={() => setShowKey((value) => !value)}
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff /> : <Eye />}
                </button>
              </span>
            </Field>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {keyDraft.trim() && (
                <span className={`chip ${detected ? 'chip--blue' : ''}`}>
                  {detected ? `Looks like ${PROVIDER_LABEL[detected]}` : 'We do not recognise this key yet'}
                </span>
              )}
              <button className="btn btn--primary" onClick={connect} disabled={!detected || busy}>
                {busy ? <Spinner /> : <KeyRound />} Connect
              </button>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
          </div>
        )}

        {ai.desktop && ai.connections.length === 0 && (
          <Empty title="No key connected yet">Paste a key above to unlock the assistant.</Empty>
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
                    <div className="small muted">Ends in {connection.masked.slice(-4)}</div>
                  </div>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => showModels(connection.provider)}
                    disabled={loadingModels && modelsFor === connection.provider}
                  >
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
            <span className="field__label">Choose a model</span>
            <div className="model-list" role="radiogroup" aria-label="Models">
              {models.map((model) => {
                const selected = ai.selection?.provider === modelsFor && ai.selection?.model === model.id;
                return (
                  <button key={model.id} role="radio" aria-checked={selected} className="model" onClick={() => choose(modelsFor, model.id)}>
                    <span className="model__radio" aria-hidden="true" />
                    <span style={{ minWidth: 0, flex: 1, fontWeight: 620 }}>{model.label}</span>
                    {model.latest && <span className="latest">Newest</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {bridge && settings && (
        <section className="stack" style={{ marginTop: 34, gap: 14 }}>
          <div className="section-head">
            <p className="eyebrow">Window</p>
          </div>
          <div className="settings-row">
            <div className="settings-row__body">
              <div className="settings-row__title">Keep danna in the tray</div>
              <div className="settings-row__text">Closing the window keeps practice running. Open it again from the tray icon.</div>
            </div>
            <button
              role="switch"
              aria-checked={settings.closeToTray}
              aria-label="Keep danna in the tray when the window closes"
              className="switch"
              onClick={toggleTray}
            >
              <span className="switch__thumb" />
            </button>
          </div>
        </section>
      )}

      {mode === 'supabase' && (
        <section className="stack" style={{ marginTop: 34, gap: 14 }}>
          <div className="section-head">
            <p className="eyebrow">Account</p>
          </div>
          <div className="settings-row">
            <div className="settings-row__body">
              <div className="settings-row__title">{email ?? 'Signed in'}</div>
              <div className="settings-row__text">Your progress is saved to your account.</div>
            </div>
            <button
              className="btn btn--ghost btn--sm"
              onClick={async () => {
                await signOut();
                navigate('/auth', { replace: true });
              }}
            >
              Sign out
            </button>
          </div>
        </section>
      )}

      <section className="stack" style={{ marginTop: 34, gap: 14 }}>
        <div className="section-head">
          <p className="eyebrow">About</p>
        </div>
        <div className="settings-row">
          <div className="settings-row__body">
            <div className="settings-row__title">danna {version}</div>
            <div className="settings-row__text">Scores are practice estimates, not official results.</div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/whats-new')}>
            What&apos;s new
          </button>
        </div>
      </section>

      {switchOpen && (
        <Sheet
          title="Use danna on this device?"
          onClose={() => setSwitchOpen(false)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => switchToDevice(false)} disabled={switching}>
                Switch without copying
              </button>
              <button className="btn btn--primary" onClick={() => switchToDevice(true)} disabled={switching}>
                {switching ? <Spinner /> : null} Copy my progress here
              </button>
            </>
          }
        >
          <p className="muted">Your progress stays saved in your account. You can keep a copy on this device as well.</p>
        </Sheet>
      )}
    </div>
  );
}
