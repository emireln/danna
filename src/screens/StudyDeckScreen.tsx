// A study session for one deck: the cards due now, one at a time. Turn a card, grade it, and its next interval is set.
// When the session ends, it is saved as a practice run (so it counts in the profile, the league and the quests), and
// the XP and the streak move the same way a lesson moves them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, RotateCw } from 'lucide-react';
import { FlipCard } from '../components/FlipCard';
import { GradeBar } from '../components/GradeBar';
import { BackLink, Empty, Notice, PageHeader, ProgressBar, Skeleton } from '../components/ui';
import { errorText } from '../lib/bridge';
import { sessionQueue, XP_PER_CARD } from '../lib/deck';
import { FLASHCARD_REF } from '../lib/quests';
import { localDate, nextStreak } from '../lib/progress';
import { useT } from '../lib/i18n/react';
import { gradeCard, gradeWaits, GRADES, type Grade } from '../lib/srs';
import type { AnswerRecord, CardRow, DeckRow } from '../lib/types';
import { useAppData } from '../state/appData';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';

interface Graded {
  card: CardRow;
  grade: Grade;
}

export function StudyDeckScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { backend } = useAuth();
  const { profile, patchProfile } = useAppData();
  const { notify } = useToast();
  const { id = '' } = useParams();
  const [deck, setDeck] = useState<DeckRow | null | undefined>(undefined);
  const [queue, setQueue] = useState<CardRow[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Graded[]>([]);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(Date.now());

  const load = useCallback(async () => {
    if (!backend) return;
    try {
      const decks = await backend.listDecks();
      const found = decks.find((item) => item.id === id) ?? null;
      setDeck(found);
      if (found) {
        const cards = await backend.listCards(id);
        setQueue(sessionQueue(cards, new Date()));
      }
      setIndex(0);
      setRevealed(false);
      setResults([]);
      setFinished(false);
      started.current = Date.now();
      setError(null);
    } catch (failure) {
      setError(errorText(failure));
      setDeck((current) => current ?? null);
    }
  }, [backend, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = queue[index];
  const waits = useMemo(() => (current ? gradeWaits(current, new Date()) : null), [current]);

  // The session ends: the answers are saved as one practice run, and the XP and the streak move as in a lesson.
  const finish = async (graded: Graded[]) => {
    setFinished(true);
    if (!backend || !deck) return;
    const good = graded.filter((item) => item.grade === 'good' || item.grade === 'easy').length;
    const score = Math.round((good / graded.length) * 100);
    const xp = graded.length * XP_PER_CARD;
    const answers: AnswerRecord[] = graded.map((item) => ({
      id: item.card.id,
      skill: 'language',
      fraction: item.grade === 'again' ? 0 : item.grade === 'hard' ? 0.5 : 1,
      response: item.grade,
    }));
    const seconds = Math.round((Date.now() - started.current) / 1000);
    try {
      await backend.insertAttempt({
        kind: 'practice',
        ref_id: FLASHCARD_REF,
        title: t('Flashcards: {deck}', { deck: deck.title }),
        score_pct: score,
        predicted: null,
        skills: { language: score },
        answers,
        duration_s: seconds,
        xp,
      });
      if (profile) {
        const today = localDate();
        await patchProfile({
          xp: profile.xp + xp,
          streak: nextStreak(profile.last_active, profile.streak, today),
          last_active: today,
        });
      }
    } catch (failure) {
      notify(t(errorText(failure)), 'error');
    }
  };

  const grade = async (choice: Grade) => {
    if (!backend || !current || saving) return;
    setSaving(true);
    try {
      const next = gradeCard(current, choice, new Date());
      await backend.updateCard(current.id, next);
      const graded = [...results, { card: current, grade: choice }];
      setResults(graded);
      setRevealed(false);
      if (index + 1 >= queue.length) {
        await finish(graded);
      } else {
        setIndex(index + 1);
      }
    } catch (failure) {
      notify(t(errorText(failure)), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Space or Enter turns the card; 1 to 4 grade it once it is turned.
  useEffect(() => {
    if (!current || finished) return undefined;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        setRevealed(true);
      } else if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        void grade(GRADES[Number(event.key) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (deck === undefined) {
    return (
      <div className="page">
        <Skeleton height={320} />
      </div>
    );
  }
  if (deck === null) {
    return (
      <div className="page">
        <BackLink to="/decks">{t('Flashcards')}</BackLink>
        <Empty title={t('This deck could not be found')} action={<button className="btn btn--ghost" onClick={() => navigate('/decks')}>{t('Back to flashcards')}</button>} />
      </div>
    );
  }

  const back = (
    <BackLink to={`/decks/${deck.id}`}>{deck.title}</BackLink>
  );

  if (error) {
    return (
      <div className="page">
        {back}
        <Notice tone="error">{t(error)}</Notice>
      </div>
    );
  }

  if (finished) {
    const counts = GRADES.map((grade) => ({ grade, total: results.filter((item) => item.grade === grade).length }));
    const good = results.filter((item) => item.grade === 'good' || item.grade === 'easy').length;
    const score = results.length ? Math.round((good / results.length) * 100) : 0;
    return (
      <div className="page">
        {back}
        <PageHeader eyebrow={t('Session done')} title={t('{count} cards studied', { count: results.length })} />
        <div className="stack">
          <div className="study-summary">
            {counts.map((item) => (
              <div key={item.grade} className={`study-summary__item study-summary__item--${item.grade}`}>
                <span className="study-summary__value">{item.total}</span>
                <span className="study-summary__label">{gradeName(t, item.grade)}</span>
              </div>
            ))}
          </div>
          <div className="stack">
            <span className="small muted">{t('Known well: {percent}%', { percent: score })}</span>
            <ProgressBar value={score} max={100} label={t('Known well: {percent}%', { percent: score })} />
          </div>
          <p className="study-summary__xp">{t('+{xp} XP', { xp: results.length * XP_PER_CARD })}</p>
          <div className="row row--wrap">
            <button className="btn btn--primary" onClick={() => void load()}>
              <RotateCw aria-hidden="true" /> {t('Study again')}
            </button>
            <button className="btn btn--ghost" onClick={() => navigate(`/decks/${deck.id}`)}>
              {t('Back to the deck')} <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="page">
        {back}
        <Empty title={t('Nothing is due right now')} action={<button className="btn btn--ghost" onClick={() => navigate(`/decks/${deck.id}`)}>{t('Back to the deck')}</button>}>
          {t('Cards come back when they are due. Come back later, or add cards to the deck.')}
        </Empty>
      </div>
    );
  }

  return (
    <div className="page">
      {back}
      <PageHeader title={deck.title}>
        <div className="mt-3">
          <ProgressBar value={index} max={queue.length} label={t('{done} of {total}', { done: index, total: queue.length })} />
        </div>
      </PageHeader>
      <div className="stack study-stage">
        <FlipCard
          front={current.front}
          back={current.back}
          note={current.note}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          frontLabel={t('Front of the card')}
          backLabel={t('Back of the card')}
        />
        {!revealed ? (
          <button className="btn btn--primary btn--block" onClick={() => setRevealed(true)}>
            {t('Show the answer')}
          </button>
        ) : (
          waits && <GradeBar waits={waits} disabled={saving} onGrade={(choice) => void grade(choice)} />
        )}
        <p className="small muted study-stage__hint">{t('Space shows the answer. Keys 1 to 4 grade it.')}</p>
      </div>
    </div>
  );
}

function gradeName(t: ReturnType<typeof useT>, grade: Grade): string {
  switch (grade) {
    case 'again':
      return t('Again');
    case 'hard':
      return t('Hard');
    case 'good':
      return t('Good');
    case 'easy':
      return t('Easy');
  }
}
