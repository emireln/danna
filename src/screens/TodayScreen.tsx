import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, GraduationCap, Languages, Map as MapIcon, RotateCw, ScanSearch } from 'lucide-react';
import { BannerCarousel } from '../components/Banner';
import { Badge, Field, FeatureCard, Notice, PageHeader, SectionTitle, Sheet, Skeleton, Spinner } from '../components/ui';
import { DateField, Select, todayIso } from '../components/Pickers';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { nodeStates, progressMap as indexProgress } from '../lib/roadmap';
import { daysUntil } from '../lib/progress';
import { bandFor, toeflRange } from '../lib/scoring';
import { SKILL_LABEL, type AttemptRow, type LessonProgressRow, type ReviewRow, type Skill } from '../lib/types';
import { useToast } from '../state/toast';
import { useAI } from '../state/ai';
import { errorText } from '../lib/bridge';
import { useLanguage, useT } from '../lib/i18n/react';
import { tn, type Lang } from '../lib/i18n';
import { levelTestId } from '../content';

const TILE_COLORS: Record<Skill, string> = {
  reading: '#17245c',
  listening: '#1f3a8a',
  speaking: '#2f6bff',
  writing: '#2a4fb8',
  language: '#0e7c6b',
};

// The letter on each skill tile: the first letter of the skill's name in the language the app is shown in.
const SKILL_LETTER: Record<Lang, Partial<Record<Skill, string>>> = {
  en: { reading: 'R', listening: 'L', speaking: 'S', writing: 'W' },
  pt: { reading: 'L', listening: 'C', speaking: 'F', writing: 'E' },
};

export function TodayScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { lang } = useLanguage();
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
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    // The newest level check, however many sessions have been done since.
    Promise.all([backend.listLessonProgress(), backend.listReviewItems(), backend.listAttempts(1, 'diagnostic')])
      .then(([rows, items, checks]) => {
        if (!active) return;
        setProgress(rows);
        setReviews(items);
        setDiagnostic(checks[0] ?? null);
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
      notify(dateDraft ? t('Exam date saved.') : t('Exam date removed.'), 'ok');
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setSaving(false);
    }
  };

  const tiles: Array<{ key: string; label: string; count: number; color: string; letter?: string; icon?: 'lang' | 'review'; to: string }> = [
    ...(['reading', 'listening', 'speaking', 'writing'] as Skill[]).map((skill) => ({
      key: skill,
      label: t(SKILL_LABEL[skill]),
      count: skillTasks(skill),
      color: TILE_COLORS[skill],
      letter: SKILL_LETTER[lang][skill],
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

  const goalText = profile?.goal === 'toefl' ? t('TOEFL warm-up, target {score}', { score: profile.target_score }) : t('General English');

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('Your plan')}
        title={t("Today's learning")}
        aside={
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/roadmap')}>
            <MapIcon /> {t('Roadmap')}
          </button>
        }
      >
        <p className="small muted">{t('Your plan updates after every session.')}</p>
      </PageHeader>

      <div className="stack">
        {loadError && <Notice tone="error">{t(loadError)}</Notice>}
        {banners.length > 0 && <BannerCarousel items={banners} />}

        <SectionTitle
          title={t('Your next step')}
          aside={
            <>
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
            </>
          }
        />

        {progress === null ? (
          <div className="grid-2">
            <Skeleton height={96} />
            <Skeleton height={96} />
          </div>
        ) : (
          <div className="grid-2">
            <FeatureCard
              muted
              icon={<GraduationCap />}
              title={t('Learning setup')}
              badge={<Badge tone="done">{t('Done')}</Badge>}
              meta={t('{goal} · {level} · {minutes} min a day', {
                goal: goalText,
                level: profile?.level ?? 'B1',
                minutes: profile?.daily_minutes ?? 15,
              })}
              onClick={() => navigate('/setup')}
            />
            {diagnostic ? (
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
              />
            ) : (
              <FeatureCard
                icon={<ScanSearch />}
                title={t('Level check')}
                badge={<Badge tone="beta">{t('Beta')}</Badge>}
                meta={t('Find your level and the skills to work on, in about 15 minutes.')}
                onClick={() => navigate('/play/diagnostic')}
              />
            )}
          </div>
        )}

        {focusNode ? (
          <motion.section
            className="hero"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            aria-label={t('Continue learning')}
          >
            <p className="eyebrow">
              {t('Unit {number} · {title}', { number: focusNode.item.unit.number, title: t(focusNode.item.unit.title) })}
            </p>
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
              {t('Continue learning')}
            </button>
          </motion.section>
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
          <span>{t('Days until exam')}</span>
          {daysLeft === null ? (
            <button
              className="btn btn--text strip__value"
              onClick={() => {
                setDateDraft('');
                setDateOpen(true);
              }}
            >
              {t('Set exam date')}
            </button>
          ) : (
            <button
              className="btn btn--text strip__value"
              onClick={() => {
                setDateDraft(profile?.exam_date ?? '');
                setDateOpen(true);
              }}
              aria-label={t('Change exam date')}
            >
              {daysLeft >= 0 ? t('D-{days}', { days: daysLeft }) : t('Exam passed')}
            </button>
          )}
        </div>

        {!aiReady && <Notice tone="info">{t('Connect an AI key in Settings to unlock generated practice sets and coach feedback.')}</Notice>}
      </div>

      {dateOpen && (
        <Sheet
          title={t('Exam date')}
          onClose={() => setDateOpen(false)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => setDateOpen(false)}>
                {t('Cancel')}
              </button>
              <button className="btn btn--primary" onClick={saveDate} disabled={saving}>
                {saving ? <Spinner /> : t('Save date')}
              </button>
            </>
          }
        >
          <Field label={t('Exam date')} hint={t('Leave it empty to hide the countdown.')}>
            <DateField label={t('Exam date')} value={dateDraft} onChange={setDateDraft} min={todayIso()} />
          </Field>
        </Sheet>
      )}
    </div>
  );
}
