import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, Eye, EyeOff, KeyRound, Laptop, Trash2 } from 'lucide-react';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { ConfirmSheet, Empty, Notice, PageHeader, SectionTitle, Sheet, Spinner } from '../components/ui';
import { bridge, errorText, type AppSettings } from '../lib/bridge';
import { tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { copyProgress, hasLocalProgress } from '../lib/migrate';
import { backendFor, onlineAvailable } from '../lib/session';
import { useUpdateStatus } from '../lib/update';
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
  deepseek: 'DeepSeek',
};

/** The providers a key could belong to, shown while typing. The desktop app makes the real decision. */
function candidatesFor(key: string): Provider[] {
  if (key.startsWith('sk-ant-')) return ['anthropic'];
  if (key.startsWith('sk-or-')) return ['openrouter'];
  if (/^AIza[\w-]{30,}$/.test(key)) return ['gemini'];
  if (key.startsWith('sk-proj-') || key.startsWith('sk-svcacct-') || key.startsWith('sk-admin-')) return ['openai'];
  if (key.startsWith('sk-')) return ['openai', 'deepseek'];
  return [];
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { mode, email, signOut, moveToDevice } = useAuth();
  const ai = useAI();
  const { refresh, refreshSocial } = useAppData();
  const { notify } = useToast();
  const online = onlineAvailable();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [version, setVersion] = useState('');
  const update = useUpdateStatus();
  const [keyDraft, setKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelsFor, setModelsFor] = useState<Provider | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [keyToRemove, setKeyToRemove] = useState<Provider | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [deviceHasProgress, setDeviceHasProgress] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  // Offline progress that can still be added to the account.
  useEffect(() => {
    if (mode !== 'supabase') return undefined;
    let active = true;
    hasLocalProgress(backendFor('local'))
      .then((value) => {
        if (active) setDeviceHasProgress(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [mode]);

  const candidates = candidatesFor(keyDraft.trim());
  const detected = candidates.length > 0;
  const detectedLabel = candidates.length === 1 ? PROVIDER_LABEL[candidates[0]] : t('OpenAI or DeepSeek');

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
      notify(t('{label} is connected. The newest model is selected.', { label: result.label }), 'ok');
    } catch (caught) {
      setError(t(errorText(caught)));
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
      setError(t(errorText(caught)));
    } finally {
      setLoadingModels(false);
    }
  };

  const choose = async (provider: Provider, model: string) => {
    if (!bridge) return;
    try {
      await bridge.keys.select(provider, model);
      await ai.refresh();
      notify(t('Model updated.'), 'ok');
    } catch (caught) {
      notify(t(errorText(caught)), 'error');
    }
  };

  const removeKey = async (provider: Provider) => {
    if (!bridge) return;
    try {
      await bridge.keys.remove(provider);
      await ai.refresh();
      if (modelsFor === provider) {
        setModelsFor(null);
        setModels([]);
      }
      notify(t('{provider} key removed.', { provider: PROVIDER_LABEL[provider] }), 'ok');
    } catch (caught) {
      notify(t(errorText(caught)), 'error');
    } finally {
      setKeyToRemove(null);
    }
  };

  const toggleTray = async () => {
    if (!bridge || !settings) return;
    try {
      setSettings(await bridge.settings.set({ closeToTray: !settings.closeToTray }));
    } catch (caught) {
      notify(t(errorText(caught)), 'error');
    }
  };

  const bringProgress = async () => {
    setAdding(true);
    try {
      const report = await copyProgress(backendFor('local'), backendFor('supabase'));
      await refresh();
      await refreshSocial();
      setAddOpen(false);
      setDeviceHasProgress(false);
      notify(t('Your progress from this device is now in your account.'), 'ok');
      if (report.failed > 0) {
        notify(
          tn(
            '{count} item could not be copied. Try again later.',
            '{count} items could not be copied. Try again later.',
            report.failed,
            { count: report.failed },
          ),
          'error',
        );
      }
    } catch (caught) {
      notify(t(errorText(caught)), 'error');
    } finally {
      setAdding(false);
    }
  };

  const switchToDevice = async (keepCopy: boolean) => {
    setSwitching(true);
    try {
      await moveToDevice(keepCopy);
      setSwitchOpen(false);
      await refresh();
      notify(t('You are now using danna on this device.'), 'ok');
    } catch (caught) {
      notify(t(errorText(caught)), 'error');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="page">
      <PageHeader eyebrow={t('Preferences')} title={t('Settings')} />

      <SectionTitle title={t('App language')} />
      <div className="settings-row">
        <div className="settings-row__body">
          <div className="settings-row__text">{t('Menus, lessons and the coach use this language.')}</div>
        </div>
        <LanguageSwitch />
      </div>

      <SectionTitle title={t('How you use danna')} />
      <div className="mode-grid" role="radiogroup" aria-label={t('How you use danna')}>
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
          <span className="mode-card__title">{t('On this device')}</span>
          <span className="mode-card__text">{t('Everything stays on this device.')}</span>
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
          <span className="mode-card__title">{t('Online account')}</span>
          <span className="mode-card__text">{online ? t('Sync across your devices and connect with friends.') : t('Not available yet.')}</span>
          <span className="mode-card__tick">{mode === 'supabase' && <span aria-hidden="true">✓</span>}</span>
        </button>
      </div>

      <SectionTitle title={t('AI assistant')} />
      <div className="stack">
        <p className="small muted">
          {t(
            'Bring your own key from OpenAI, Anthropic, Google Gemini, OpenRouter or DeepSeek. It unlocks generated sets and coach feedback. The key stays on this device.',
          )}
        </p>

        {!ai.desktop && <Notice tone="info">{t('Keys can be added in the danna desktop app.')}</Notice>}

        {ai.desktop && (
          <div className="card stack">
            <div className="stack--tight">
              <label className="field__label" htmlFor="ai-key">
                {t('Your key')}
              </label>
              <div className="input-action">
                <span className="input-wrap">
                  <input
                    id="ai-key"
                    className="input"
                    type={showKey ? 'text' : 'password'}
                    value={keyDraft}
                    onChange={(event) => setKeyDraft(event.target.value)}
                    placeholder={t('Paste your key here')}
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
                    aria-label={showKey ? t('Hide key') : t('Show key')}
                  >
                    {showKey ? <EyeOff /> : <Eye />}
                  </button>
                </span>
                <button className="btn btn--primary" onClick={connect} disabled={!detected || busy}>
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
          </div>
        )}

        {ai.desktop && ai.connections.length === 0 && (
          <Empty title={t('No key connected yet')}>{t('Paste a key above to unlock the assistant.')}</Empty>
        )}

        {ai.connections.length > 0 && (
          <div className="set-list">
            {ai.connections.map((connection) => {
              const active = ai.selection?.provider === connection.provider;
              const loadingThis = loadingModels && modelsFor === connection.provider;
              return (
                <div key={connection.provider} className="connection">
                  <div className="connection__body">
                    <div className="row row--wrap">
                      <span className="connection__name">{connection.label}</span>
                      {active && <span className="latest">{t('In use')}</span>}
                    </div>
                    <div className="small muted">{t('Ends in {last}', { last: connection.masked.slice(-4) })}</div>
                  </div>
                  <button className="btn btn--ghost btn--sm" onClick={() => showModels(connection.provider)} disabled={loadingThis}>
                    {loadingThis ? <Spinner dark /> : null} {t('Models')}
                  </button>
                  <button
                    className="btn btn--icon"
                    onClick={() => setKeyToRemove(connection.provider)}
                    aria-label={t('Remove {label} key', { label: connection.label })}
                  >
                    <Trash2 />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {modelsFor && models.length > 0 && (
          <div className="stack--tight">
            <span className="field__label">{t('Choose a model')}</span>
            <div className="model-list" role="radiogroup" aria-label={t('Models')}>
              {models.map((model) => {
                const selected = ai.selection?.provider === modelsFor && ai.selection?.model === model.id;
                return (
                  <button key={model.id} role="radio" aria-checked={selected} className="model" onClick={() => choose(modelsFor, model.id)}>
                    <span className="model__radio" aria-hidden="true" />
                    <span className="model__label">{model.label}</span>
                    {model.latest && <span className="latest">{t('Newest')}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {bridge && settings && (
        <>
          <SectionTitle title={t('Window')} />
          <div className="settings-row">
            <div className="settings-row__body">
              <div className="settings-row__title">{t('Keep danna in the tray')}</div>
              <div className="settings-row__text">{t('Closing the window keeps practice running. Open it again from the tray icon.')}</div>
            </div>
            <button
              role="switch"
              aria-checked={settings.closeToTray}
              aria-label={t('Keep danna in the tray when the window closes')}
              className="switch"
              onClick={toggleTray}
            >
              <span className="switch__thumb" />
            </button>
          </div>
        </>
      )}

      {mode === 'supabase' && (
        <>
          <SectionTitle title={t('Account')} />
          {deviceHasProgress && (
            <div className="settings-row">
              <div className="settings-row__body">
                <div className="settings-row__title">{t('Progress saved on this device')}</div>
                <div className="settings-row__text">
                  {t('Lessons, scores, sets, your picture and library can be added to your account.')}
                </div>
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => setAddOpen(true)}>
                {t('Add to my account')}
              </button>
            </div>
          )}
          <div className="settings-row">
            <div className="settings-row__body">
              <div className="settings-row__title">{email ?? t('Signed in')}</div>
              <div className="settings-row__text">{t('Your progress is saved to your account.')}</div>
            </div>
            <button
              className="btn btn--ghost btn--sm"
              onClick={async () => {
                await signOut();
                navigate('/auth', { replace: true });
              }}
            >
              {t('Sign out')}
            </button>
          </div>
        </>
      )}

      <SectionTitle title={t('About')} />
      <div className="settings-row">
        <div className="settings-row__body">
          <div className="settings-row__title">danna {version}</div>
          <div className="settings-row__text">{t('Scores are practice estimates, not official results.')}</div>
          {update.state === 'downloading' && update.version && (
            <div className="settings-row__text">{t('Downloading danna {version} in the background.', { version: update.version })}</div>
          )}
          {update.state === 'ready' && update.version && (
            <div className="settings-row__text">{t('danna {version} is ready. It installs when you close danna.', { version: update.version })}</div>
          )}
        </div>
        {update.state === 'ready' && (
          <button className="btn btn--primary btn--sm" onClick={() => void bridge?.update.install()}>
            {t('Restart to update')}
          </button>
        )}
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/whats-new')}>
          {t("What's new")}
        </button>
      </div>

      {keyToRemove && (
        <ConfirmSheet
          title={t('Remove this key?')}
          confirmLabel={t('Remove key')}
          onConfirm={() => void removeKey(keyToRemove)}
          onClose={() => setKeyToRemove(null)}
        >
          {t('Your {provider} key is removed from this device. You can add it again at any time.', { provider: PROVIDER_LABEL[keyToRemove] })}
        </ConfirmSheet>
      )}

      {addOpen && (
        <Sheet
          title={t("Add this device's progress?")}
          onClose={() => setAddOpen(false)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => setAddOpen(false)} disabled={adding}>
                {t('Cancel')}
              </button>
              <button className="btn btn--primary" onClick={bringProgress} disabled={adding}>
                {adding ? <Spinner /> : null} {t('Add to my account')}
              </button>
            </>
          }
        >
          <p className="muted">
            {t(
              'Lessons, scores, practice sets, coach messages, library files and your picture are copied. What is already in your account stays as it is.',
            )}
          </p>
        </Sheet>
      )}

      {switchOpen && (
        <Sheet
          title={t('Use danna on this device?')}
          onClose={() => setSwitchOpen(false)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => switchToDevice(false)} disabled={switching}>
                {t('Switch without copying')}
              </button>
              <button className="btn btn--primary" onClick={() => switchToDevice(true)} disabled={switching}>
                {switching ? <Spinner /> : null} {t('Copy my progress here')}
              </button>
            </>
          }
        >
          <p className="muted">{t('Your progress stays saved in your account. You can keep a copy on this device as well.')}</p>
        </Sheet>
      )}
    </div>
  );
}
