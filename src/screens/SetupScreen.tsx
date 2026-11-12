import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { Field, FeatureCard, Notice, Spinner } from '../components/ui';
import { DateField, todayIso } from '../components/Pickers';
import { errorText } from '../lib/bridge';
import { placementRows } from '../lib/roadmap';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useToast } from '../state/toast';
import { LEVELS, type Goal, type Level } from '../lib/types';

const TARGETS = [80, 90, 100, 110];
const MINUTES = [10, 15, 25, 40];
const LEVEL_TEXT: Record<Level, string> = {
  A1: 'Single words and simple sentences about yourself. We start at the very beginning.',
  A2: 'Short sentences and everyday topics. Lessons from A1 are marked complete.',
  B1: 'Clear everyday and study topics. Lessons from A1 and A2 are marked complete.',
  B2: 'Longer texts and opinions. Lessons from A1 to B1 are marked complete.',
  C1: 'Complex structures and academic writing. Lessons from A1 to B2 are marked complete.',
};

const STEPS = ['Name', 'Goal', 'Time', 'Level', 'AI'];

/** The heading block every step uses: a short eyebrow, the question, and one line of help. */
function StepHead({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="step-head">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      {text && <p className="muted">{text}</p>}
    </div>
  );
}

export function SetupScreen() {
  const navigate = useNavigate();
  const { backend, mode } = useAuth();
  const { profile, patchProfile, ready, loadError } = useAppData();
  const { notify } = useToast();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [examDate, setExamDate] = useState<string | null>(null);
  const [daily, setDaily] = useState<number | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) {
    return (
      <div className="auth" role="status">
        <Spinner dark />
        <span className="sr-only">Loading</span>
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
  const shownGoal = goal ?? profile.goal;
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
      // The earlier levels are marked done before the setup is marked finished. If that fails, the setup is
      // still open, so pressing the button again finishes the placement.
      if (firstTime && backend) {
        const rows = placementRows(shownLevel);
        await Promise.all(rows.map((row) => backend.upsertLessonProgress(row)));
      }
      await patchProfile({
        username: shownUsername,
        display_name: shownName.trim(),
        goal: shownGoal,
        target_score: shownTarget,
        exam_date: shownDate || null,
        daily_minutes: shownDaily,
        level: shownLevel,
        onboarding_done: true,
      });
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
      <div className="wizard__body">
        <div className="wizard__content">
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
              className="stack stack--loose"
            >
              {step === 0 && (
                <>
                  <StepHead
                    eyebrow="Learning setup"
                    title="What should danna call you?"
                    text={
                      mode === 'supabase'
                        ? 'Your username is how friends find you. You can change these later in your profile.'
                        : 'This is how danna greets you. You can change it later in your profile.'
                    }
                  />
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
                  <StepHead
                    eyebrow="Your goal"
                    title="What do you want to practice?"
                    text="Most people choose General English. The TOEFL warm-up is an extra track you can add at any time."
                  />
                  <div className="choice-grid" role="radiogroup" aria-label="Goal">
                    <button role="radio" aria-checked={shownGoal === 'english'} className="choice" onClick={() => setGoal('english')}>
                      <span className="choice__title">General English</span>
                      <span className="choice__text">Grammar, words, reading, listening, speaking and writing for daily life, study and work.</span>
                    </button>
                    <button role="radio" aria-checked={shownGoal === 'toefl'} className="choice" onClick={() => setGoal('toefl')}>
                      <span className="choice__title">TOEFL warm-up</span>
                      <span className="choice__text">Practice in the style of the test, with an estimated score and a countdown.</span>
                    </button>
                  </div>
                  {shownGoal === 'toefl' && (
                    <>
                      <p className="field__label">Target score</p>
                      <div className="choice-grid choice-grid--four" role="radiogroup" aria-label="Target score">
                        {TARGETS.map((score) => (
                          <button key={score} role="radio" aria-checked={shownTarget === score} className="choice" onClick={() => setTarget(score)}>
                            <span className="choice__title">{score}+</span>
                            <span className="choice__text">out of 120</span>
                          </button>
                        ))}
                      </div>
                      <Field label="Exam date (optional)" hint="Shown as a countdown on the Today page.">
                        <DateField label="Exam date" value={shownDate} onChange={setExamDate} min={todayIso()} />
                      </Field>
                    </>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <StepHead
                    eyebrow="Daily time"
                    title="How much time can you give each day?"
                    text="A steady 15 minutes beats a long session once a week."
                  />
                  <div className="choice-grid" role="radiogroup" aria-label="Minutes per day">
                    {MINUTES.map((minutes) => (
                      <button key={minutes} role="radio" aria-checked={shownDaily === minutes} className="choice" onClick={() => setDaily(minutes)}>
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
                  <StepHead
                    eyebrow="Current level"
                    title="Where do you feel most comfortable?"
                    text="Be honest. The level check will confirm it."
                  />
                  <div className="choice-grid" role="radiogroup" aria-label="Current level">
                    {LEVELS.map((item) => (
                      <button key={item} role="radio" aria-checked={shownLevel === item} className="choice" onClick={() => setLevel(item)}>
                        <span className="choice__title">{item}</span>
                        <span className="choice__text">{LEVEL_TEXT[item]}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <StepHead
                    eyebrow="Optional"
                    title="Add an AI key for a personal coach"
                    text="Works with OpenAI, Anthropic, Google Gemini, OpenRouter or DeepSeek. You can skip this and everything still works."
                  />
                  <FeatureCard
                    icon={<Sparkles />}
                    title="Add it later in Settings"
                    meta="Paste a key whenever you like. It stays on this device."
                  />
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {error && <Notice tone="error">{error}</Notice>}
        </div>
      </div>

      <div className="wizard__footer">
        <div className="wizard__bar">
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
    </div>
  );
}
