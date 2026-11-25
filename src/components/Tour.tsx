// The guided tour. After the setup, Today offers a short walk past the main buttons: each step lights one button and says
// what it is for. It can be closed at any time, and Settings starts it again.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Map as MapIcon, X } from 'lucide-react';
import { useT } from '../lib/i18n/react';
import { readTourStatus, setTourStatus } from '../lib/tour';

interface Stop {
  /** The data-tour name of the button this step lights. */
  target: string;
  title: string;
  text: string;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

type Phase = 'idle' | 'offer' | 'running';

const CARD_WIDTH = 320;
const EDGE = 16;
const GAP = 14;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

// Where a button is on screen, or null when it is not shown.
function boxOf(target: string): Box | null {
  const element = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export function GuidedTour() {
  const t = useT();
  const location = useLocation();
  const [phase, setPhase] = useState<Phase>('idle');
  const [stops, setStops] = useState<Stop[]>([]);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const primary = useRef<HTMLButtonElement>(null);

  // The steps follow the main buttons of the app. A step whose button is not on screen is left out.
  const allStops: Stop[] = [
    { target: 'today', title: t('Today'), text: t('Your daily goal, quests and next lesson start here.') },
    {
      target: 'study',
      title: t('Self study'),
      text: t('Grammar, words, reading, listening, speaking and writing, one section at a time.'),
    },
    { target: 'review', title: t('Review'), text: t('Your flashcards and decks, with spaced repetition.') },
    {
      target: 'coach',
      title: t('Coach'),
      text: t('Practice conversation and writing with your coach, and get feedback on your own text.'),
    },
    {
      target: 'search',
      title: t('Search'),
      text: t('Find lessons, chats, files and pages. Press Ctrl+K to search from anywhere.'),
    },
    {
      target: 'library',
      title: t('My library'),
      text: t('Keep your own PDF, TXT and Markdown files, and learn from them.'),
    },
    {
      target: 'account',
      title: t('Your account'),
      text: t('Your profile and Settings are in this menu. Settings holds the language, the look and your AI keys.'),
    },
  ];

  const close = () => {
    setTourStatus('seen');
    setPhase('idle');
  };

  // Starts the walk from its first step.
  const start = () => {
    setTourStatus('seen');
    const found = allStops.filter((stop) => boxOf(stop.target) !== null);
    if (found.length === 0) {
      setPhase('idle');
      return;
    }
    setStops(found);
    setIndex(0);
    setPhase('running');
  };

  const next = () => {
    if (index >= stops.length - 1) close();
    else setIndex(index + 1);
  };

  const back = () => setIndex(Math.max(index - 1, 0));

  // Each visit to a page is checked once: Settings starts the tour, and Today offers it once after the setup.
  useEffect(() => {
    const state = location.state as { tour?: boolean } | null;
    if (state?.tour) start();
    else if (location.pathname === '/' && readTourStatus() === 'offer') setPhase('offer');
  }, [location]);

  const target = phase === 'running' ? stops[index]?.target : undefined;

  // The lit button is measured again when the step changes, and when the window or the page moves.
  useLayoutEffect(() => {
    if (!target) {
      setBox(null);
      return undefined;
    }
    const measure = () => setBox(boxOf(target));
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [target]);

  // The main button takes the keyboard focus at each step, so Enter moves on.
  useEffect(() => {
    if (phase !== 'idle') primary.current?.focus({ preventScroll: true });
  }, [phase, index]);

  // Escape closes the tour, and the arrow keys move through it.
  useEffect(() => {
    if (phase === 'idle') return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      else if (phase === 'running' && event.key === 'ArrowRight') next();
      else if (phase === 'running' && event.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (phase === 'idle') return null;

  if (phase === 'offer') {
    return (
      <div className="tour-offer">
        <motion.div
          className="tour-offer__card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-offer-title"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          <span className="tour-offer__icon" aria-hidden="true">
            <MapIcon />
          </span>
          <h2 id="tour-offer-title" className="tour-offer__title">
            {t('Take a quick tour?')}
          </h2>
          <p className="tour-offer__text">
            {t('See the main buttons of Danna in less than a minute. You can skip it and take the tour later from Settings.')}
          </p>
          <div className="tour-offer__actions">
            <button type="button" className="btn btn--ghost" onClick={close}>
              {t('Close')}
            </button>
            <button ref={primary} type="button" className="btn btn--primary" onClick={start}>
              {t('Start the tour')}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const stop = stops[index];
  if (!stop) return null;
  const last = index >= stops.length - 1;

  // The card sits under the lit button, or above it when the button is in the lower half of the window. Its arrow points
  // at the button's middle, and the card stays inside the window.
  const width = Math.min(CARD_WIDTH, window.innerWidth - EDGE * 2);
  let placement = 'tour__card--centre';
  let place: CSSProperties = {};
  let arrow = width / 2;
  if (box) {
    const centre = box.left + box.width / 2;
    const left = clamp(centre - width / 2, EDGE, window.innerWidth - width - EDGE);
    arrow = clamp(centre - left, 22, width - 22);
    if (box.top + box.height / 2 < window.innerHeight / 2) {
      placement = 'tour__card--below';
      place = { top: box.top + box.height + GAP, left };
    } else {
      placement = 'tour__card--above';
      place = { bottom: window.innerHeight - (box.top - GAP), left };
    }
  }
  const style = { ...place, width, '--arrow-x': `${arrow}px` } as CSSProperties;

  return (
    <div className={box ? 'tour' : 'tour tour--plain'}>
      {box && (
        <div
          className="tour__spot"
          aria-hidden="true"
          style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }}
        />
      )}
      <motion.div
        key={index}
        className={`tour__card ${placement}`}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="tour__head">
          <span className="tour__count">{t('Step {step} of {total}', { step: index + 1, total: stops.length })}</span>
          <button type="button" className="tour__close" onClick={close} aria-label={t('Close the tour')}>
            <X aria-hidden="true" />
          </button>
        </div>
        <h2 id="tour-step-title" className="tour__title">
          {stop.title}
        </h2>
        <p className="tour__text">{stop.text}</p>
        <div className="tour__progress" aria-hidden="true">
          <span style={{ width: `${((index + 1) / stops.length) * 100}%` }} />
        </div>
        <div className="tour__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={back} disabled={index === 0}>
            <ArrowLeft aria-hidden="true" /> {t('Back')}
          </button>
          <button ref={primary} type="button" className="btn btn--primary btn--sm" onClick={next}>
            {last ? t('Finish') : t('Next')} {!last && <ArrowRight aria-hidden="true" />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
