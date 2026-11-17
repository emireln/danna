import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { BackLink, Notice, PageHeader, SectionTitle, Spinner } from '../components/ui';
import { errorText } from '../lib/bridge';
import { tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { activeStreak, formatLongDate, levelInfo } from '../lib/progress';
import { overallReport, type SkillLine } from '../lib/overallReport';
import { downloadBlob, drawReportPicture, reportFileName } from '../lib/reportImage';
import { SKILL_LABEL, type AttemptRow, type LessonProgressRow } from '../lib/types';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useToast } from '../state/toast';

/** The overall report: the strengths, the weaknesses and the progress across the whole app, saved as an image. */
export function ProfileReportScreen() {
  const t = useT();
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
  const name = profile.display_name || profile.username;
  const streak = activeStreak(profile);
  const skillName = (line: SkillLine) => t(SKILL_LABEL[line.skill]);
  const notPractised = t('Not practised yet');
  const minutes = report.practiceMinutes;
  const scoreText = (line: SkillLine) => (line.score === null ? notPractised : `${line.score}%`);

  const stats = [
    { label: t('Level'), value: profile.level },
    { label: t('XP level'), value: String(levelInfo(profile.xp).level) },
    { label: t('Streak'), value: tn('{count} day', '{count} days', streak, { count: streak }) },
    { label: t('Sessions'), value: String(report.sessions) },
    { label: t('Practice time'), value: tn('{count} minute', '{count} minutes', minutes, { count: minutes }) },
    { label: t('Average score'), value: report.averageScore === null ? '—' : `${report.averageScore}%` },
    { label: t('Lessons done'), value: String(report.lessonsDone) },
    { label: t('Stars'), value: String(report.stars) },
  ];

  const strengths = report.strengths.map((line) => `${skillName(line)} · ${scoreText(line)}`);
  const weaknesses = report.weaknesses.map((line) => `${skillName(line)} · ${scoreText(line)}`);

  const saveImage = async () => {
    setSaving(true);
    try {
      const picture = await drawReportPicture({
        name,
        eyebrow: t('My report'),
        date: formatLongDate(new Date().toISOString()),
        stats,
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
    <div className="page">
      <BackLink to="/profile">{t('Profile')}</BackLink>
      <PageHeader eyebrow={t('Your report')} title={name}>
        <p className="muted">{t('Your strengths, weaknesses and progress, across the whole app.')}</p>
      </PageHeader>

      <div className="stack">
        {loadError && <Notice tone="error">{t(loadError)}</Notice>}

        <div className="report-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="report-stat">
              <span className="report-stat__label">{stat.label}</span>
              <span className="report-stat__value">{stat.value}</span>
            </div>
          ))}
        </div>

        <SectionTitle title={t('Skills')} />
        <div className="report-skills">
          {report.skills.map((line) => (
            <div key={line.skill} className="report-skill">
              <span className="report-skill__name">{skillName(line)}</span>
              <span className="report-skill__bar" aria-hidden="true">
                <span style={{ width: `${line.score ?? 0}%` }} />
              </span>
              <span className="report-skill__score">{scoreText(line)}</span>
            </div>
          ))}
        </div>

        <div className="grid-2">
          <div className="card">
            <h3>{t('Strengths')}</h3>
            {strengths.length === 0 ? (
              <p className="muted small">{t('Keep practising to find your strengths.')}</p>
            ) : (
              <ul className="report-list">
                {strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <h3>{t('Weaknesses')}</h3>
            {weaknesses.length === 0 ? (
              <p className="muted small">{t('No weak skill right now.')}</p>
            ) : (
              <ul className="report-list">
                {weaknesses.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <button className="btn btn--primary" onClick={() => void saveImage()} disabled={saving || attempts === null}>
            {saving ? <Spinner /> : <Download />} {t('Save as image')}
          </button>
        </div>
      </div>
    </div>
  );
}
