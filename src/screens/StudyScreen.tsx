import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, Sparkles, Star } from 'lucide-react';
import { GenerateSheet } from '../components/GenerateSheet';
import { Empty, Notice, ProgressBar, Skeleton } from '../components/ui';
import { lessonsForSkill, miniMock } from '../content';
import { useAI } from '../state/ai';
import { useAuth } from '../state/auth';
import { progressMap } from '../lib/roadmap';
import { useAppData } from '../state/appData';
import { SECTION_ART, SECTION_BASE } from '../lib/art';
import { SKILLS, SKILL_LABEL, type LessonProgressRow, type Skill, type TestRow } from '../lib/types';

// Each section card has its own artwork on a deep blue base (lib/art.ts).
const SECTION_ART_KEY: Record<Skill, string> = {
  reading: SECTION_ART.reading,
  listening: SECTION_ART.listening,
  writing: SECTION_ART.writing,
  speaking: SECTION_ART.speaking,
  language: SECTION_ART.writing,
};

const SECTION_BASE_BG: Record<Skill, string> = {
  reading: SECTION_BASE.reading,
  listening: SECTION_BASE.listening,
  writing: SECTION_BASE.writing,
  speaking: SECTION_BASE.speaking,
  language: SECTION_BASE.writing,
};

const SECTION_COPY: Record<Skill, { kicker: string; pills: string[] }> = {
  reading: { kicker: 'Find main ideas and make inferences', pills: ['Academic passages', 'Timed questions'] },
  listening: { kicker: 'Catch details in lectures and conversations', pills: ['Audio prompts', 'Unlimited replays'] },
  speaking: { kicker: 'Speak clearly and organise your answer', pills: ['Recording', 'Transcript feedback'] },
  writing: { kicker: 'Build a thesis and argue it well', pills: ['Word-count goals', 'Rubric scoring'] },
  language: { kicker: 'Word order, tenses and vocabulary', pills: ['Instant explanations', 'Spaced review'] },
};

function useSelfStudyData() {
  const { backend } = useAuth();
  const [progress, setProgress] = useState<LessonProgressRow[] | null>(null);
  const [tests, setTests] = useState<TestRow[]>([]);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    Promise.all([backend.listLessonProgress(), backend.listMyTests()])
      .then(([rows, mine]) => {
        if (!active) return;
        setProgress(rows);
        setTests(mine);
      })
      .catch((error: unknown) => console.error('Could not load self study', error));
    return () => {
      active = false;
    };
  }, [backend]);

  const map = useMemo(() => progressMap(progress ?? []), [progress]);
  return { progress, tests, map, backend };
}

export function StudyScreen() {
  const navigate = useNavigate();
  const { ready: aiReady } = useAI();
  const { profile } = useAppData();
  const { progress, tests, map } = useSelfStudyData();
  const [tab, setTab] = useState<'sections' | 'mock'>('sections');
  const [generating, setGenerating] = useState(false);
  const aiMocks = tests.filter((test) => test.skill === 'mixed');
  const sections: Array<Exclude<Skill, 'language'>> = ['reading', 'listening', 'writing', 'speaking'];

  return (
    <div className="canvas">
      <div className="page page--wide">
        <div className="quick-row">
          <button className="quick" onClick={() => navigate('/play/lesson/u1-l1')}>
            <span className="quick__kicker">Language</span>
            <span className="quick__title">Build a sentence</span>
          </button>
          <button className="quick" onClick={() => navigate('/play/lesson/u6-l3')}>
            <span className="quick__kicker">Writing</span>
            <span className="quick__title">Write an argument</span>
          </button>
          <button className="quick" onClick={() => navigate('/play/test/bundle-mini-mock')}>
            <span className="quick__kicker">Mock test</span>
            <span className="quick__title">Mini mock test 1</span>
          </button>
        </div>

        <div className="tabs" role="tablist" aria-label="Self study">
          <button role="tab" aria-selected={tab === 'sections'} className="tab" onClick={() => setTab('sections')}>
            Study by section
          </button>
          <button role="tab" aria-selected={tab === 'mock'} className="tab" onClick={() => setTab('mock')}>
            Mock test
          </button>
        </div>

        {tab === 'sections' && (
          <div className="section-grid">
            {progress === null &&
              sections.map((skill) => <Skeleton key={skill} height={196} />)}
            {progress !== null &&
              sections.map((skill) => {
                const lessons = lessonsForSkill(skill);
                const completed = lessons.filter((lesson) => (map.get(lesson.id)?.stars ?? 0) >= 1).length;
                const questions = lessons.reduce((sum, lesson) => sum + lesson.questions.length, 0);
                const art = SECTION_ART_KEY[skill];
                return (
                  <button
                    key={skill}
                    className="section-card"
                    style={{ background: SECTION_BASE_BG[skill] }}
                    onClick={() => navigate(`/study/${skill}`)}
                    aria-label={`${SKILL_LABEL[skill]}, ${completed} of ${lessons.length} lessons complete`}
                  >
                    <span
                      aria-hidden="true"
                      style={{ position: 'absolute', inset: 0, zIndex: -1, backgroundImage: art, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    />
                    <span className="section-card__kicker">{SECTION_COPY[skill].kicker}</span>
                    <span className="section-card__title" style={{ display: 'block' }}>
                      {SKILL_LABEL[skill]}
                    </span>
                    <span className="section-card__stats" style={{ display: 'block' }}>
                      {lessons.length} lessons · {questions} questions · {completed} completed
                    </span>
                    <span className="section-card__pills">
                      {SECTION_COPY[skill].pills.map((pill) => (
                        <span key={pill} className="pill-light">
                          {pill}
                        </span>
                      ))}
                      {skill === 'writing' || skill === 'speaking' ? (
                        <span className="pill-light">{aiReady ? 'AI feedback' : 'Self-rating'}</span>
                      ) : null}
                    </span>
                    <span style={{ position: 'absolute', left: 22, right: 22, bottom: 18 }}>
                      <ProgressBar value={completed} max={Math.max(1, lessons.length)} onBlue label={`${SKILL_LABEL[skill]} progress`} />
                    </span>
                  </button>
                );
              })}
          </div>
        )}

        {tab === 'mock' && (
          <div className="stack" style={{ marginTop: 18 }}>
            <button className="set-row" onClick={() => navigate('/play/test/bundle-mini-mock')}>
              <span className="icon-tile icon-tile--sm">
                <Star />
              </span>
              <span className="set-row__body">
                <span className="set-row__title" style={{ display: 'block' }}>
                  {miniMock().title}
                </span>
                <span className="set-row__meta" style={{ display: 'block' }}>
                  Reading, listening, speaking and writing · {miniMock().minutes} min
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
                  <span className="set-row__title" style={{ display: 'block' }}>
                    {test.title}
                  </span>
                  <span className="set-row__meta" style={{ display: 'block' }}>
                    {test.content.questions.length} questions · {test.level} · {test.minutes} min
                  </span>
                </span>
                <ArrowRight className="muted" aria-hidden="true" />
              </button>
            ))}

            {aiReady ? (
              <button className="btn btn--ghost" onClick={() => setGenerating(true)} style={{ alignSelf: 'flex-start' }}>
                <Plus /> Generate a mock test with AI
              </button>
            ) : (
              <Notice tone="info">Connect an AI key in Settings to generate full mock tests from your own topics.</Notice>
            )}
            {aiMocks.length === 0 && !aiReady && <span className="small muted">The bundled mini mock is ready to start now.</span>}
          </div>
        )}

        {generating && (
          <GenerateSheet
            title="Generate a mock test"
            defaultSkill="mixed"
            defaultLevel={profile?.level ?? 'B1'}
            onClose={() => setGenerating(false)}
          />
        )}
      </div>
    </div>
  );
}

export function StudySectionScreen() {
  const navigate = useNavigate();
  const { skill: raw } = useParams();
  const { ready: aiReady } = useAI();
  const { profile } = useAppData();
  const { progress, tests, map } = useSelfStudyData();
  const [generating, setGenerating] = useState(false);
  const skill = (SKILLS as readonly string[]).includes(raw ?? '') ? (raw as Skill) : null;

  if (!skill) {
    return (
      <div className="page">
        <Empty title="This section does not exist" action={<button className="btn btn--ghost" onClick={() => navigate('/study')}>Back to self study</button>} />
      </div>
    );
  }

  const lessons = lessonsForSkill(skill);
  const completed = lessons.filter((lesson) => (map.get(lesson.id)?.stars ?? 0) >= 1).length;
  const sets = tests.filter((test) => test.skill === skill);

  return (
    <div className="canvas">
      <div className="page">
        <button className="btn btn--text" onClick={() => navigate('/study')} style={{ marginBottom: 12 }}>
          <ArrowLeft /> Self study
        </button>
        <div className="page__head" style={{ alignItems: 'flex-end' }}>
          <div>
            <p className="eyebrow">{SECTION_COPY[skill].kicker}</p>
            <h1 style={{ marginTop: 4 }}>{SKILL_LABEL[skill]}</h1>
          </div>
          <span className="chip">
            {completed} of {lessons.length} complete
          </span>
        </div>
        <ProgressBar value={completed} max={Math.max(1, lessons.length)} label={`${SKILL_LABEL[skill]} progress`} />

        <h2 style={{ marginTop: 26, marginBottom: 12 }}>Lessons</h2>
        {progress === null ? (
          <Skeleton height={180} />
        ) : (
          <div className="set-list">
            {lessons.map((lesson) => {
              const stars = map.get(lesson.id)?.stars ?? 0;
              return (
                <button key={lesson.id} className="set-row" onClick={() => navigate(`/play/lesson/${lesson.id}`)}>
                  <span className="set-row__body">
                    <span className="set-row__title" style={{ display: 'block' }}>
                      {lesson.title}
                    </span>
                    <span className="set-row__meta" style={{ display: 'block' }}>
                      {lesson.blurb} · {lesson.minutes} min
                    </span>
                  </span>
                  <span className="row" aria-label={`${stars} of 3 stars`}>
                    {[1, 2, 3].map((value) => (
                      <Star key={value} size={16} fill={value <= stars ? 'var(--amber)' : 'none'} color={value <= stars ? 'var(--amber)' : '#cfd6e2'} />
                    ))}
                  </span>
                  <ArrowRight className="muted" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        )}

        <h2 style={{ marginTop: 30, marginBottom: 12 }}>Your AI sets</h2>
        {sets.length === 0 && (
          <Empty title="No generated sets yet" action={null}>
            {aiReady
              ? 'Generate a set on any topic. It is saved here and you can share it with friends.'
              : 'Connect an AI key in Settings to generate sets on any topic.'}
          </Empty>
        )}
        <div className="set-list" style={{ marginTop: sets.length ? 0 : 12 }}>
          {sets.map((test) => (
            <button key={test.id} className="set-row" onClick={() => navigate(`/play/test/${test.id}`)}>
              <span className="icon-tile icon-tile--sm">
                <Sparkles />
              </span>
              <span className="set-row__body">
                <span className="set-row__title" style={{ display: 'block' }}>
                  {test.title}
                </span>
                <span className="set-row__meta" style={{ display: 'block' }}>
                  {test.content.questions.length} questions · {test.level} · {test.minutes} min
                </span>
              </span>
              <ArrowRight className="muted" aria-hidden="true" />
            </button>
          ))}
        </div>
        {aiReady && (
          <button className="btn btn--ghost" style={{ marginTop: 16 }} onClick={() => setGenerating(true)}>
            <Plus /> Generate {SKILL_LABEL[skill].toLowerCase()} set with AI
          </button>
        )}

        {generating && (
          <GenerateSheet
            title={`New ${SKILL_LABEL[skill].toLowerCase()} set`}
            defaultSkill={skill}
            defaultLevel={profile?.level ?? 'B1'}
            onClose={() => setGenerating(false)}
          />
        )}
      </div>
    </div>
  );
}
