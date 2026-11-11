import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, Star, X } from 'lucide-react';
import { QuestionView, type ItemState } from '../components/Question';
import { CountUp } from '../components/charts';
import { ConfirmSheet, Notice, ProgressBar, Spinner, formatClock } from '../components/ui';
import { bundledTest, diagnosticTest } from '../content';
import { errorText } from '../lib/bridge';
import { gradeChoice, gradeCloze, gradeReorder, shuffleWords } from '../lib/grading';
import { nextStreak, localDate } from '../lib/progress';
import { plural } from '../lib/text';
import { isReviewable, newReviewItem, scheduleReview } from '../lib/srs';
import { overallPercent, skillPercents, starsFor, toeflEstimate, XP, type SkillMap } from '../lib/scoring';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useToast } from '../state/toast';
import {
  SKILL_LABEL,
  SKILLS,
  type AnswerRecord,
  type AttemptKind,
  type Passage,
  type Question,
  type ReviewRow,
  type TestDef,
} from '../lib/types';

interface Summary {
  kind: TestDef['kind'];
  title: string;
  pct: number;
  predicted: number | null;
  skills: SkillMap;
  correct: number;
  total: number;
  stars: number;
  xp: number;
  attemptId: string | null;
}

function uniquePassages(rows: ReviewRow[]): Passage[] {
  const found = new Map<string, Passage>();
  for (const row of rows) {
    if (row.payload.passage) found.set(row.payload.passage.id, row.payload.passage);
  }
  return [...found.values()];
}

function wordsFor(question: Question): string[] {
  return question.type === 'reorder' ? shuffleWords(question.answer, question.id) : [];
}

function isObjective(question: Question): boolean {
  return question.type === 'choice' || question.type === 'cloze' || question.type === 'reorder';
}

function isAnswered(question: Question, state: ItemState, words: string[]): boolean {
  switch (question.type) {
    case 'choice':
      return typeof state.choice === 'number';
    case 'cloze':
      return (state.cloze ?? []).some((value) => value.length > 0);
    case 'reorder':
      return (state.order ?? []).length === words.length && words.length > 0;
    case 'writing':
      return (state.text ?? '').trim().length > 0 && (state.feedback !== undefined || state.selfScore !== undefined);
    case 'speaking':
      return state.feedback !== undefined || state.selfScore !== undefined;
  }
}

function recordFor(question: Question, state: ItemState, words: string[]): { record: AnswerRecord; blanks?: boolean[] } {
  switch (question.type) {
    case 'choice': {
      const fraction = gradeChoice(question, state.choice ?? null);
      return { record: { id: question.id, skill: question.skill, fraction, response: state.choice ?? null } };
    }
    case 'cloze': {
      const response = state.cloze ?? [];
      const graded = gradeCloze(question, response);
      return { record: { id: question.id, skill: question.skill, fraction: graded.fraction, response }, blanks: graded.correct };
    }
    case 'reorder': {
      const response = (state.order ?? []).map((index) => words[index]);
      return {
        record: { id: question.id, skill: question.skill, fraction: gradeReorder(question, response), response: response.join(' ') },
      };
    }
    case 'writing': {
      const score = state.feedback?.score ?? state.selfScore ?? 0;
      return { record: { id: question.id, skill: question.skill, fraction: score / 5, response: state.text ?? '' } };
    }
    case 'speaking': {
      const score = state.feedback?.score ?? state.selfScore ?? 0;
      return { record: { id: question.id, skill: question.skill, fraction: score / 5, response: state.transcript ?? '[recording]' } };
    }
  }
}

function exitPath(kind: TestDef['kind'] | undefined, isReview: boolean): string {
  if (isReview || kind === 'review') return '/review';
  if (kind === 'lesson' || kind === 'checkpoint') return '/roadmap';
  if (kind === 'diagnostic') return '/';
  return '/study';
}

export function RunnerScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { backend } = useAuth();
  const { profile, patchProfile, skills: currentSkills, reloadSkills } = useAppData();
  const { notify } = useToast();
  const isReview = location.pathname === '/play/review';
  const isDiagnostic = location.pathname === '/play/diagnostic' || params.kind === 'diagnostic';

  const [test, setTest] = useState<TestDef | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [items, setItems] = useState<Record<string, ItemState>>({});
  const [results, setResults] = useState<Record<string, AnswerRecord>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [blankMarks, setBlankMarks] = useState<Record<string, boolean[]>>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let active = true;
    setTest(null);
    setLoadError(null);
    setSummary(null);
    setIndex(0);
    setItems({});
    setResults({});
    setRevealed({});
    setBlankMarks({});
    startedAt.current = Date.now();

    const load = async (): Promise<TestDef> => {
      if (!backend) throw new Error('Sign in to start a session.');
      if (isReview) {
        const now = Date.now();
        const rows = (await backend.listReviewItems())
          .filter((row) => new Date(row.due_at).getTime() <= now)
          .sort((a, b) => a.due_at.localeCompare(b.due_at))
          .slice(0, 20);
        if (rows.length === 0) throw new Error('Nothing is due right now. Come back after your next lesson.');
        return {
          id: 'review',
          title: 'Daily review',
          subtitle: `${plural(rows.length, 'question')} due`,
          kind: 'review',
          skill: 'mixed',
          minutes: Math.max(2, rows.length),
          passages: uniquePassages(rows),
          questions: rows.map((row) => ({ ...row.payload.question, id: row.item_key })),
        };
      }
      if (isDiagnostic) return diagnosticTest();
      const bundled = bundledTest(params.id ?? '');
      if (bundled) return bundled;
      if (params.kind === 'test') {
        const row = await backend.getTest(params.id ?? '');
        if (!row) throw new Error('This set could not be found. It may have been removed.');
        return {
          id: row.id,
          title: row.title,
          subtitle: row.description || `${row.level} · ${plural(row.content.questions.length, 'question')}`,
          kind: 'practice',
          skill: row.skill,
          minutes: row.minutes,
          passages: row.content.passages,
          questions: row.content.questions,
        };
      }
      throw new Error('This lesson could not be found.');
    };

    load()
      .then((loaded) => {
        if (active) setTest(loaded);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorText(error));
      });
    return () => {
      active = false;
    };
  }, [backend, isReview, isDiagnostic, params.kind, params.id]);

  const learn = test !== null && (test.kind === 'lesson' || test.kind === 'checkpoint' || test.kind === 'review' || test.kind === 'practice');
  const questions = test?.questions ?? [];
  const total = questions.length;
  const question = questions[index] ?? null;
  const state: ItemState = question ? items[question.id] ?? {} : {};
  const words = useMemo(() => (question ? wordsFor(question) : []), [question]);
  const passage = question?.passageId && test ? test.passages.find((item) => item.id === question.passageId) : undefined;
  const checked = question ? Boolean(revealed[question.id]) : false;
  const answerable = question ? isAnswered(question, state, words) : false;
  const isLast = index >= total - 1;

  useEffect(() => {
    if (summary) return undefined;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [summary]);

  const update = (patch: ItemState) => {
    if (!question) return;
    setItems((previous) => ({ ...previous, [question.id]: { ...previous[question.id], ...patch } }));
  };

  const finish = async (finalResults: Record<string, AnswerRecord>) => {
    if (!test || !backend || !profile) return;
    setSaving(true);
    setSaveError(null);
    try {
      const answers = test.questions.map((item) => finalResults[item.id]).filter((item): item is AnswerRecord => Boolean(item));
      const skills = skillPercents(answers);
      const pct = overallPercent(skills);
      const correct = answers.filter((answer) => answer.fraction >= 1).length;
      const duration = Math.round((Date.now() - startedAt.current) / 1000);
      const predicted = test.kind === 'diagnostic' || test.kind === 'mock' ? toeflEstimate(pct) : null;
      const bonus =
        test.kind === 'diagnostic' ? XP.diagnostic : test.kind === 'checkpoint' ? XP.checkpoint : test.kind === 'lesson' ? XP.lesson : 0;
      const xp = correct * (isReview ? XP.review : XP.correct) + answers.length * XP.attempt + bonus;

      let attemptId: string | null = null;
      if (!isReview) {
        const kind: AttemptKind =
          test.kind === 'diagnostic' ? 'diagnostic' : test.kind === 'mock' ? 'mock' : test.kind === 'checkpoint' ? 'checkpoint' : test.kind === 'lesson' ? 'lesson' : 'practice';
        const attempt = await backend.insertAttempt({
          kind,
          ref_id: test.id,
          title: test.title,
          score_pct: pct,
          predicted,
          skills,
          answers,
          duration_s: duration,
        });
        attemptId = attempt.id;
      }

      if (test.kind === 'diagnostic') {
        await backend.setSkillScores(skills);
      } else if (!isReview && Object.keys(skills).length > 0) {
        const merged: SkillMap = {};
        for (const skill of SKILLS) {
          const fresh = skills[skill];
          const previous = currentSkills[skill];
          if (fresh === undefined) continue;
          merged[skill] = previous === undefined ? fresh : Math.round(previous * 0.7 + fresh * 0.3);
        }
        await backend.setSkillScores(merged);
      }
      if (!isReview) await reloadSkills();

      if (test.kind === 'lesson' || test.kind === 'checkpoint') {
        const rows = await backend.listLessonProgress();
        const previous = rows.find((row) => row.lesson_id === test.id);
        const stars = starsFor(pct);
        await backend.upsertLessonProgress({
          lesson_id: test.id,
          stars: Math.max(previous?.stars ?? 0, stars),
          best_pct: Math.max(previous?.best_pct ?? 0, pct),
          attempts: (previous?.attempts ?? 0) + 1,
          completed_at: stars >= 1 ? (previous?.completed_at ?? new Date().toISOString()) : (previous?.completed_at ?? null),
        });
      }

      const existing = await backend.listReviewItems();
      const byKey = new Map(existing.map((row) => [row.item_key, row]));
      const updates: ReviewRow[] = [];
      for (const item of test.questions) {
        if (!isReviewable(item)) continue;
        const answer = finalResults[item.id];
        if (!answer) continue;
        const correctAnswer = answer.fraction >= 1;
        if (isReview) {
          const row = byKey.get(item.id);
          if (row) updates.push(scheduleReview(row, correctAnswer));
        } else if (!correctAnswer) {
          const key = `${test.id}:${item.id}`;
          const row = byKey.get(key);
          const passageForItem = item.passageId ? test.passages.find((entry) => entry.id === item.passageId) : undefined;
          const payload = { question: item, passage: passageForItem };
          updates.push(row ? scheduleReview(row, false) : newReviewItem(key, item.skill, payload));
        }
      }
      if (updates.length > 0) await backend.upsertReviewItems(updates);

      const today = localDate();
      await patchProfile({
        xp: profile.xp + xp,
        streak: nextStreak(profile.last_active, profile.streak, today),
        last_active: today,
      });

      setSummary({
        kind: test.kind,
        title: test.title,
        pct,
        predicted,
        skills,
        correct,
        total: answers.length,
        stars: starsFor(pct),
        xp,
        attemptId,
      });
    } catch (error) {
      setSaveError(errorText(error));
      notify('We could not save your progress. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const advance = (current: Record<string, AnswerRecord>) => {
    if (index + 1 < total) {
      setIndex((value) => value + 1);
      return;
    }
    void finish(current);
  };

  const primary = () => {
    if (!question || !test || !answerable || saving) return;
    if (!results[question.id]) {
      const { record, blanks } = recordFor(question, state, words);
      setResults((previous) => ({ ...previous, [question.id]: record }));
      if (blanks) setBlankMarks((previous) => ({ ...previous, [question.id]: blanks }));
      if (learn && isObjective(question)) {
        setRevealed((previous) => ({ ...previous, [question.id]: true }));
        return;
      }
      advance({ ...results, [question.id]: record });
      return;
    }
    advance(results);
  };

  const primaryRef = useRef(primary);
  primaryRef.current = primary;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT';
      if (event.key === 'Enter' && !event.shiftKey && !(typing && target?.tagName === 'TEXTAREA')) {
        primaryRef.current();
      }
      if (!typing && question?.type === 'choice' && !checked && /^[1-4]$/.test(event.key)) {
        const option = Number(event.key) - 1;
        if (option < question.options.length) update({ choice: option });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const exit = () => {
    const answered = Object.keys(results).length;
    if (!summary && answered > 0) {
      setConfirmLeave(true);
      return;
    }
    navigate(exitPath(test?.kind, isReview));
  };

  if (loadError) {
    return (
      <div className="runner">
        <div className="runner__top">
          <button className="btn btn--icon" onClick={() => navigate('/')} aria-label="Back">
            <X />
          </button>
        </div>
        <div className="runner__body">
          <div className="runner__inner">
            <Notice tone="error">{loadError}</Notice>
            <div>
              <button className="btn btn--ghost" onClick={() => navigate('/')}>
                Back to today
              </button>
            </div>
          </div>
        </div>
        <div />
      </div>
    );
  }

  if (!test) {
    return (
      <div className="auth" role="status">
        <Spinner dark />
        <span className="sr-only">Loading session</span>
      </div>
    );
  }

  if (summary) {
    return <Completion summary={summary} onExit={() => navigate(exitPath(summary.kind, isReview))} />;
  }

  const correctBlanks = question && checked ? blankMarks[question.id] : undefined;
  const correctNow = question && results[question.id] ? results[question.id].fraction : null;
  const feedbackText =
    question && checked && correctNow !== null
      ? correctNow >= 1
        ? 'Correct. Nice work.'
        : correctNow > 0
          ? 'Partly right. Look at the explanation.'
          : 'Not quite. Read the explanation, then continue.'
      : question && results[question.id] && !checked
        ? 'Answer saved.'
        : null;
  const label = !question
    ? 'Finish'
    : results[question.id]
      ? isLast
        ? 'Finish'
        : 'Continue'
      : learn && isObjective(question)
        ? 'Check'
        : isLast
          ? 'Finish'
          : 'Next';

  return (
    <div className="runner">
      <div className="runner__top">
        <button className="btn btn--icon" onClick={exit} aria-label="Leave session">
          <X />
        </button>
        <span className="runner__title">{test.title}</span>
        <span className="runner__timer">{formatClock(elapsed)}</span>
      </div>
      <div className="runner__progress">
        <ProgressBar value={index} max={Math.max(1, total)} label="Progress" />
      </div>

      <div className="runner__body">
        <AnimatePresence mode="wait" initial={false}>
          {question && (
            <motion.div
              key={question.id}
              className="runner__inner"
              initial={{ opacity: 0, x: 22 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -22 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <span className="small muted runner__count">
                Question {index + 1} of {total} · {SKILL_LABEL[question.skill]}
              </span>
              <QuestionView
                question={question}
                passage={passage}
                state={state}
                reveal={checked}
                locked={checked || saving}
                words={words}
                correctBlanks={correctBlanks}
                onChange={update}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="runner__foot">
        <div className="runner__foot-status" aria-live="polite">
          {saveError ? (
            <span className="text-red">{saveError}</span>
          ) : feedbackText ? (
            <span style={{ color: correctNow !== null && correctNow >= 1 ? 'var(--green)' : correctNow && correctNow > 0 ? '#b7791f' : checked ? 'var(--red)' : 'var(--ink-2)' }}>
              {feedbackText}
            </span>
          ) : (
            <span className="muted small">{learn ? 'Answer, then check.' : 'Answer each question. Feedback comes at the end.'}</span>
          )}
        </div>
        <button className="btn btn--primary" onClick={primary} disabled={!answerable || saving}>
          {saving ? <Spinner /> : null}
          {label}
          {!saving && (label === 'Check' ? <Check /> : <ArrowRight />)}
        </button>
      </div>
      {confirmLeave && (
        <ConfirmSheet
          title="Leave this session?"
          confirmLabel="Leave"
          onConfirm={() => navigate(exitPath(test?.kind, isReview))}
          onClose={() => setConfirmLeave(false)}
        >
          Answers you have not finished will not be saved.
        </ConfirmSheet>
      )}
    </div>
  );
}

function Completion({ summary, onExit }: { summary: Summary; onExit: () => void }) {
  const navigate = useNavigate();
  const isLesson = summary.kind === 'lesson' || summary.kind === 'checkpoint';
  const isDiagnostic = summary.kind === 'diagnostic';
  const headline = isDiagnostic ? 'Your estimate is ready' : isLesson ? (summary.stars ? 'Lesson complete' : 'Keep practicing') : 'Session complete';
  const score = isDiagnostic && summary.predicted !== null ? summary.predicted : summary.pct;
  const suffix = isDiagnostic && summary.predicted !== null ? ' / 120' : '%';

  return (
    <div className="runner">
      <div className="runner__top">
        <span className="runner__title">{summary.title}</span>
      </div>
      <div className="runner__progress">
        <ProgressBar value={100} max={100} />
      </div>
      <div className="runner__body">
        <motion.div className="runner__inner completion" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <span className="eyebrow">{headline}</span>
          <div className="completion__score" aria-live="polite">
            <CountUp to={score} />
            {suffix}
          </div>
          {isLesson && (
            <div className="stars" aria-label={`${summary.stars} of 3 stars`}>
              {[1, 2, 3].map((value) => (
                <motion.span
                  key={value}
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.25 + value * 0.15, type: 'spring', stiffness: 260, damping: 14 }}
                  className={value <= summary.stars ? '' : 'is-off'}
                >
                  <Star fill={value <= summary.stars ? 'currentColor' : 'none'} />
                </motion.span>
              ))}
            </div>
          )}
          <p className="muted">
            +{summary.xp} XP · {summary.correct} of {summary.total} correct
          </p>
          {Object.keys(summary.skills).length > 0 && (
            <div className="skill-summary">
              {SKILLS.filter((skill) => summary.skills[skill] !== undefined).map((skill) => (
                <div key={skill} className="plan__row">
                  <span className="skill-summary__name">{SKILL_LABEL[skill]}</span>
                  <div className="progress skill-summary__bar">
                    <motion.div
                      className="progress__bar"
                      initial={{ width: 0 }}
                      animate={{ width: `${summary.skills[skill]}%` }}
                      transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
                    />
                  </div>
                  <span>{summary.skills[skill]}</span>
                </div>
              ))}
            </div>
          )}
          <div className="row row--wrap row--center">
            {isDiagnostic && summary.attemptId && (
              <button className="btn btn--primary" onClick={() => navigate(`/report/${summary.attemptId}`)}>
                See my report <ArrowRight />
              </button>
            )}
            <button className={isDiagnostic ? 'btn btn--ghost' : 'btn btn--primary'} onClick={onExit}>
              {summary.kind === 'lesson' || summary.kind === 'checkpoint' ? 'Back to roadmap' : summary.kind === 'review' ? 'Back to review' : 'Done'}
            </button>
          </div>
        </motion.div>
      </div>
      <div />
    </div>
  );
}
