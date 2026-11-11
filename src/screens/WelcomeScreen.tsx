import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, Cloud, Laptop, Map as MapIcon, TrendingUp } from 'lucide-react';
import { BrandMark, Wordmark } from '../components/ui';
import { markWelcomed, onlineAvailable } from '../lib/session';
import { useAuth } from '../state/auth';

const POINTS = [
  { icon: MapIcon, text: 'A roadmap that grows with your level' },
  { icon: BookOpen, text: 'Every section, with clear feedback' },
  { icon: TrendingUp, text: 'A score estimate you can watch improve' },
];

type Choice = 'device' | 'account';

export function WelcomeScreen() {
  const navigate = useNavigate();
  const { status, useOffline } = useAuth();
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<Choice | null>(null);
  const online = onlineAvailable();

  if (status === 'in') return <Navigate to="/" replace />;

  const finish = () => {
    markWelcomed();
    if (choice === 'device') {
      useOffline();
      navigate('/setup', { replace: true });
    } else {
      navigate('/auth', { replace: true, state: { next: '/setup' } });
    }
  };

  return (
    <div className="welcome">
      <div className="welcome__card">
        <AnimatePresence mode="wait" initial={false}>
          {step === 0 ? (
            <motion.div
              key="intro"
              className="welcome__card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <div className="welcome__brand">
                <BrandMark size={56} />
                <Wordmark className="wordmark--xl" />
              </div>
              <h1 className="welcome__title">Practise TOEFL, one small step at a time.</h1>
              <div className="welcome__points">
                {POINTS.map((point) => {
                  const Icon = point.icon;
                  return (
                    <div key={point.text} className="welcome__point">
                      <span className="welcome__point-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <span>{point.text}</span>
                    </div>
                  );
                })}
              </div>
              <div className="welcome__actions">
                <span />
                <button className="btn btn--primary" onClick={() => setStep(1)}>
                  Continue <ArrowRight />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="mode"
              className="welcome__card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <div>
                <p className="eyebrow">Your progress</p>
                <h1 className="welcome__title" style={{ marginTop: 6 }}>
                  How would you like to use danna?
                </h1>
              </div>
              <div className="mode-grid" role="radiogroup" aria-label="How you use danna">
                <button
                  role="radio"
                  aria-checked={choice === 'device'}
                  className="mode-card"
                  onClick={() => setChoice('device')}
                >
                  <span className="mode-card__icon">
                    <Laptop aria-hidden="true" />
                  </span>
                  <span className="mode-card__title">On this device</span>
                  <span className="mode-card__text">No account needed. Everything stays here.</span>
                  <span className="mode-card__tick">{choice === 'device' && <Check aria-hidden="true" />}</span>
                </button>
                <button
                  role="radio"
                  aria-checked={choice === 'account'}
                  className="mode-card"
                  disabled={!online}
                  onClick={() => setChoice('account')}
                >
                  <span className="mode-card__icon">
                    <Cloud aria-hidden="true" />
                  </span>
                  <span className="mode-card__title">Online account</span>
                  <span className="mode-card__text">
                    {online ? 'Sync across your devices and connect with friends.' : 'Not available yet.'}
                  </span>
                  <span className="mode-card__tick">{choice === 'account' && <Check aria-hidden="true" />}</span>
                </button>
              </div>
              <div className="welcome__actions">
                <button className="btn btn--ghost" onClick={() => setStep(0)}>
                  Back
                </button>
                <button className="btn btn--primary" disabled={!choice} onClick={finish}>
                  Continue <ArrowRight />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
