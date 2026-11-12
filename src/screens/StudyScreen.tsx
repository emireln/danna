import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, GraduationCap, Languages, PenLine, Plus, Sparkles, Star } from 'lucide-react';
import { GenerateSheet } from '../components/GenerateSheet';
import { BackLink, Empty, FeatureCard, Notice, PageHeader, ProgressBar, SectionTitle, Skeleton, Tabs } from '../components/ui';
import { TOEFL_TEST_ID, levelTest, lessonsForSkill, toeflLessons, toeflTest, wordsTest } from '../content';
import { LEVELS } from '../lib/types';
import { SECTION_ART, SECTION_BASE } from '../lib/art';
import { errorText } from '../lib/bridge';
import { progressMap } from '../lib/roadmap';
import { plural } from '../lib/text';
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
  const { ready: aiReady } = useAI();
  const { profile } = useAppData();
  const { progress, tests, map, loadError } = useSelfStudyData();
  const [tab, setTab] = useState<'sections' | 'mock'>('sections');
  const [generating, setGenerating] = useState(false);
  const aiMocks = tests.filter((test) => test.skill === 'mixed');

  return (
    <div className="page">
      <PageHeader eyebrow="Practice on your own" title="Self study" />

      <div className="stack">
        {loadError && <Notice tone="error">{loadError}</Notice>}

        <div className="grid-3">
          <FeatureCard
            icon={<Languages />}
            title="Language"
            meta="Grammar, word order and vocabulary"
            onClick={() => navigate('/study/language')}
          />
          <FeatureCard icon={<PenLine />} title="Writing" meta="Essays, emails and reviews" onClick={() => navigate('/study/writing')} />
          <FeatureCard
            icon={<ClipboardCheck />}
            title="Level tests"
            meta="One test for each level, from A1 to C1"
            onClick={() => setTab('mock')}
          />
        </div>

        <FeatureCard
          icon={<GraduationCap />}
          title="TOEFL warm-up"
          meta="Optional. Academic reading, lectures, and speaking and writing tasks in the style of the test."
          onClick={() => navigate('/study/toefl')}
        />

        <Tabs
          label="Self study views"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'sections', label: 'Study by section' },
            { value: 'mock', label: 'Mock tests' },
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
                  const label = SKILL_LABEL[skill];
                  const extra = skill === 'writing' || skill === 'speaking' ? [aiReady ? 'AI feedback' : 'Self-rating'] : [];
                  const pills = [...SECTION_COPY[skill].pills, ...extra];
                  return (
                    <button
                      key={skill}
                      type="button"
                      className="section-card"
                      style={{ background: SECTION_BASE[skill] }}
                      onClick={() => navigate(`/study/${skill}`)}
                      aria-label={`${label}, ${completed} of ${plural(lessons.length, 'lesson')} complete`}
                    >
                      <span aria-hidden="true" className="section-card__art" style={{ backgroundImage: SECTION_ART[skill] }} />
                      <span className="section-card__kicker">{SECTION_COPY[skill].kicker}</span>
                      <span className="section-card__title">{label}</span>
                      <span className="section-card__stats">
                        {plural(lessons.length, 'lesson')} · {plural(questions, 'question')} · {completed} completed
                      </span>
                      <span className="section-card__pills">
                        {pills.map((pill) => (
                          <span key={pill} className="pill-light">
                            {pill}
                          </span>
                        ))}
                      </span>
                      <ProgressBar value={completed} max={Math.max(1, lessons.length)} onBlue label={`${label} progress`} />
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
                  <span className="set-row__title">{test.title}</span>
                  <span className="set-row__meta">
                    {plural(test.questions.length, 'question')} · {test.minutes} min · {test.subtitle}
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
                <span className="set-row__title">{TOEFL_TEST.title}</span>
                <span className="set-row__meta">
                  {plural(TOEFL_TEST.questions.length, 'question')} · {TOEFL_TEST.minutes} min · {TOEFL_TEST.subtitle}
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
                  <span className="set-row__title">{test.title}</span>
                  <span className="set-row__meta">
                    {plural(test.content.questions.length, 'question')} · {test.level} · {test.minutes} min
                  </span>
                </span>
                <ArrowRight className="muted" aria-hidden="true" />
              </button>
            ))}

            {aiReady ? (
              <div>
                <button className="btn btn--ghost" onClick={() => setGenerating(true)}>
                  <Plus /> Generate a mock test with AI
                </button>
              </div>
            ) : (
              <Notice tone="info">Connect an AI key in Settings to generate mock tests on your own topics.</Notice>
            )}
          </div>
        )}
      </div>

      {generating && (
        <GenerateSheet
          title="Generate a mock test"
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
  const { progress, map, loadError } = useSelfStudyData();
  const lessons = toeflLessons();
  const completed = lessons.filter((lesson) => (map.get(lesson.id)?.stars ?? 0) >= 1).length;

  return (
    <div className="page">
      <BackLink to="/study">Self study</BackLink>
      <PageHeader title="TOEFL warm-up">
        <p className="muted">Academic reading, lectures, and speaking and writing tasks in the style of the test.</p>
        <div className="mt-3">
          <ProgressBar value={completed} max={Math.max(1, lessons.length)} label="TOEFL warm-up progress" />
        </div>
        <p className="small muted mt-3">
          {completed} of {plural(lessons.length, 'lesson')} complete
        </p>
      </PageHeader>

      <button className="btn btn--primary btn--block mt-4" onClick={() => navigate(`/play/test/${TOEFL_TEST_ID}`)}>
        Take the TOEFL warm-up test
      </button>

      <SectionTitle title="Lessons" />
      {loadError && <Notice tone="error">{loadError}</Notice>}
      {progress === null ? (
        <Skeleton height={180} />
      ) : (
        <div className="set-list">
          {lessons.map((lesson) => {
            const stars = map.get(lesson.id)?.stars ?? 0;
            return (
              <button key={lesson.id} className="set-row" onClick={() => navigate(`/play/lesson/${lesson.id}`)}>
                <span className="set-row__body">
                  <span className="set-row__title">{lesson.title}</span>
                  <span className="set-row__meta">
                    {lesson.blurb} · {lesson.minutes} min
                  </span>
                </span>
                <span className="set-row__stars" role="img" aria-label={`${stars} of 3 stars`}>
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
        <BackLink to="/study">Self study</BackLink>
        <Empty title="This section does not exist">Pick a section from the self study page.</Empty>
      </div>
    );
  }

  const label = SKILL_LABEL[skill];
  const lessons = lessonsForSkill(skill);
  const completed = lessons.filter((lesson) => (map.get(lesson.id)?.stars ?? 0) >= 1).length;
  const sets = tests.filter((test) => test.skill === skill);

  return (
    <div className="page">
      <BackLink to="/study">Self study</BackLink>
      <PageHeader title={label}>
        <p className="muted">{SECTION_COPY[skill].kicker}</p>
        <div className="mt-3">
          <ProgressBar value={completed} max={Math.max(1, lessons.length)} label={`${label} progress`} />
        </div>
        <p className="small muted mt-3">
          {completed} of {plural(lessons.length, 'lesson')} complete
        </p>
      </PageHeader>

      <SectionTitle title="Lessons" />
      {loadError && <Notice tone="error">{loadError}</Notice>}
      {progress === null ? (
        <Skeleton height={180} />
      ) : (
        <div className="set-list">
          {lessons.map((lesson) => {
            const stars = map.get(lesson.id)?.stars ?? 0;
            return (
              <button key={lesson.id} className="set-row" onClick={() => navigate(`/play/lesson/${lesson.id}`)}>
                <span className="set-row__body">
                  <span className="set-row__title">{lesson.title}</span>
                  <span className="set-row__meta">
                    {lesson.blurb} · {lesson.minutes} min
                  </span>
                </span>
                <span className="set-row__stars" role="img" aria-label={`${stars} of 3 stars`}>
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

      <SectionTitle title="Your AI sets" />
      {sets.length === 0 ? (
        <Empty title="No sets yet">
          {aiReady ? 'Generated sets appear here. Create one on any topic.' : 'Connect an AI key in Settings to create sets on any topic.'}
        </Empty>
      ) : (
        <div className="set-list">
          {sets.map((test) => (
            <button key={test.id} className="set-row" onClick={() => navigate(`/play/test/${test.id}`)}>
              <span className="icon-tile icon-tile--sm">
                <Sparkles />
              </span>
              <span className="set-row__body">
                <span className="set-row__title">{test.title}</span>
                <span className="set-row__meta">
                  {plural(test.content.questions.length, 'question')} · {test.level} · {test.minutes} min
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
            <Plus /> Generate a {label.toLowerCase()} set
          </button>
        </div>
      )}

      {generating && (
        <GenerateSheet
          title={`New ${label.toLowerCase()} set`}
          defaultSkill={skill}
          defaultLevel={profile?.level ?? 'B1'}
          onClose={() => setGenerating(false)}
        />
      )}
    </div>
  );
}
