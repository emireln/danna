import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  GraduationCap,
  Info,
  Languages,
  Map as MapIcon,
  RotateCw,
  ScanSearch,
} from 'lucide-react';
import { BannerCarousel } from '../components/Banner';
import { Sheet, Spinner } from '../components/ui';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { nodeStates, progressMap as indexProgress } from '../lib/roadmap';
import { daysUntil } from '../lib/progress';
import { toeflRange } from '../lib/scoring';
import { SKILL_LABEL, type AttemptRow, type LessonProgressRow, type ReviewRow, type Skill } from '../lib/types';
import { useToast } from '../state/toast';
import { useAI } from '../state/ai';

const TILE_COLORS: Record<Skill, string> = {
  reading: '#17245c',
  listening: '#1f3a8a',
  speaking: '#2f6bff',
  writing: '#2a4fb8',
  language: '#0e7c6b',
};

const SKILL_LETTER: Partial<Record<Skill, string>> = { reading: 'R', listening: 'L', speaking: 'S', writing: 'W' };

export function TodayScreen() {
  const navigate = useNavigate();
  const { backend } = useAuth();
  const { profile, banners, patchProfile } = useAppData();
  const { notify } = useToast();
  const { ready: aiReady } = useAI();
  const [focus, setFocus] = useState<'all' | Skill>('all');
  const [progress, setProgress] = useState<LessonProgressRow[] | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [diagnostic, setDiagnostic] = useState<AttemptRow | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    Promise.all([backend.listLessonProgress(), backend.listReviewItems(), backend.listAttempts(40)])
      .then(([rows, items, attempts]) => {
        if (!active) return;
        setProgress(rows);
        setReviews(items);
        setDiagnostic(attempts.find((attempt) => attempt.kind === 'diagnostic') ?? null);
      })
      .catch((error: unknown) => console.error('Could not load your progress', error));
    return () => {
      active = false;
    };
  }, [backend]);

  const nodes = useMemo(() => nodeStates(indexProgress(progress ?? [])), [progress]);
  const dueNow = reviews.filter((item) => new Date(item.due_at).getTime() <= Date.now()).length;
  const focusNode =
    nodes.find((node) => node.state !== 'done' && (focus === 'all' || node.item.lesson.skill === focus)) ??
    nodes.find((node) => node.state !== 'done') ??
    null;

  const unitNodes = focusNode ? nodes.filter((node) => node.item.unit.id === focusNode.item.unit.id) : [];
  const unitDone = unitNodes.filter((node) => node.state === 'done').length;
  const daysLeft = daysUntil(profile?.exam_date ?? null);
  const skillTasks = (skill: Skill) =>
    nodes.filter((node) => !node.item.checkpoint && node.item.lesson.skill === skill && node.state !== 'done').length;

  const saveDate = async () => {
    setSaving(true);
    try {
      await patchProfile({ exam_date: dateDraft || null });
      setDateOpen(false);
      notify(dateDraft ? 'Exam date saved.' : 'Exam date removed.', 'ok');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save the date.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const tiles: Array<{ key: string; label: string; count: number; color: string; letter?: string; icon?: 'lang' | 'review'; to: string }> = [
    ...(['reading', 'listening', 'speaking', 'writing'] as Skill[]).map((skill) => ({
      key: skill,
      label: SKILL_LABEL[skill],
      count: skillTasks(skill),
      color: TILE_COLORS[skill],
      letter: SKILL_LETTER[skill],
      to: `/study/${skill}`,
    })),
    { key: 'language', label: 'Language', count: skillTasks('language'), color: TILE_COLORS.language, icon: 'lang', to: '/study/language' },
    { key: 'review', label: 'Daily review', count: dueNow, color: '#4b5a7a', icon: 'review', to: '/review' },
  ];

  return (
    <div className="page">
      <div className="page__head" style={{ marginBottom: 14 }}>
        <div className="today__title">
          <h1>Today&apos;s Learning</h1>
          <span className="beta">beta</span>
          <button className="btn btn--icon" aria-label="How today's plan works" title="Your plan updates after every session.">
            <Info />
          </button>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/roadmap')}>
          <MapIcon /> Roadmap
        </button>
      </div>

      <label className="sr-only" htmlFor="focus-select">
        Focus
      </label>
      <select
        id="focus-select"
        className="select-line"
        value={focus}
        onChange={(event) => setFocus(event.target.value as 'all' | Skill)}
      >
        <option value="all">Recommended for you</option>
        <option value="reading">Reading focus</option>
        <option value="listening">Listening focus</option>
        <option value="speaking">Speaking focus</option>
        <option value="writing">Writing focus</option>
        <option value="language">Language focus</option>
      </select>

      <div className="stack" style={{ marginTop: 18, gap: 18 }}>
        {banners.length > 0 && <BannerCarousel items={banners} />}

        {progress === null ? (
          <div className="grid-2">
            <div className="skeleton" style={{ height: 110 }} />
            <div className="skeleton" style={{ height: 110 }} />
          </div>
        ) : (
          <div className="grid-2">
            <button
              className="card card--done card--hover"
              onClick={() => navigate('/setup')}
              aria-label="Learning setup, done. Edit"
              style={{ cursor: 'pointer' }}
            >
              <div className="setup-card">
                <span className="icon-tile icon-tile--done">
                  <GraduationCap />
                </span>
                <div className="setup-card__body">
                  <div className="setup-card__title">
                    <h3>Learning Setup</h3>
                    <span className="tag">Done</span>
                  </div>
                  <p className="setup-card__sub">
                    Target {profile?.target_score ?? 100} · {profile?.level ?? 'B1'} · {profile?.daily_minutes ?? 15} min a day
                  </p>
                </div>
              </div>
            </button>

            {diagnostic ? (
              <button className="card card--hover" onClick={() => navigate(`/report/${diagnostic.id}`)}>
                <div className="setup-card">
                  <span className="icon-tile">
                    <ScanSearch />
                  </span>
                  <div className="setup-card__body">
                    <div className="setup-card__title">
                      <h3>Score report</h3>
                    </div>
                    <p className="setup-card__sub">
                      Estimated TOEFL {diagnostic.predicted ?? '—'} of 120
                      {diagnostic.predicted ? `, range ${toeflRange(diagnostic.predicted).join('–')}` : ''}
                    </p>
                  </div>
                  <ArrowRight className="muted" aria-hidden="true" />
                </div>
              </button>
            ) : (
              <button className="card card--hover" onClick={() => navigate('/play/diagnostic')}>
                <span className="tag tag--blue" style={{ position: 'absolute', top: 14, right: 14 }}>
                  Beta
                </span>
                <div className="setup-card">
                  <span className="icon-tile">
                    <ScanSearch />
                  </span>
                  <div className="setup-card__body">
                    <h3>Diagnostic Test</h3>
                    <p className="setup-card__sub">Estimate your TOEFL score across five skills in about 15 minutes.</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        )}

        {focusNode ? (
          <motion.section
            className="hero"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            aria-label="Continue learning"
          >
            <p className="eyebrow" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Unit {focusNode.item.unit.number} · {focusNode.item.unit.title}
            </p>
            <h2 className="hero__title" style={{ marginTop: 6 }}>
              {focusNode.item.checkpoint ? `Check your ${focusNode.item.unit.title.toLowerCase()}` : focusNode.item.lesson.title}
            </h2>
            <p className="hero__text">{focusNode.item.lesson.blurb}</p>
            <p className="hero__meta">
              Total time: {focusNode.item.lesson.minutes} min · {focusNode.item.lesson.questions.length} questions
            </p>
            <div className="hero__progress">
              <div className="progress progress--on-blue" role="progressbar" aria-label="Unit progress" aria-valuemin={0} aria-valuemax={unitNodes.length} aria-valuenow={unitDone}>
                <motion.div
                  className="progress__bar"
                  initial={{ width: 0 }}
                  animate={{ width: `${unitNodes.length ? (unitDone / unitNodes.length) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>
              <span className="hero__count">
                {unitDone}/{unitNodes.length}
              </span>
            </div>
            <button className="btn btn--white btn--block hero__cta" onClick={() => navigate(`/play/lesson/${focusNode.item.lesson.id}`)}>
              Continue Learning
            </button>
          </motion.section>
        ) : (
          <section className="hero" aria-label="Roadmap complete">
            <h2 className="hero__title">Roadmap complete</h2>
            <p className="hero__text">Every unit is finished. Take the mini mock test to see where you stand now.</p>
            <button className="btn btn--white btn--block hero__cta" onClick={() => navigate('/play/test/bundle-mini-mock')}>
              Start mini mock test
            </button>
          </section>
        )}

        <div className="tiles">
          {tiles.map((tile) => {
            const Icon = tile.icon === 'lang' ? Languages : tile.icon === 'review' ? RotateCw : null;
            return (
              <button key={tile.key} className="tile" onClick={() => navigate(tile.to)} aria-label={`${tile.label}, ${tile.count} to do`}>
                <span className="tile__letter" style={{ background: tile.color }}>
                  {Icon ? <Icon size={16} aria-hidden="true" /> : tile.letter}
                </span>
                <span>{tile.label}</span>
                <span className="tile__count">{tile.count}</span>
              </button>
            );
          })}
        </div>

        <div className="strip">
          <CalendarDays aria-hidden="true" />
          <span>Days Until Exam</span>
          {daysLeft === null ? (
            <button className="btn btn--text strip__value" style={{ fontSize: 14 }} onClick={() => { setDateDraft(''); setDateOpen(true); }}>
              Set exam date
            </button>
          ) : (
            <button className="btn btn--text strip__value" onClick={() => { setDateDraft(profile?.exam_date ?? ''); setDateOpen(true); }} aria-label="Change exam date">
              {daysLeft >= 0 ? `D-${daysLeft}` : 'Exam passed'}
            </button>
          )}
        </div>

        {!aiReady && (
          <p className="small muted">
            Connect an AI key in Settings to unlock generated practice sets and coach feedback.
          </p>
        )}
      </div>

      {dateOpen && (
        <Sheet
          title="Exam date"
          onClose={() => setDateOpen(false)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => setDateOpen(false)}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={saveDate} disabled={saving}>
                {saving ? <Spinner /> : 'Save date'}
              </button>
            </>
          }
        >
          <label className="field">
            <span className="field__label">Your TOEFL date</span>
            <input className="input" type="date" value={dateDraft} onChange={(event) => setDateDraft(event.target.value)} />
            <span className="field__hint">Leave it empty to hide the countdown.</span>
          </label>
        </Sheet>
      )}

    </div>
  );
}
