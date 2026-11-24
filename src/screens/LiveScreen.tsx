// Talk live with the coach: a real-time voice conversation with a character that answers as it speaks. With a Gemini key
// the voice is Gemini Live's own. With any other key, the coach writes with that key and the app's voice, chosen in
// Settings, reads. The transcript can be kept in the coach's chats when the talk ends.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, Mic, MicOff, PhoneOff, Save, Square } from 'lucide-react';
import { type AvatarHead } from '../avatar/avatarHead';
import { CoachStage } from '../avatar/CoachStage';
import { COACHES, coachOf, type CoachId } from '../avatar/characters';
import { Select } from '../components/Pickers';
import { useVoiceInput, VoiceButton } from '../components/VoiceInput';
import { BackLink, Field, Notice, PageHeader } from '../components/ui';
import { bridge, errorText } from '../lib/bridge';
import { titleFromQuestion } from '../lib/coach';
import { learnerContext } from '../lib/coachContext';
import { activeExamDate } from '../lib/exam';
import { useLanguage, useT } from '../lib/i18n/react';
import { createLiveConversation, type LiveEngine } from '../lib/live/conversation';
import { liveInstructions } from '../lib/live/prompt';
import { localDate } from '../lib/progress';
import type { ReviewRow } from '../lib/types';
import { DEFAULT_VOICE } from '../lib/voices';
import { useAI } from '../state/ai';
import { useAppData } from '../state/appData';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';

const CONSENT_KEY = 'danna.live.consent';
const CHARACTER_KEY = 'danna.live.character';
const GEMINI_VOICES = ['Puck', 'Kore', 'Aoede', 'Charon', 'Fenrir', 'Leda', 'Orus', 'Zephyr'];

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The choice is simply not remembered on this device.
  }
}

export function LiveScreen() {
  const t = useT();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { backend } = useAuth();
  const { profile, skills } = useAppData();
  const ai = useAI();
  const { notify } = useToast();
  const [coachId, setCoachId] = useState<CoachId>(() => coachOf(readStored(CHARACTER_KEY)).id);
  const coach = coachOf(coachId);
  const [voice, setVoice] = useState(() => coachOf(coachId).voice);
  const [turnMode, setTurnMode] = useState<'auto' | 'manual'>('auto');
  const [consented, setConsented] = useState(() => readStored(CONSENT_KEY) === '1');
  const [askingConsent, setAskingConsent] = useState(false);
  const [appVoice, setAppVoice] = useState(DEFAULT_VOICE);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [draft, setDraft] = useState('');
  const [holding, setHolding] = useState(false);
  const [saving, setSaving] = useState(false);
  // The coach as it is drawn now, or null while it loads. A talk needs it, and so do the gestures.
  const [avatar, setAvatar] = useState<AvatarHead | null>(null);
  const onAvatar = useCallback((next: AvatarHead | null) => setAvatar(next), []);

  // The conversation lives as long as the screen does. Its replies always use the AI key as it is now.
  const replySource = useRef(ai.startReply);
  replySource.current = ai.startReply;
  const conversation = useMemo(
    () =>
      createLiveConversation({
        bridge,
        startReply: (request, onDelta) => replySource.current(request, onDelta),
      }),
    [],
  );
  const live = useSyncExternalStore(conversation.subscribe, conversation.snapshot, conversation.snapshot);

  useEffect(() => () => conversation.stop(), [conversation]);

  // A talk ends when danna is hidden, so the microphone never listens out of sight.
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden') conversation.stop();
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [conversation]);

  useEffect(() => {
    let cancelled = false;
    if (bridge) {
      void bridge.settings
        .get()
        .then((settings) => {
          if (!cancelled) setAppVoice(settings.voice || DEFAULT_VOICE);
        })
        .catch(() => undefined);
    }
    if (backend) {
      void backend
        .listReviewItems()
        .then((rows) => {
          if (!cancelled) setReviews([...rows].sort((a, b) => b.due_at.localeCompare(a.due_at)));
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [backend]);

  const engine: LiveEngine | null = !bridge || !ai.loaded ? null : ai.connections.some((item) => item.provider === 'gemini') ? 'gemini' : ai.ready ? 'typed' : null;
  const active = live.status !== 'idle' && !live.ended;
  const details: Record<CoachId, string> = {
    ana: t('A young woman in a casual outfit'),
  };

  const facts = useMemo(
    () =>
      profile
        ? learnerContext({
            profile: {
              level: profile.level,
              goal: profile.goal,
              target_score: profile.target_score,
              exam_date: activeExamDate(profile),
              exam_name: profile.exam_name,
            },
            skills,
            mistakes: reviews,
            today: localDate(),
          })
        : '',
    [profile, skills, reviews],
  );

  const voiceInput = useVoiceInput(
    (audio) => ai.transcribe(audio),
    (text) => {
      void conversation.sendText(text);
    },
    (error) => notify(t(errorText(error)), 'error'),
  );

  const choose = (id: CoachId) => {
    setCoachId(id);
    setVoice(coachOf(id).voice);
    writeStored(CHARACTER_KEY, id);
  };

  // The talk is started inside the click, so the sound is allowed to play.
  const beginTalk = () => {
    if (!engine || !avatar) return;
    const instructions = liveInstructions({ persona: coach.name, facts, language: lang === 'pt' ? 'pt' : 'en' });
    void conversation.start({ engine, instructions, voice, appVoice, turnMode });
  };

  const start = () => {
    if (consented) beginTalk();
    else setAskingConsent(true);
  };

  const accept = () => {
    writeStored(CONSENT_KEY, '1');
    setConsented(true);
    setAskingConsent(false);
    beginTalk();
  };

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void conversation.sendText(text);
  };

  const holdStart = () => {
    setHolding(true);
    conversation.interrupt();
    conversation.setTalking(true);
  };

  const holdEnd = () => {
    if (!holding) return;
    setHolding(false);
    conversation.setTalking(false);
  };

  const save = async () => {
    if (!backend || saving) return;
    const lines = live.lines.filter((line) => line.text.trim() !== '');
    if (lines.length === 0) return;
    setSaving(true);
    try {
      const chat = await backend.createTutorChat({ mode: 'live' });
      const first = lines.find((line) => line.role === 'user');
      if (first) await backend.renameTutorChat(chat.id, titleFromQuestion(first.text));
      for (const line of lines) await backend.addTutor(chat.id, line.role === 'user' ? 'user' : 'assistant', line.text);
      notify(t('Saved to your coach chats.'), 'ok');
      navigate('/coach');
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (() => {
    switch (live.status) {
      case 'connecting':
        return t('Connecting…');
      case 'listening':
        return live.userSpeaking ? t('I hear you…') : t('Listening');
      case 'thinking':
        return t('Thinking…');
      case 'speaking':
        return t('Speaking');
      case 'ended':
        return t('The talk has ended');
      default:
        return t('Ready when you are');
    }
  })();

  const engineLabel =
    engine === 'gemini'
      ? t('Gemini Live, with your key')
      : engine === 'typed'
        ? t('Your AI key writes, the app voice reads')
        : t('No AI key yet');

  return (
    <main className="page live">
      <BackLink to="/coach">{t('Back to the coach')}</BackLink>
      <PageHeader
        eyebrow={t('Coach')}
        title={t('Talk live')}
        aside={<span className="live__engine">{engineLabel}</span>}
      >
        <p className="live__intro">{t('Speak with your coach, as you would with a teacher. It answers with its voice and its face.')}</p>
      </PageHeader>

      {!bridge && (
        <Notice tone="info">{t('Talk live works in the danna desktop app. Here you can see the coach, but not talk to it.')}</Notice>
      )}
      {bridge && ai.loaded && !engine && (
        <Notice tone="info">
          {t('Add an AI key in Settings to talk with your coach.')}{' '}
          <button type="button" className="btn btn--text" onClick={() => navigate('/settings')}>
            {t('Open Settings')}
          </button>
        </Notice>
      )}
      {live.error && <Notice tone="error">{live.error}</Notice>}

      <section className="live__stage" aria-label={t('Your coach')}>
        <CoachStage coach={coach} conversation={conversation} lang={lang === 'pt' ? 'pt' : 'en'} onAvatar={onAvatar} />
        <div className="live__caption">
          <p className="live__status" role="status" aria-live="polite">
            <span className={`live__dot live__dot--${live.status}`} aria-hidden="true" />
            {statusLabel}
          </p>
          {live.notice && <p className="live__notice">{live.notice}</p>}
        </div>
        <div className="live__gestures" role="group" aria-label={t('Gestures')}>
          <button type="button" className="btn btn--ghost btn--sm" disabled={!avatar} onClick={() => avatar?.gesture('handup')}>
            {t('Raise a hand')}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" disabled={!avatar} onClick={() => avatar?.gesture('thumbup')}>
            {t('Thumbs up')}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" disabled={!avatar} onClick={() => avatar?.gesture('ok')}>
            {t('OK')}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" disabled={!avatar} onClick={() => avatar?.gesture('shrug')}>
            {t('Shrug')}
          </button>
        </div>
      </section>

      {active && (
        <div className="live__controls">
          {engine === 'gemini' && turnMode === 'manual' && (
            <button
              type="button"
              className={`btn btn--primary live__talk${holding ? ' is-talking' : ''}`}
              onPointerDown={holdStart}
              onPointerUp={holdEnd}
              onPointerLeave={holdEnd}
              onPointerCancel={holdEnd}
              aria-pressed={holding}
            >
              <Mic aria-hidden="true" />
              {t('Hold to talk')}
            </button>
          )}
          {engine === 'gemini' && (
            <button type="button" className="btn btn--ghost" onClick={() => conversation.setMuted(!live.muted)} aria-pressed={live.muted}>
              {live.muted ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
              {live.muted ? t('Unmute') : t('Mute')}
            </button>
          )}
          {live.status === 'speaking' && (
            <button type="button" className="btn btn--ghost" onClick={() => conversation.interrupt()}>
              <Square aria-hidden="true" />
              {t('Stop the coach')}
            </button>
          )}
          {engine === 'typed' && (
            <VoiceButton
              phase={voiceInput.phase}
              supported={voiceInput.supported}
              enabled={ai.canTranscribe}
              onStart={() => {
                conversation.interrupt();
                void voiceInput.start();
              }}
              onStop={voiceInput.stop}
            />
          )}
          <button type="button" className="btn btn--ghost" onClick={() => conversation.stop()}>
            <PhoneOff aria-hidden="true" />
            {t('End talk')}
          </button>
        </div>
      )}

      {active && (
        <form className="live__composer" onSubmit={send}>
          <input
            className="live__input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('Type a message instead')}
            aria-label={t('Type a message instead')}
            maxLength={2000}
          />
          <button type="submit" className="btn btn--primary btn--icon" disabled={!draft.trim()} aria-label={t('Send')}>
            <ArrowUp aria-hidden="true" />
          </button>
        </form>
      )}

      <section className="live__transcript" aria-label={t('Conversation')}>
        {live.lines.length === 0 ? (
          <p className="live__empty">{t('Your words and your coach’s words appear here.')}</p>
        ) : (
          live.lines.map((line) => (
            <p key={line.id} className={`live__line live__line--${line.role}`}>
              <span className="live__who">{line.role === 'user' ? t('You') : coach.name}</span>
              {line.text}
            </p>
          ))
        )}
      </section>

      {live.ended && live.lines.length > 0 && (
        <section className="live__summary" aria-label={t('The talk')}>
          <p className="live__intro">{t('Save this talk to your coach chats to read it again later.')}</p>
          <div className="live__row">
            <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={saving || !backend}>
              <Save aria-hidden="true" />
              {t('Save to my coach chats')}
            </button>
          </div>
        </section>
      )}

      {!active && (
        <section className="live__setup" aria-label={t('Before you start')}>
          <div className="live__coaches" role="radiogroup" aria-label={t('Your coach')}>
            {COACHES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={coachId === item.id}
                className="live__coach"
                onClick={() => choose(item.id)}
              >
                <strong>{item.name}</strong>
                <span>{details[item.id]}</span>
              </button>
            ))}
          </div>
          <div className="live__row">
            {engine === 'gemini' && (
              <Field label={t('Coach voice')}>
                <Select<string>
                  label={t('Coach voice')}
                  value={voice}
                  onChange={setVoice}
                  options={GEMINI_VOICES.map((name) => ({ value: name, label: name }))}
                />
              </Field>
            )}
            {engine === 'gemini' && (
              <div className="live__modes" role="group" aria-label={t('How you talk')}>
                <button type="button" className="btn btn--ghost" aria-pressed={turnMode === 'auto'} onClick={() => setTurnMode('auto')}>
                  {t('Talk freely')}
                </button>
                <button type="button" className="btn btn--ghost" aria-pressed={turnMode === 'manual'} onClick={() => setTurnMode('manual')}>
                  {t('Hold to talk')}
                </button>
              </div>
            )}
          </div>
          {askingConsent ? (
            <div className="live__consent">
              <p>
                {engine === 'gemini'
                  ? t('Talking sends your voice to Google while the talk runs, so that the coach can answer. Use headphones for the best result. Nothing is saved unless you save the talk at the end.')
                  : t('Talking sends your words to your AI provider while the talk runs, so that the coach can answer. Use headphones for the best result. Nothing is saved unless you save the talk at the end.')}
              </p>
              <button type="button" className="btn btn--primary btn--block" onClick={accept} disabled={!engine || !avatar}>
                {t('I understand, start talking')}
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--primary btn--block" onClick={start} disabled={!engine || !avatar}>
              {live.ended ? t('Talk again') : t('Start talking')}
            </button>
          )}
        </section>
      )}

      <p className="live__credit">
        {t('The coach is drawn with TalkingHead (MIT). Ana is made with MakeHuman (CC0).')}
      </p>
    </main>
  );
}
