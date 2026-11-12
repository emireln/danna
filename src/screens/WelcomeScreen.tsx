import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, Cloud, Laptop, Map as MapIcon, TrendingUp } from 'lucide-react';
import { BrandMark, Wordmark } from '../components/ui';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { markWelcomed, onlineAvailable } from '../lib/session';
import { useT } from '../lib/i18n/react';
import { useAuth } from '../state/auth';

const POINTS = [
  { icon: MapIcon, text: 'A roadmap from A1 to C1, one lesson at a time' },
  { icon: BookOpen, text: 'Grammar, words, reading, listening, speaking and writing' },
  { icon: TrendingUp, text: 'A TOEFL warm-up when you need it' },
];

type Choice = 'device' | 'account';

export function WelcomeScreen() {
  const navigate = useNavigate();
  const t = useT();
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
      <div className="welcome__body">
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
                <h1 className="welcome__title">{t('Learn English, one small step at a time.')}</h1>
                <div className="welcome__points">
                  {POINTS.map((point) => {
                    const Icon = point.icon;
                    return (
                      <div key={point.text} className="welcome__point">
                        <span className="welcome__point-icon">
                          <Icon aria-hidden="true" />
                        </span>
                        <span>{t(point.text)}</span>
                      </div>
                    );
                  })}
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
                  <p className="eyebrow">{t('Your progress')}</p>
                  <h1 className="welcome__title mt-2">{t('How would you like to use danna?')}</h1>
                </div>
                <div className="mode-grid" role="radiogroup" aria-label={t('How you use danna')}>
                  <button role="radio" aria-checked={choice === 'device'} className="mode-card" onClick={() => setChoice('device')}>
                    <span className="mode-card__icon">
                      <Laptop aria-hidden="true" />
                    </span>
                    <span className="mode-card__title">{t('On this device')}</span>
                    <span className="mode-card__text">{t('No account needed. Everything stays here.')}</span>
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
                    <span className="mode-card__title">{t('Online account')}</span>
                    <span className="mode-card__text">
                      {online ? t('Sync across your devices and connect with friends.') : t('Not available yet.')}
                    </span>
                    <span className="mode-card__tick">{choice === 'account' && <Check aria-hidden="true" />}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="welcome__footer">
        <div className="welcome__bar">
          {step === 0 ? (
            <LanguageSwitch />
          ) : (
            <button className="btn btn--ghost" onClick={() => setStep(0)}>
              <ArrowLeft /> {t('Back')}
            </button>
          )}
          {step === 0 ? (
            <button className="btn btn--primary" onClick={() => setStep(1)}>
              {t('Continue')} <ArrowRight />
            </button>
          ) : (
            <button className="btn btn--primary" disabled={!choice} onClick={finish}>
              {t('Continue')} <ArrowRight />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
