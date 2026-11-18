import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { ScoreReport, type ReportCard, type ReportPlanSlice, type ReportStat } from '../components/ScoreReport';
import { BackLink, Notice, Skeleton, Spinner } from '../components/ui';
import { errorText } from '../lib/bridge';
import { tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { activeStreak, formatLongDate, levelInfo } from '../lib/progress';
import { overallReport, type SkillLine } from '../lib/overallReport';
import { PLAN_COLORS, TIPS, adviceFor } from '../lib/reportText';
import { studyPlan } from '../lib/scoring';
import { downloadBlob, drawReportPicture, reportFileName } from '../lib/reportImage';
import { SKILLS, SKILL_LABEL, type AttemptRow, type LessonProgressRow } from '../lib/types';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useToast } from '../state/toast';

/** The profile report: the same score report as the level check, built from every skill across the whole app. */
export function ProfileReportScreen() {
  const t = useT();
  const navigate = useNavigate();
  const { backend } = useAuth();
  const { profile, skills } = useAppData();
  const { notify } = useToast();
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [lessons, setLessons] = useState<LessonProgressRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    Promise.all([backend.listAttempts(500), backend.listLessonProgress()])
      .then(([rows, progress]) => {
        if (!active) return;
        setAttempts(rows);
        setLessons(progress);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(errorText(error));
        setAttempts([]);
        setLessons([]);
      });
    return () => {
      active = false;
    };
  }, [backend]);

  const report = useMemo(
    () => overallReport({ skills, attempts: attempts ?? [], lessons: lessons ?? [] }),
    [skills, attempts, lessons],
  );

  if (!profile) return null;
  if (attempts === null) {
    return (
      <div className="page">
        <BackLink to="/profile">{t('Profile')}</BackLink>
        <Skeleton height={420} />
      </div>
    );
  }

  const name = profile.display_name || profile.username;
  const streak = activeStreak(profile);
  const minutes = report.practiceMinutes;
  const notPractised = t('Not practised yet');
  const skillName = (line: SkillLine) => t(SKILL_LABEL[line.skill]);
  const scoreText = (line: SkillLine) => (line.score === null ? notPractised : `${line.score}%`);
  const strengths = report.strengths.map((line) => `${skillName(line)} · ${scoreText(line)}`);
  const weaknesses = report.weaknesses.map((line) => `${skillName(line)} · ${scoreText(line)}`);

  // The overall score is the average of the skills practised so far, as on the level check report.
  const values = SKILLS.map((skill) => skills[skill]).filter((value): value is number => typeof value === 'number');
  const overall = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

  const stats: ReportStat[] = [
    { label: t('Day streak'), value: tn('{count} day', '{count} days', streak, { count: streak }) },
    { label: t('Total XP'), value: String(profile.xp) },
    { label: t('Sessions'), value: String(report.sessions) },
    { label: t('Practice time'), value: tn('{count} minute', '{count} minutes', minutes, { count: minutes }) },
  ];

  // The advice needs a practised skill. Until then, the report says how to begin.
  const written = values.length ? adviceFor(skills, overall, profile.level, null, t) : null;
  const advice = written
    ? { label: t('Your advice'), title: written.title, body: written.body }
    : {
        label: t('Your advice'),
        title: t('Start with one skill'),
        body: t('Practise any skill for a few minutes. Your advice and your plan appear here after your first session.'),
      };

  const cards: ReportCard[] = [...SKILLS]
    .sort((a, b) => (skills[a] ?? -1) - (skills[b] ?? -1))
    .map((skill) => ({ key: skill, name: t(SKILL_LABEL[skill]), score: skills[skill] ?? null, tip: t(TIPS[skill]) }));

  const planSlices = values.length ? studyPlan(skills) : [];
  const plan = planSlices.length
    ? {
        title: t("Today's learning plan"),
        description: t('Boost your skills in {minutes} minutes a day with questions picked for your weakest areas.', {
          minutes: profile.daily_minutes,
        }),
        slices: planSlices.map(
          (slice, index): ReportPlanSlice => ({ key: slice.key, label: t(slice.label), percent: slice.percent, color: PLAN_COLORS[index] }),
        ),
        startLabel: t("Start today's plan"),
        onStart: () => navigate(planSlices[0].key === 'other' ? '/study' : `/study/${planSlices[0].key}`),
      }
    : null;

  // The picture saved from this report keeps the older list of numbers, with the strengths and the weaknesses.
  const imageStats = [
    { label: t('Level'), value: profile.level },
    { label: t('XP level'), value: String(levelInfo(profile.xp).level) },
    { label: t('Streak'), value: tn('{count} day', '{count} days', streak, { count: streak }) },
    { label: t('Sessions'), value: String(report.sessions) },
    { label: t('Practice time'), value: tn('{count} minute', '{count} minutes', minutes, { count: minutes }) },
    { label: t('Average score'), value: report.averageScore === null ? '—' : `${report.averageScore}%` },
    { label: t('Lessons done'), value: String(report.lessonsDone) },
    { label: t('Stars'), value: String(report.stars) },
  ];

  const saveImage = async () => {
    setSaving(true);
    try {
      const picture = await drawReportPicture({
        name,
        eyebrow: t('My report'),
        date: formatLongDate(new Date().toISOString()),
        stats: imageStats,
        skillsTitle: t('Skills'),
        skills: report.skills.map((line) => ({ label: skillName(line), score: line.score, notPractised })),
        strengthsTitle: t('Strengths'),
        strengths,
        noStrengths: t('Keep practising to find your strengths.'),
        weaknessesTitle: t('Weaknesses'),
        weaknesses,
        noWeaknesses: t('No weak skill right now.'),
        footer: t('Scores are practice estimates, not official results.'),
      });
      downloadBlob(picture, reportFileName(name));
      notify(t('Your report was saved as an image.'), 'ok');
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page">
        <BackLink to="/profile">{t('Profile')}</BackLink>
        {loadError && <Notice tone="error">{t(loadError)}</Notice>}
      </div>
      <ScoreReport
        eyebrow={formatLongDate(new Date().toISOString())}
        title={t('Score report')}
        sub={t('Your level is {level}', { level: profile.level })}
        pill={t('Overall')}
        gauge={{
          value: overall,
          max: 100,
          range: values.length ? t('{percent}% on average', { percent: overall }) : t('No score yet'),
        }}
        stats={stats}
        advice={advice}
        radar={{
          title: t('Your skill profile'),
          axes: SKILLS.map((skill) => ({ label: t(SKILL_LABEL[skill]), value: skills[skill] ?? 0 })),
          youLabel: t('You'),
        }}
        cardsTitle={t('Skills to improve your score')}
        cards={cards}
        plan={plan}
        actions={
          <button className="btn btn--ghost" onClick={() => void saveImage()} disabled={saving}>
            {saving ? <Spinner /> : <Download />} {t('Save as image')}
          </button>
        }
      />
    </div>
  );
}
