import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { Field, Notice, Spinner } from '../components/ui';
import { errorText } from '../lib/bridge';
import { placementRows } from '../lib/roadmap';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useToast } from '../state/toast';
import type { Level } from '../lib/types';
import { LEVELS } from '../lib/types';

const TARGETS = [80, 90, 100, 110];
const MINUTES = [10, 15, 25, 40];
const LEVEL_TEXT: Record<Level, string> = {
  A2: 'Short sentences and everyday topics. We start at the beginning.',
  B1: 'Clear everyday and study topics. Unit 1 is marked complete.',
  B2: 'Academic reading and listening. Units 1 and 2 are marked complete.',
  C1: 'Complex structures and academic writing. Units 1 to 3 are marked complete.',
};

const STEPS = ['Name', 'Target', 'Time', 'Level', 'AI'];

export function SetupScreen() {
  const navigate = useNavigate();
  const { backend, mode } = useAuth();
  const { profile, patchProfile, ready, loadError } = useAppData();
  const { notify } = useToast();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [examDate, setExamDate] = useState<string | null>(null);
  const [daily, setDaily] = useState<number | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) {
    return (
      <div className="auth">
        <span className="spinner spinner--dark" aria-label="Loading" />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="auth">
        <Notice tone="error">{loadError ?? 'Your profile could not be loaded.'}</Notice>
      </div>
    );
  }

  const shownName = displayName ?? profile.display_name;
  const shownUsername = username ?? profile.username;
  const shownTarget = target ?? profile.target_score;
  const shownDate = examDate ?? profile.exam_date ?? '';
  const shownDaily = daily ?? profile.daily_minutes;
  const shownLevel = level ?? profile.level;

  const next = () => {
    setError(null);
    if (step === 0) {
      if (!shownName.trim()) return setError('Add the name you want danna to use.');
      if (mode === 'supabase' && !/^[a-z0-9_]{3,20}$/.test(shownUsername)) {
        return setError('Usernames use 3 to 20 lowercase letters, numbers or underscores.');
      }
    }
    setDirection(1);
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  };

  const back = () => {
    setError(null);
    setDirection(-1);
    setStep((value) => Math.max(value - 1, 0));
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const firstTime = !profile.onboarding_done;
      await patchProfile({
        username: shownUsername,
        display_name: shownName.trim(),
        target_score: shownTarget,
        exam_date: shownDate || null,
        daily_minutes: shownDaily,
        level: shownLevel,
        onboarding_done: true,
      });
      if (firstTime && backend) {
        const rows = placementRows(shownLevel);
        await Promise.all(rows.map((row) => backend.upsertLessonProgress(row)));
      }
      notify('Your plan is ready.', 'ok');
      navigate('/', { replace: true });
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 28 : -28 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -28 : 28 }),
  };

  return (
    <div className="wizard">
      <div className="wizard__steps" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((label, index) => (
          <div key={label} className="wizard__step">
            <motion.span
              initial={false}
              animate={{ scaleX: index <= step ? 1 : 0 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={step}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          className="stack"
          style={{ gap: 22 }}
        >
          {step === 0 && (
            <>
              <div>
                <p className="eyebrow">Learning setup</p>
                <h1 style={{ marginTop: 6 }}>What should danna call you?</h1>
                <p className="muted" style={{ marginTop: 8 }}>
                  {mode === 'supabase'
                    ? 'Your username is how friends find you. You can change these later in your profile.'
                    : 'This is how danna greets you. You can change it later in your profile.'}
                </p>
              </div>
              <Field label="Name">
                <input className="input" value={shownName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} />
              </Field>
              {mode === 'supabase' && (
              <Field label="Username" hint="3 to 20 characters: lowercase letters, numbers and underscores.">
                <input
                  className="input"
                  value={shownUsername}
                  onChange={(event) => setUsername(event.target.value.toLowerCase())}
                  maxLength={20}
                />
              </Field>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <p className="eyebrow">Your target</p>
                <h1 style={{ marginTop: 6 }}>Which TOEFL score are you aiming for?</h1>
                <p className="muted" style={{ marginTop: 8 }}>
                  We use it to set your radar goal and the daily plan.
                </p>
              </div>
              <div className="choice-grid choice-grid--four" role="radiogroup" aria-label="Target score">
                {TARGETS.map((score) => (
                  <button
                    key={score}
                    role="radio"
                    aria-checked={shownTarget === score}
                    className="choice"
                    onClick={() => setTarget(score)}
                  >
                    <span className="choice__title">{score}+</span>
                    <span className="choice__text">out of 120</span>
                  </button>
                ))}
              </div>
              <Field label="Exam date (optional)" hint="Shown as a countdown on the Today page.">
                <input
                  className="input"
                  type="date"
                  value={shownDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setExamDate(event.target.value)}
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <p className="eyebrow">Daily time</p>
                <h1 style={{ marginTop: 6 }}>How much time can you give each day?</h1>
                <p className="muted" style={{ marginTop: 8 }}>
                  A steady 15 minutes beats a long session once a week.
                </p>
              </div>
              <div className="choice-grid" role="radiogroup" aria-label="Minutes per day">
                {MINUTES.map((minutes) => (
                  <button
                    key={minutes}
                    role="radio"
                    aria-checked={shownDaily === minutes}
                    className="choice"
                    onClick={() => setDaily(minutes)}
                  >
                    <span className="choice__title">{minutes} minutes</span>
                    <span className="choice__text">
                      {minutes <= 10 ? 'A quick warm-up' : minutes <= 15 ? 'Recommended' : minutes <= 25 ? 'Steady progress' : 'Deep practice'}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <p className="eyebrow">Current level</p>
                <h1 style={{ marginTop: 6 }}>Where do you feel most comfortable?</h1>
                <p className="muted" style={{ marginTop: 8 }}>
                  Be honest. The diagnostic test will confirm it.
                </p>
              </div>
              <div className="choice-grid" role="radiogroup" aria-label="Current level">
                {LEVELS.map((item) => (
                  <button
                    key={item}
                    role="radio"
                    aria-checked={shownLevel === item}
                    className="choice"
                    onClick={() => setLevel(item)}
                  >
                    <span className="choice__title">{item}</span>
                    <span className="choice__text">{LEVEL_TEXT[item]}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <p className="eyebrow">Optional</p>
                <h1 style={{ marginTop: 6 }}>Add an AI key for a personal coach</h1>
                <p className="muted" style={{ marginTop: 8 }}>
                  Works with OpenAI, Anthropic, Google Gemini or OpenRouter. You can skip this and everything still works.
                </p>
              </div>
              <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <span className="icon-tile">
                  <Sparkles />
                </span>
                <div style={{ flex: 1 }}>
                  <h3>Add it later in Settings</h3>
                  <p className="small muted">Paste a key whenever you like. It stays on this device.</p>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="row row--between">
        <button className="btn btn--ghost" onClick={back} disabled={step === 0 || busy}>
          <ArrowLeft /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn btn--primary" onClick={next}>
            Continue <ArrowRight />
          </button>
        ) : (
          <button className="btn btn--primary" onClick={finish} disabled={busy}>
            {busy ? <Spinner /> : null} Start my plan
          </button>
        )}
      </div>
    </div>
  );
}
