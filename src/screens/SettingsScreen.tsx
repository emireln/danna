import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Cloud, Coffee, Eye, EyeOff, KeyRound, Laptop, Play, Star, Trash2, Volume2 } from 'lucide-react';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { LookPicker } from '../components/LookPicker';
import { VoicePicker } from '../components/VoicePicker';
import { ConfirmSheet, Empty, Notice, PageHeader, SectionTitle, Sheet, Spinner } from '../components/ui';
import { bridge, errorText, type AppSettings } from '../lib/bridge';
import { checkFeedback, FeedbackLimitError } from '../lib/feedback';
import { lookOf } from '../lib/look';
import {
  readReminderPrefs,
  readSoundPrefs,
  writeReminderPrefs,
  writeSoundPrefs,
  type ReminderId,
  type ReminderPrefs,
  type SoundId,
  type SoundPrefs,
} from '../lib/preferences';
import { previewSound } from '../lib/sound';
import { openSupport } from '../lib/support';
import { tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { copyProgress, hasLocalProgress } from '../lib/migrate';
import { narrate, type Narration } from '../lib/speech';
import { backendFor, onlineAvailable } from '../lib/session';
import { useUpdateStatus } from '../lib/update';
import { useAI } from '../state/ai';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useToast } from '../state/toast';
import type { AIModel, LookId, Provider } from '../lib/types';

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
  if (/^(AIza[\w-]{30,}|AQ\.[\w-]{30,})$/.test(key)) return ['gemini'];
  if (key.startsWith('sk-proj-') || key.startsWith('sk-svcacct-') || key.startsWith('sk-admin-')) return ['openai'];
  if (key.startsWith('sk-')) return ['openai', 'deepseek'];
  return [];
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { mode, email, signOut, moveToDevice, backend, vaultError } = useAuth();
  const ai = useAI();
  const { refresh, refreshSocial, profile, patchProfile } = useAppData();
  const look = lookOf(profile);
  const [savingLook, setSavingLook] = useState(false);
  // The device's own choices for sounds and reminders. Each change is saved on this device as it is made.
  const [sounds, setSounds] = useState<SoundPrefs>(() => readSoundPrefs());
  const [reminders, setReminders] = useState<ReminderPrefs>(() => readReminderPrefs());
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const changeSounds = (next: SoundPrefs) => {
    writeSoundPrefs(next);
    setSounds(next);
  };
  const changeReminders = (next: ReminderPrefs) => {
    writeReminderPrefs(next);
    setReminders(next);
  };
  // Turning reminders on asks the system for permission, once. The answer decides whether a reminder can arrive.
  const toggleReminders = async () => {
    const turningOn = !reminders.enabled;
    if (turningOn && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        setPermission(await Notification.requestPermission());
      } catch {
        // The choice is still kept. The notice below says what to do when notifications are blocked.
      }
    }
    changeReminders({ ...reminders, enabled: turningOn });
  };
  const sendTestReminder = () => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      notify(t('Notifications are blocked for danna. Allow them in your system settings, then turn them on here.'), 'error');
      return;
    }
    void new Notification(t('Reminders are on'), {
      body: t('This is how a reminder looks. You can change them any time in Settings.'),
      tag: 'danna-test',
      silent: true,
    });
    previewSound('reminder');
  };
  const reminderRows: Array<{ id: ReminderId; title: string; text: string }> = [
    { id: 'streak', title: t('Keep my streak'), text: t('A short lesson keeps the flame going.') },
    { id: 'goal', title: t('Daily goal'), text: t('The minutes left to reach today’s goal.') },
    { id: 'review', title: t('Review reminders'), text: t('Cards that are due, so they stick.') },
    { id: 'exam', title: t('Your exam'), text: t('The days before your exam date.') },
    { id: 'comeback', title: t('Come back'), text: t('When you have not practised for a few days.') },
  ];
  const soundRows: Array<{ id: SoundId; title: string; text: string }> = [
    { id: 'correct', title: t('Correct answer'), text: t('A bright two-note chime.') },
    { id: 'wrong', title: t('Wrong answer'), text: t('A soft, low note. Not a buzzer.') },
    { id: 'complete', title: t('Lesson finished'), text: t('A rising melody when a lesson or test is finished.') },
    { id: 'coach', title: t('Coach reply'), text: t('A gentle glide when the coach answers.') },
    { id: 'reminder', title: t('Reminder'), text: t('A soft bell when a reminder arrives.') },
  ];
  // The look is saved to the profile: to the account in the cloud, or to this device without one.
  const chooseLook = async (next: LookId) => {
    if (next === look) return;
    setSavingLook(true);
    try {
      await patchProfile({ ui_style: next });
      notify(t('Your look is saved.'), 'ok');
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setSavingLook(false);
    }
  };
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
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  // Seconds until the account may send its next feedback message (0 when it may send now).
  const [feedbackWait, setFeedbackWait] = useState(0);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Asks the account how long it must wait before its next message, so the notice shows before anyone presses Send.
  useEffect(() => {
    if (!backend || backend.mode !== 'supabase') return undefined;
    let active = true;
    backend
      .feedbackWaitSeconds()
      .then((seconds) => {
        if (active) setFeedbackWait(seconds);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [backend]);

  const waitMinutes = Math.max(1, Math.ceil(feedbackWait / 60));
  const waitText = tn('{count} minute', '{count} minutes', waitMinutes, { count: waitMinutes });

  // The message is saved on the account's row in the database. The app cannot read it back.
  const sendFeedbackNow = async () => {
    if (!backend || sendingFeedback) return;
    setSendingFeedback(true);
    setFeedbackError(null);
    try {
      const draft = checkFeedback({ rating, comment });
      await backend.sendFeedback({ ...draft, app_version: version });
      setRating(0);
      setHoverRating(0);
      setComment('');
      setFeedbackWait(60 * 60);
      notify(t('Thank you. Your feedback was sent.'), 'ok');
    } catch (caught) {
      if (caught instanceof FeedbackLimitError) setFeedbackWait(caught.seconds);
      else setFeedbackError(errorText(caught));
    } finally {
      setSendingFeedback(false);
    }
  };
  const [deviceHasProgress, setDeviceHasProgress] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sampling, setSampling] = useState(false);
  const sample = useRef<Narration | null>(null);

  // Saves the voice for listening. The next passage is read with it.
  async function saveVoice(value: string) {
    if (!bridge) return;
    try {
      setSettings(await bridge.settings.set({ voice: value }));
    } catch (error) {
      notify(t(errorText(error)), 'error');
    }
  }

  // The loudness shows at once while the learner drags, and is saved after. The next passage is read with it.
  function saveVolume(value: number) {
    if (!bridge) return;
    setSettings((current) => (current ? { ...current, voiceVolume: value } : current));
    bridge.settings
      .set({ voiceVolume: value })
      .then(setSettings)
      .catch((error) => notify(t(errorText(error)), 'error'));
  }

  // The sample is read with the voice on this screen, so the learner can hear it before a passage uses it.
  function playSample() {
    if (sample.current) {
      sample.current.stop();
      return;
    }
    sample.current = narrate('Hello! Listen closely to how this voice sounds. Then try to repeat each sentence after it.', {
      onStart: () => setSampling(true),
      onEnd: () => {
        sample.current = null;
        setSampling(false);
      },
      onNotice: (message) => notify(message),
    });
  }

  // Looks for a newer version now, and says what was found.
  async function checkUpdates() {
    if (!bridge) return;
    setChecking(true);
    try {
      const result = await bridge.update.check();
      if (result.state === 'unavailable') notify(t('Updates are checked in the installed danna app.'));
      else if (result.state === 'failed') notify(t('Could not check for updates. Try again later.'), 'error');
      else if (result.state === 'idle') notify(t('danna is up to date.'), 'ok');
      else if (result.state === 'available') notify(t('danna {version} is available. Download it when you like.', { version: result.version ?? '' }), 'ok');
      else if (result.state === 'ready') notify(t('danna {version} is ready. It installs when you close danna.', { version: result.version ?? '' }), 'ok');
      else notify(t('Downloading danna {version} in the background.', { version: result.version ?? '' }), 'ok');
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setChecking(false);
    }
  }

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
      // With an account open, the new key is saved to it as well, so the other devices get it.
      const locked = ai.keysLocked;
      const problem = await ai.syncNow();
      setModelsFor(result.provider);
      setModels(result.models);
      notify(t('{label} is connected. The newest model is selected.', { label: result.label }), 'ok');
      if (problem) notify(t('Your AI keys could not be saved to your account: {reason}', { reason: t(problem) }), 'error');
      else if (locked) notify(t('Your key is saved on this device. Enter your account password below to save it to your account too.'));
    } catch (caught) {
      setError(t(errorText(caught)));
    } finally {
      setBusy(false);
    }
  };

  // Enters the account password here, which opens the vault, so the AI keys can be saved to the account.
  const unlockNow = async () => {
    if (!unlockPassword || unlocking) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      await ai.unlock(unlockPassword);
      setUnlockPassword('');
      notify(t('Done. This device can now save and read your AI keys in your account.'), 'ok');
    } catch (caught) {
      setUnlockError(errorText(caught));
    } finally {
      setUnlocking(false);
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
      await ai.removeKey(provider);
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

      <SectionTitle title={t('Look')} />
      <p className="muted">{t('Your look is saved to your account. Without an account it is kept on this device.')}</p>
      <LookPicker value={look} disabled={savingLook} onChange={(next) => void chooseLook(next)} />

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

      <SectionTitle title={t('Notifications')} />
      <div className="stack">
        <div className="settings-row">
          <div className="settings-row__body">
            <div className="settings-row__title">{t('Reminders from danna')}</div>
            <div className="settings-row__text">
              {t('A short message when danna is in the background and a reminder helps: a streak to keep, a goal to reach, cards to review.')}
            </div>
          </div>
          <button
            role="switch"
            aria-checked={reminders.enabled}
            aria-label={t('Reminders from danna')}
            className="switch"
            disabled={permission === 'unsupported'}
            onClick={() => void toggleReminders()}
          >
            <span className="switch__thumb" />
          </button>
        </div>

        {reminders.enabled && permission !== 'granted' && permission !== 'unsupported' && (
          <Notice tone="info">
            {t('Notifications are blocked for danna. Allow them in your system settings, then turn them on here.')}
          </Notice>
        )}

        {reminders.enabled && (
          <>
            <div className="settings-row">
              <div className="settings-row__body">
                <div className="settings-row__title">{t('Remind me from')}</div>
                <div className="settings-row__text">{t('Reminders start at this time, and none arrives after 10 pm.')}</div>
              </div>
              <input
                className="input"
                type="time"
                value={reminders.time}
                aria-label={t('Remind me from')}
                style={{ width: 130 }}
                onChange={(event) => {
                  if (event.target.value) changeReminders({ ...reminders, time: event.target.value });
                }}
              />
            </div>

            {reminderRows.map((row) => (
              <div className="settings-row" key={row.id}>
                <div className="settings-row__body">
                  <div className="settings-row__title">{row.title}</div>
                  <div className="settings-row__text">{row.text}</div>
                </div>
                <button
                  role="switch"
                  aria-checked={reminders.types[row.id]}
                  aria-label={row.title}
                  className="switch"
                  onClick={() => changeReminders({ ...reminders, types: { ...reminders.types, [row.id]: !reminders.types[row.id] } })}
                >
                  <span className="switch__thumb" />
                </button>
              </div>
            ))}

            <div>
              <button className="btn btn--ghost btn--sm" onClick={sendTestReminder}>
                <Bell aria-hidden="true" /> {t('Send a test')}
              </button>
            </div>
          </>
        )}
      </div>

      <SectionTitle title={t('Sounds')} />
      <div className="stack">
        <div className="settings-row">
          <div className="settings-row__body">
            <div className="settings-row__title">{t('Sounds in danna')}</div>
            <div className="settings-row__text">{t('Short, friendly sounds for your answers, the coach and finished lessons.')}</div>
          </div>
          <button
            role="switch"
            aria-checked={sounds.enabled}
            aria-label={t('Sounds in danna')}
            className="switch"
            onClick={() => changeSounds({ ...sounds, enabled: !sounds.enabled })}
          >
            <span className="switch__thumb" />
          </button>
        </div>

        <div className="settings-row">
          <div className="settings-row__body">
            <div className="settings-row__title">{t('Volume')}</div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={sounds.volume}
            aria-label={t('Volume')}
            style={{ width: 180, accentColor: 'var(--primary)' }}
            onChange={(event) => changeSounds({ ...sounds, volume: Number(event.target.value) })}
          />
        </div>

        {soundRows.map((row) => (
          <div className="settings-row" key={row.id}>
            <div className="settings-row__body">
              <div className="settings-row__title">{row.title}</div>
              <div className="settings-row__text">{row.text}</div>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => previewSound(row.id)} aria-label={t('Play {sound}', { sound: row.title })}>
              <Play aria-hidden="true" /> {t('Listen')}
            </button>
            <button
              role="switch"
              aria-checked={sounds.items[row.id]}
              aria-label={row.title}
              className="switch"
              disabled={!sounds.enabled}
              onClick={() => changeSounds({ ...sounds, items: { ...sounds.items, [row.id]: !sounds.items[row.id] } })}
            >
              <span className="switch__thumb" />
            </button>
          </div>
        ))}
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
                    <div className="small muted">
                      {t('Ends in {last}', { last: connection.masked.slice(-4) })}
                      {connection.source === 'account' && ` · ${t('Saved in your account')}`}
                    </div>
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

        {ai.accountKeys && ai.connections.length > 0 && (
          <p className="small muted">
            {t('Your keys are sealed with your account password before they are saved, so only you can open them.')}
          </p>
        )}
        {ai.unreadable.length > 0 && (
          <Notice tone="warn">
            {t('Some keys saved in your account could not be opened with this password. Add them again to replace them.')}
          </Notice>
        )}
        {ai.keysLocked && (
          <div className="account-box">
            <p className="settings-row__text">
              {t('Your AI keys can be saved to your account, sealed with your password. Enter it once on this device.')}
            </p>
            {vaultError && <Notice tone="error">{t('Your AI keys could not be saved to your account: {reason}', { reason: vaultError })}</Notice>}
            <div className="row row--wrap">
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={unlockPassword}
                onChange={(event) => setUnlockPassword(event.target.value)}
                placeholder={t('Account password')}
                aria-label={t('Account password')}
                style={{ flex: 1, minWidth: 220 }}
              />
              <button className="btn btn--primary" onClick={() => void unlockNow()} disabled={!unlockPassword || unlocking}>
                {unlocking ? <Spinner /> : null} {t('Save my keys to my account')}
              </button>
            </div>
            {unlockError && <Notice tone="error">{t(unlockError)}</Notice>}
          </div>
        )}
        {ai.syncError && (
          <div className="stack--tight">
            <Notice tone="error">{t('Your AI keys could not be saved to your account: {reason}', { reason: t(ai.syncError) })}</Notice>
            <button className="btn btn--ghost btn--sm self-start" onClick={() => void ai.syncNow()}>
              {t('Try again')}
            </button>
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
          <SectionTitle title={t('Listening voice')} />
          <div className="stack">
            <VoicePicker value={settings.voice} onChoose={(choice) => void saveVoice(choice)} />
            <label className="volume">
              <span className="volume__label">{t('Volume')}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={settings.voiceVolume}
                onChange={(event) => saveVolume(Number(event.target.value))}
                aria-valuetext={`${settings.voiceVolume}%`}
              />
              <output className="volume__value">{settings.voiceVolume}%</output>
            </label>
            <div>
              <button className="btn btn--ghost btn--sm" onClick={playSample}>
                {sampling ? <Volume2 aria-hidden="true" /> : <Play aria-hidden="true" />} {sampling ? t('Stop the sample') : t('Play a sample')}
              </button>
            </div>
          </div>
        </>
      )}

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
      <div className="stack">
        <div className="settings-row">
          <div className="settings-row__body">
            <div className="settings-row__title">danna {version}</div>
            <div className="settings-row__text">{t('Scores are practice estimates, not official results.')}</div>
            {update.state === 'downloading' && update.version && (
              <div className="settings-row__text">{t('Downloading danna {version} in the background.', { version: update.version })}</div>
            )}
            {update.state === 'available' && update.version && (
              <div className="settings-row__text">{t('danna {version} is available. Download it when you like.', { version: update.version })}</div>
            )}
            {update.state === 'ready' && update.version && (
              <div className="settings-row__text">{t('danna {version} is ready. It installs when you close danna.', { version: update.version })}</div>
            )}
          </div>
          {update.state === 'available' && (
            <button className="btn btn--primary btn--sm" onClick={() => void bridge?.update.download()}>
              {t('Download update')}
            </button>
          )}
          {update.state === 'ready' && (
            <button className="btn btn--primary btn--sm" onClick={() => void bridge?.update.install()}>
              {t('Restart to update')}
            </button>
          )}
          {bridge && (
            <button className="btn btn--ghost btn--sm" onClick={() => void checkUpdates()} disabled={checking}>
              {checking ? <Spinner dark /> : null} {t('Check for updates')}
            </button>
          )}
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/whats-new')}>
            {t("What's new")}
          </button>
        </div>

        <div className="settings-row">
          <div className="settings-row__body">
            <div className="settings-row__title">{t('Guided tour')}</div>
            <div className="settings-row__text">{t('Show the main buttons of danna again.')}</div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/', { state: { tour: true } })}>
            {t('Take the tour')}
          </button>
        </div>
      </div>

      <SectionTitle title={t('Support')} />
      <div className="settings-row">
        <div className="settings-row__body">
          <div className="settings-row__title">{t('Buy me a coffee')}</div>
          <div className="settings-row__text">
            {t('If danna helps you learn, you can support its work with a coffee. It opens in your browser.')}
          </div>
        </div>
        <button className="btn btn--coffee btn--sm" onClick={openSupport}>
          <Coffee /> {t('Buy me a coffee')}
        </button>
      </div>

      <SectionTitle title={t('Feedback')} />
      {mode === 'supabase' ? (
        <div className="feedback-box">
          <p className="settings-row__text">
            {t('Rate danna from 1 to 5 stars and leave a comment if you like. It goes to the developer.')}
          </p>
          <div className="rate-stars" role="group" aria-label={t('Rating')}>
            {[1, 2, 3, 4, 5].map((value) => {
              const on = value <= (hoverRating || rating);
              return (
                <button
                  key={value}
                  type="button"
                  className={`rate-star ${on ? 'is-on' : ''}`}
                  aria-label={tn('{count} star', '{count} stars', value, { count: value })}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                >
                  <Star fill={on ? 'currentColor' : 'none'} aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <textarea
            className="input rate-comment"
            maxLength={1000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t('What would make danna better? (optional)')}
            aria-label={t('Your comment')}
          />
          {feedbackError && <Notice tone="error">{t(feedbackError)}</Notice>}
          {feedbackWait > 0 && (
            <Notice tone="info">{t('You can send one feedback an hour. You can send another in {time}.', { time: waitText })}</Notice>
          )}
          <div className="row row--between">
            <span className="small muted">{rating ? '' : t('Choose a rating to send.')}</span>
            <button
              className="btn btn--primary"
              onClick={() => void sendFeedbackNow()}
              disabled={!rating || sendingFeedback || !backend || feedbackWait > 0}
            >
              {sendingFeedback ? <Spinner /> : null} {t('Send feedback')}
            </button>
          </div>
        </div>
      ) : (
        <div className="settings-row">
          <div className="settings-row__body">
            <div className="settings-row__text">
              {t('Feedback is sent with an online account. On this device, nothing leaves your computer.')}
            </div>
          </div>
        </div>
      )}

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
