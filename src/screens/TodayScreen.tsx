import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Languages, Map as MapIcon, RotateCw, ScanSearch, X } from 'lucide-react';
import { BannerCarousel } from '../components/Banner';
import { DailyGoal } from '../components/DailyGoal';
import { QuestList } from '../components/QuestList';
import { dayActivity, goalOf, questsOf } from '../lib/quests';
import { localDate } from '../lib/progress';
import { Badge, FeatureCard, Notice, PageHeader, Skeleton } from '../components/ui';
import { Select } from '../components/Pickers';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { nodeStates, progressMap as indexProgress } from '../lib/roadmap';
import { isLevelReportRemoved, rememberLevelReportRemoved } from '../lib/levelReport';
import { bandFor, toeflRange } from '../lib/scoring';
import { SKILL_LABEL, type AttemptRow, type LessonProgressRow, type ReviewRow, type Skill } from '../lib/types';
import { useAI } from '../state/ai';
import { errorText } from '../lib/bridge';
import { useT } from '../lib/i18n/react';
import { tn } from '../lib/i18n';
import { LEVEL_CHECK_ICON, SECTION_ICON } from '../lib/art';
import { levelTestId } from '../content';
import { keepAnswer, lastAnswer } from '../lib/cache';

// What Today loads, kept as one answer so the screen can show the last one at once.
interface TodayData {
  progress: LessonProgressRow[];
  reviews: ReviewRow[];
  diagnostic: AttemptRow | null;
  recent: AttemptRow[];
}

const TILE_COLORS: Record<Skill, string> = {
  reading: '#17245c',
  listening: '#1f3a8a',
  speaking: '#2f6bff',
  writing: '#2a4fb8',
  language: '#0e7c6b',
};

export function TodayScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { backend } = useAuth();
  const { profile, banners } = useAppData();
  const { ready: aiReady } = useAI();
  const [focus, setFocus] = useState<'all' | Skill>('all');
  // What Today showed last time, so it is there at once while the newest numbers are checked.
  const [remembered] = useState(() => lastAnswer<TodayData>('today', backend));
  const [progress, setProgress] = useState<LessonProgressRow[] | null>(remembered?.progress ?? null);
  const [reviews, setReviews] = useState<ReviewRow[]>(remembered?.reviews ?? []);
  const [diagnostic, setDiagnostic] = useState<AttemptRow | null>(remembered?.diagnostic ?? null);
  // The newest runs, for today's goal and quests.
  const [recent, setRecent] = useState<AttemptRow[]>(remembered?.recent ?? []);
  // The level report can be removed from Today for good. The choice is kept on this device, for this account.
  const [reportHidden, setReportHidden] = useState(false);
  useEffect(() => {
    setReportHidden(profile?.id ? isLevelReportRemoved(profile.id) : false);
  }, [profile?.id]);
  const removeReport = () => {
    if (!profile?.id) return;
    rememberLevelReportRemoved(profile.id);
    setReportHidden(true);
  };
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    // The newest level check, however many sessions have been done since.
    Promise.all([backend.listLessonProgress(), backend.listReviewItems(), backend.listAttempts(1, 'diagnostic'), backend.listAttempts(200)])
      .then(([rows, items, checks, runs]) => {
        if (!active) return;
        const data = keepAnswer<TodayData>('today', backend, {
          progress: rows,
          reviews: items,
          diagnostic: checks[0] ?? null,
          recent: runs,
        });
        setProgress(data.progress);
        setReviews(data.reviews);
        setDiagnostic(data.diagnostic);
        setRecent(data.recent);
      })
      .catch((error: unknown) => {
        console.error('Could not load your progress', error);
        if (!active) return;
        setProgress([]);
        setLoadError(errorText(error));
      });
    return () => {
      active = false;
    };
  }, [backend]);

  const nodes = useMemo(() => nodeStates(indexProgress(progress ?? [])), [progress]);
  const dueNow = reviews.filter((item) => new Date(item.due_at).getTime() <= Date.now()).length;
  // Today's goal and quests, from the runs saved today (local time, as the streak counts days).
  const activity = useMemo(() => dayActivity(recent, localDate()), [recent]);
  const quests = useMemo(() => questsOf(activity), [activity]);
  const dailyMinutes = profile?.daily_minutes ?? 15;
  const goal = goalOf(activity.minutes, dailyMinutes);
  const focusNode =
    nodes.find((node) => node.state !== 'done' && (focus === 'all' || node.item.lesson.skill === focus)) ??
    nodes.find((node) => node.state !== 'done') ??
    null;

  const unitNodes = focusNode ? nodes.filter((node) => node.item.unit.id === focusNode.item.unit.id) : [];
  const unitDone = unitNodes.filter((node) => node.state === 'done').length;
  const skillTasks = (skill: Skill) =>
    nodes.filter((node) => !node.item.checkpoint && node.item.lesson.skill === skill && node.state !== 'done').length;

  const tiles: Array<{ key: string; label: string; count: number; color: string; image?: string; icon?: 'lang' | 'review'; to: string }> = [
    ...(['reading', 'listening', 'speaking', 'writing'] as const).map((skill) => ({
      key: skill,
      label: t(SKILL_LABEL[skill]),
      count: skillTasks(skill),
      color: TILE_COLORS[skill],
      image: SECTION_ICON[skill],
      to: `/study/${skill}`,
    })),
    {
      key: 'language',
      label: t('Language'),
      count: skillTasks('language'),
      color: TILE_COLORS.language,
      icon: 'lang',
      to: '/study/language',
    },
    { key: 'review', label: t('Daily review'), count: dueNow, color: '#4b5a7a', icon: 'review', to: '/review' },
  ];

  return (
    <div className="page">
      <PageHeader title={t("Today's learning")}>
      </PageHeader>

      <div className="stack">
        {loadError && <Notice tone="error">{t(loadError)}</Notice>}
        {banners.length > 0 && <BannerCarousel items={banners} />}

        {progress !== null && (
          <div className="grid-2 goal-row">
            <section className="card goal-card">
              <DailyGoal minutes={activity.minutes} goal={dailyMinutes} percent={goal.percent} done={goal.done} />
            </section>
            <section className="card goal-card">
              <QuestList quests={quests} />
            </section>
          </div>
        )}

        <div className="section-title">
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/roadmap')}>
            <MapIcon /> {t('Roadmap')}
          </button>
          <div className="section-title__aside">
            <Select<'all' | Skill>
              id="focus-select"
              label={t('Focus')}
              variant="line"
              value={focus}
              onChange={setFocus}
              options={[
                { value: 'all', label: t('Recommended for you') },
                { value: 'reading', label: t('Reading focus') },
                { value: 'listening', label: t('Listening focus') },
                { value: 'speaking', label: t('Speaking focus') },
                { value: 'writing', label: t('Writing focus') },
                { value: 'language', label: t('Language focus') },
              ]}
            />
          </div>
        </div>

        {progress === null ? (
          <div className="grid-2">
            <Skeleton height={96} />
            <Skeleton height={96} />
          </div>
        ) : (
          <div className="grid-2">
            {diagnostic && !reportHidden && (
              <div className="level-report">
                <FeatureCard
                  icon={<ScanSearch />}
                  title={t('Level report')}
                  meta={
                    profile?.goal === 'toefl' && diagnostic.predicted
                      ? t('Estimated TOEFL {score} of 120, range {range}', {
                          score: diagnostic.predicted,
                          range: toeflRange(diagnostic.predicted).join('–'),
                        })
                      : t('Your level is {level}', { level: bandFor(diagnostic.score_pct) })
                  }
                  onClick={() => navigate(`/report/${diagnostic.id}`)}
                  arrow={false}
                />
                <button
                  type="button"
                  className="level-report__remove"
                  onClick={removeReport}
                  aria-label={t('Remove it from Today for good')}
                  title={t('Remove it from Today for good')}
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            )}
            {!diagnostic && (
              <FeatureCard
                art={LEVEL_CHECK_ICON}
                title={t('Level check')}
                badge={<Badge tone="beta">{t('Beta')}</Badge>}
                meta={t('Find your level and the skills to work on, in about 15 minutes.')}
                onClick={() => navigate('/play/diagnostic')}
              />
            )}
          </div>
        )}

        {focusNode ? (
          <section className="hero" aria-label={t('Continue learning')}>
            <h2 className="hero__title">
              {focusNode.item.checkpoint
                ? t('Unit check: {title}', { title: t(focusNode.item.unit.title) })
                : t(focusNode.item.lesson.title)}
            </h2>
            <p className="hero__text">{t(focusNode.item.lesson.blurb)}</p>
            <p className="hero__meta">
              {t('Total time: {minutes} min', { minutes: focusNode.item.lesson.minutes })} ·{' '}
              {tn(
                '{count} question',
                '{count} questions',
                focusNode.item.lesson.questions.length,
                { count: focusNode.item.lesson.questions.length },
              )}
            </p>
            <div className="hero__progress">
              <div
                className="progress progress--on-blue"
                role="progressbar"
                aria-label={t('Unit progress')}
                aria-valuemin={0}
                aria-valuemax={unitNodes.length}
                aria-valuenow={unitDone}
              >
                <motion.div
                  className="progress__bar"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: unitNodes.length ? unitDone / unitNodes.length : 0 }}
                  transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>
              <span className="hero__count">
                {unitDone}/{unitNodes.length}
              </span>
            </div>
            <button className="btn btn--white btn--block hero__cta" onClick={() => navigate(`/play/lesson/${focusNode.item.lesson.id}`)}>
              {t('Continue learning')}
            </button>
          </section>
        ) : (
          <section className="hero" aria-label={t('Roadmap complete')}>
            <h2 className="hero__title">{t('Roadmap complete')}</h2>
            <p className="hero__text">{t('Every unit is finished. Take your level test to see where you stand now.')}</p>
            <button
              className="btn btn--white btn--block hero__cta"
              onClick={() => navigate(`/play/test/${levelTestId(profile?.level ?? 'B1')}`)}
            >
              {t('Start {level} level test', { level: profile?.level ?? 'B1' })}
            </button>
          </section>
        )}

        <div className="tiles">
          {tiles.map((tile) => {
            const Icon = tile.icon === 'lang' ? Languages : tile.icon === 'review' ? RotateCw : null;
            return (
              <button
                key={tile.key}
                className="tile"
                onClick={() => navigate(tile.to)}
                aria-label={t('{label}, {count} to do', { label: tile.label, count: tile.count })}
              >
                {Icon && (
                  <span className="tile__letter" style={{ background: tile.color }}>
                    <Icon size={16} aria-hidden="true" />
                  </span>
                )}
                <span>{tile.label}</span>
                <span className="tile__count">{tile.count}</span>
                {tile.image && <img className="tile__art" src={tile.image} alt="" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        {!aiReady && <Notice tone="info">{t('Connect an AI key in Settings to unlock generated practice sets and coach feedback.')}</Notice>}
      </div>

    </div>
  );
}
