import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, GraduationCap, Languages, Plus, Sparkles, Star } from 'lucide-react';
import { GenerateSheet } from '../components/GenerateSheet';
import { BackLink, Empty, FeatureCard, Notice, PageHeader, ProgressBar, SectionTitle, Skeleton, Tabs } from '../components/ui';
import { TOEFL_TEST_ID, levelTest, lessonsForSkill, toeflLessons, toeflTest, wordsTest } from '../content';
import { LEVELS } from '../lib/types';
import { SECTION_ART, SECTION_BASE } from '../lib/art';
import { errorText } from '../lib/bridge';
import { tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { progressMap } from '../lib/roadmap';
import { SKILLS, SKILL_LABEL, type LessonProgressRow, type Skill, type TestRow } from '../lib/types';
import { useAI } from '../state/ai';
import { useAppData } from '../state/appData';
import { useAuth } from '../state/auth';

// The four skills that get a section card. Language has its own card in the row above.
const CARD_SKILLS = ['reading', 'listening', 'writing', 'speaking'] as const;

const SECTION_COPY: Record<Skill, { kicker: string; pills: string[] }> = {
  reading: { kicker: 'Find main ideas and make inferences', pills: ['Academic passages', 'Timed questions'] },
  listening: { kicker: 'Catch details in lectures and conversations', pills: ['Audio prompts', 'Unlimited replays'] },
  speaking: { kicker: 'Speak clearly and organize your answer', pills: ['Recording', 'Transcript feedback'] },
  writing: { kicker: 'Build a thesis and argue it well', pills: ['Word-count goals', 'Rubric scoring'] },
  language: { kicker: 'Word order, tenses and vocabulary', pills: ['Instant explanations', 'Spaced review'] },
};

function useSelfStudyData() {
  const { backend } = useAuth();
  const [progress, setProgress] = useState<LessonProgressRow[] | null>(null);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    Promise.all([backend.listLessonProgress(), backend.listMyTests()])
      .then(([rows, mine]) => {
        if (!active) return;
        setProgress(rows);
        setTests(mine);
      })
      .catch((error: unknown) => {
        console.error('Could not load self study', error);
        if (!active) return;
        setProgress([]);
        setLoadError(errorText(error));
      });
    return () => {
      active = false;
    };
  }, [backend]);

  const map = useMemo(() => progressMap(progress ?? []), [progress]);
  return { progress, tests, map, loadError };
}

const LEVEL_TESTS = LEVELS.map((level) => levelTest(level));
const WORD_TESTS = LEVELS.map((level) => wordsTest(level));
const TOEFL_TEST = toeflTest();

export function StudyScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { ready: aiReady } = useAI();
  const { profile } = useAppData();
  const { progress, tests, map, loadError } = useSelfStudyData();
  const [tab, setTab] = useState<'sections' | 'mock'>('sections');
  const [generating, setGenerating] = useState(false);
  const aiMocks = tests.filter((test) => test.skill === 'mixed');

  return (
    <div className="page">
      <PageHeader eyebrow={t('Practice on your own')} title={t('Self study')} />

      <div className="stack">
        {loadError && <Notice tone="error">{t(loadError)}</Notice>}

        <div className="grid-2">
          <FeatureCard
            icon={<Languages />}
            title={t('Language')}
            meta={t('Grammar, word order and vocabulary')}
            onClick={() => navigate('/study/language')}
          />
          <FeatureCard
            icon={<ClipboardCheck />}
            title={t('Level tests')}
            meta={t('One test for each level, from A1 to C1')}
            onClick={() => setTab('mock')}
          />
        </div>

        <FeatureCard
          icon={<GraduationCap />}
          title={t('TOEFL warm-up')}
          meta={t('Optional. Academic reading, lectures, and speaking and writing tasks in the style of the test.')}
          onClick={() => navigate('/study/toefl')}
        />

        <Tabs
          label={t('Self study views')}
          value={tab}
          onChange={setTab}
          items={[
            { value: 'sections', label: t('Study by section') },
            { value: 'mock', label: t('Mock tests') },
          ]}
        />

        {tab === 'sections' && (
          <div className="section-grid">
            {progress === null
              ? CARD_SKILLS.map((skill) => <Skeleton key={skill} height={196} />)
              : CARD_SKILLS.map((skill) => {
                  const lessons = lessonsForSkill(skill);
                  const completed = lessons.filter((lesson) => (map.get(lesson.id)?.stars ?? 0) >= 1).length;
                  const questions = lessons.reduce((sum, lesson) => sum + lesson.questions.length, 0);
                  const label = t(SKILL_LABEL[skill]);
                  const extra = skill === 'writing' || skill === 'speaking' ? [aiReady ? t('AI feedback') : t('Self-rating')] : [];
                  const pills = [...SECTION_COPY[skill].pills.map((pill) => t(pill)), ...extra];
                  const lessonCount = tn('{count} lesson', '{count} lessons', lessons.length, { count: lessons.length });
                  return (
                    <button
                      key={skill}
                      type="button"
                      className="section-card"
                      style={{ background: SECTION_BASE[skill] }}
                      onClick={() => navigate(`/study/${skill}`)}
                      aria-label={t('{label}, {completed} of {total} complete', { label, completed, total: lessonCount })}
                    >
                      <span aria-hidden="true" className="section-card__art" style={{ backgroundImage: SECTION_ART[skill] }} />
                      <span className="section-card__kicker">{t(SECTION_COPY[skill].kicker)}</span>
                      <span className="section-card__title">{label}</span>
                      <span className="section-card__stats">
                        {t('{lessons} · {questions} · {completed} completed', {
                          lessons: lessonCount,
                          questions: tn('{count} question', '{count} questions', questions, { count: questions }),
                          completed,
                        })}
                      </span>
                      <span className="section-card__pills">
                        {pills.map((pill) => (
                          <span key={pill} className="pill-light">
                            {pill}
                          </span>
                        ))}
                      </span>
                      <ProgressBar value={completed} max={Math.max(1, lessons.length)} onBlue label={t('{label} progress', { label })} />
                    </button>
                  );
                })}
          </div>
        )}

        {tab === 'mock' && (
          <div className="stack">
            {[...LEVEL_TESTS, ...WORD_TESTS].map((test) => (
              <button key={test.id} className="set-row" onClick={() => navigate(`/play/test/${test.id}`)}>
                <span className="icon-tile icon-tile--sm">
                  <ClipboardCheck />
                </span>
                <span className="set-row__body">
                  <span className="set-row__title">{t(test.title)}</span>
                  <span className="set-row__meta">
                    {t('{questions} · {minutes} min · {subtitle}', {
                      questions: tn('{count} question', '{count} questions', test.questions.length, { count: test.questions.length }),
                      minutes: test.minutes,
                      subtitle: t(test.subtitle),
                    })}
                  </span>
                </span>
                <ArrowRight className="muted" aria-hidden="true" />
              </button>
            ))}

            <button className="set-row" onClick={() => navigate(`/play/test/${TOEFL_TEST.id}`)}>
              <span className="icon-tile icon-tile--sm">
                <ClipboardCheck />
              </span>
              <span className="set-row__body">
                <span className="set-row__title">{t(TOEFL_TEST.title)}</span>
                <span className="set-row__meta">
                  {t('{questions} · {minutes} min · {subtitle}', {
                    questions: tn('{count} question', '{count} questions', TOEFL_TEST.questions.length, { count: TOEFL_TEST.questions.length }),
                    minutes: TOEFL_TEST.minutes,
                    subtitle: t(TOEFL_TEST.subtitle),
                  })}
                </span>
              </span>
              <ArrowRight className="muted" aria-hidden="true" />
            </button>

            {aiMocks.map((test) => (
              <button key={test.id} className="set-row" onClick={() => navigate(`/play/test/${test.id}`)}>
                <span className="icon-tile icon-tile--sm">
                  <Sparkles />
                </span>
                <span className="set-row__body">
                  <span className="set-row__title">{t(test.title)}</span>
                  <span className="set-row__meta">
                    {t('{questions} · {level} · {minutes} min', {
                      questions: tn('{count} question', '{count} questions', test.content.questions.length, {
                        count: test.content.questions.length,
                      }),
                      level: test.level,
                      minutes: test.minutes,
                    })}
                  </span>
                </span>
                <ArrowRight className="muted" aria-hidden="true" />
              </button>
            ))}

            {aiReady ? (
              <div>
                <button className="btn btn--ghost" onClick={() => setGenerating(true)}>
                  <Plus /> {t('Generate a mock test with AI')}
                </button>
              </div>
            ) : (
              <Notice tone="info">{t('Connect an AI key in Settings to generate mock tests on your own topics.')}</Notice>
            )}
          </div>
        )}
      </div>

      {generating && (
        <GenerateSheet
          title={t('Generate a mock test')}
          defaultSkill="mixed"
          defaultLevel={profile?.level ?? 'B1'}
          onClose={() => setGenerating(false)}
        />
      )}
    </div>
  );
}

/** The optional TOEFL warm-up: its lessons and its test, laid out like the other sections. */
function ToeflSection() {
  const navigate = useNavigate();
  const t = useT();
  const { progress, map, loadError } = useSelfStudyData();
  const lessons = toeflLessons();
  const completed = lessons.filter((lesson) => (map.get(lesson.id)?.stars ?? 0) >= 1).length;

  return (
    <div className="page">
      <BackLink to="/study">{t('Self study')}</BackLink>
      <PageHeader title={t('TOEFL warm-up')}>
        <p className="muted">{t('Academic reading, lectures, and speaking and writing tasks in the style of the test.')}</p>
        <div className="mt-3">
          <ProgressBar value={completed} max={Math.max(1, lessons.length)} label={t('TOEFL warm-up progress')} />
        </div>
        <p className="small muted mt-3">
          {t('{completed} of {total} complete', {
            completed,
            total: tn('{count} lesson', '{count} lessons', lessons.length, { count: lessons.length }),
          })}
        </p>
      </PageHeader>

      <button className="btn btn--primary btn--block mt-4" onClick={() => navigate(`/play/test/${TOEFL_TEST_ID}`)}>
        {t('Take the TOEFL warm-up test')}
      </button>

      <SectionTitle title={t('Lessons')} />
      {loadError && <Notice tone="error">{t(loadError)}</Notice>}
      {progress === null ? (
        <Skeleton height={180} />
      ) : (
        <div className="set-list">
          {lessons.map((lesson) => {
            const stars = map.get(lesson.id)?.stars ?? 0;
            return (
              <button key={lesson.id} className="set-row" onClick={() => navigate(`/play/lesson/${lesson.id}`)}>
                <span className="set-row__body">
                  <span className="set-row__title">{t(lesson.title)}</span>
                  <span className="set-row__meta">
                    {t(lesson.blurb)} · {t('{minutes} min', { minutes: lesson.minutes })}
                  </span>
                </span>
                <span className="set-row__stars" role="img" aria-label={t('{stars} of 3 stars', { stars })}>
                  {[1, 2, 3].map((value) => (
                    <Star
                      key={value}
                      size={16}
                      aria-hidden="true"
                      className={value <= stars ? 'is-on' : undefined}
                      fill={value <= stars ? 'currentColor' : 'none'}
                    />
                  ))}
                </span>
                <ArrowRight className="muted" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function StudySectionScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { skill: raw } = useParams();
  const { ready: aiReady } = useAI();
  const { profile } = useAppData();
  const { progress, tests, map, loadError } = useSelfStudyData();
  const [generating, setGenerating] = useState(false);
  if (raw === 'toefl') return <ToeflSection />;
  const skill = (SKILLS as readonly string[]).includes(raw ?? '') ? (raw as Skill) : null;

  if (!skill) {
    return (
      <div className="page">
        <BackLink to="/study">{t('Self study')}</BackLink>
        <Empty title={t('This section does not exist')}>{t('Pick a section from the self study page.')}</Empty>
      </div>
    );
  }

  const label = t(SKILL_LABEL[skill]);
  const lessons = lessonsForSkill(skill);
  const completed = lessons.filter((lesson) => (map.get(lesson.id)?.stars ?? 0) >= 1).length;
  const sets = tests.filter((test) => test.skill === skill);
  const lowerLabel = label.toLowerCase();

  return (
    <div className="page">
      <BackLink to="/study">{t('Self study')}</BackLink>
      <PageHeader title={label}>
        <p className="muted">{t(SECTION_COPY[skill].kicker)}</p>
        <div className="mt-3">
          <ProgressBar value={completed} max={Math.max(1, lessons.length)} label={t('{label} progress', { label })} />
        </div>
        <p className="small muted mt-3">
          {t('{completed} of {total} complete', {
            completed,
            total: tn('{count} lesson', '{count} lessons', lessons.length, { count: lessons.length }),
          })}
        </p>
      </PageHeader>

      <SectionTitle title={t('Lessons')} />
      {loadError && <Notice tone="error">{t(loadError)}</Notice>}
      {progress === null ? (
        <Skeleton height={180} />
      ) : (
        <div className="set-list">
          {lessons.map((lesson) => {
            const stars = map.get(lesson.id)?.stars ?? 0;
            return (
              <button key={lesson.id} className="set-row" onClick={() => navigate(`/play/lesson/${lesson.id}`)}>
                <span className="set-row__body">
                  <span className="set-row__title">{t(lesson.title)}</span>
                  <span className="set-row__meta">
                    {t(lesson.blurb)} · {t('{minutes} min', { minutes: lesson.minutes })}
                  </span>
                </span>
                <span className="set-row__stars" role="img" aria-label={t('{stars} of 3 stars', { stars })}>
                  {[1, 2, 3].map((value) => (
                    <Star
                      key={value}
                      size={16}
                      aria-hidden="true"
                      className={value <= stars ? 'is-on' : undefined}
                      fill={value <= stars ? 'currentColor' : 'none'}
                    />
                  ))}
                </span>
                <ArrowRight className="muted" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      <SectionTitle title={t('Your AI sets')} />
      {sets.length === 0 ? (
        <Empty title={t('No sets yet')}>
          {aiReady
            ? t('Generated sets appear here. Create one on any topic.')
            : t('Connect an AI key in Settings to create sets on any topic.')}
        </Empty>
      ) : (
        <div className="set-list">
          {sets.map((test) => (
            <button key={test.id} className="set-row" onClick={() => navigate(`/play/test/${test.id}`)}>
              <span className="icon-tile icon-tile--sm">
                <Sparkles />
              </span>
              <span className="set-row__body">
                <span className="set-row__title">{t(test.title)}</span>
                <span className="set-row__meta">
                  {t('{questions} · {level} · {minutes} min', {
                    questions: tn('{count} question', '{count} questions', test.content.questions.length, {
                      count: test.content.questions.length,
                    }),
                    level: test.level,
                    minutes: test.minutes,
                  })}
                </span>
              </span>
              <ArrowRight className="muted" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {aiReady && (
        <div className="mt-4">
          <button className="btn btn--ghost" onClick={() => setGenerating(true)}>
            <Plus /> {t('Generate a {skill} set', { skill: lowerLabel })}
          </button>
        </div>
      )}

      {generating && (
        <GenerateSheet
          title={t('New {skill} set', { skill: lowerLabel })}
          defaultSkill={skill}
          defaultLevel={profile?.level ?? 'B1'}
          onClose={() => setGenerating(false)}
        />
      )}
    </div>
  );
}
