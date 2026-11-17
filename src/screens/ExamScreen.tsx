import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, GraduationCap, ScanSearch } from 'lucide-react';
import { DateField, todayIso } from '../components/Pickers';
import { BackLink, Field, FeatureCard, Notice, PageHeader, SectionTitle, Skeleton, Spinner } from '../components/ui';
import { TOEFL_TEST_ID, levelTest, levelTestId, skillTestId } from '../content';
import { errorText } from '../lib/bridge';
import { cleanExamName } from '../lib/data/rules';
import { examDateText, examSkills, latestSkillScore } from '../lib/exam';
import { tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { daysUntil } from '../lib/progress';
import { SKILL_LABEL, type AttemptRow } from '../lib/types';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useToast } from '../state/toast';

/** The exam: its name and date, how many days are left, the skills it asks for, and the checks that test them. */
export function ExamScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { backend } = useAuth();
  const { profile, patchProfile } = useAppData();
  const { notify } = useToast();
  const toefl = profile?.goal === 'toefl';
  const level = profile?.level ?? 'B1';
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [diagnostic, setDiagnostic] = useState<AttemptRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState(profile?.exam_name ?? '');
  const [date, setDate] = useState(profile?.exam_date ?? '');
  const [score, setScore] = useState(String(profile?.target_score ?? 100));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    Promise.all([backend.listAttempts(60), backend.listAttempts(1, 'diagnostic')])
      .then(([rows, checks]) => {
        if (!active) return;
        setAttempts(rows);
        setDiagnostic(checks[0] ?? null);
      })
      .catch((error: unknown) => {
        console.error('Could not load your results', error);
        if (!active) return;
        setAttempts([]);
        setLoadError(errorText(error));
      });
    return () => {
      active = false;
    };
  }, [backend]);

  const daysLeft = daysUntil(profile?.exam_date ?? null);
  const savedDate = profile?.exam_date ?? null;
  const summary =
    daysLeft === null || savedDate === null
      ? { title: t('No exam date yet'), text: t('Save the date below to see how many days are left.') }
      : daysLeft > 0
        ? { title: tn('{count} day left', '{count} days left', daysLeft, { count: daysLeft }), text: examDateText(savedDate) }
        : daysLeft === 0
          ? { title: t('The exam is today.'), text: examDateText(savedDate) }
          : { title: t('The date has passed.'), text: t('Save the next date below when you are ready.') };

  const paused = Boolean(profile?.exam_paused);
  const setPaused = async (next: boolean) => {
    setSaving(true);
    try {
      await patchProfile({ exam_paused: next });
      notify(next ? t('Exam paused. Your name and date are kept.') : t('Your exam is planned again.'), 'ok');
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await patchProfile({
        exam_name: cleanExamName(name),
        exam_date: date || null,
        // The target score is a TOEFL number only; general English keeps the score it had.
        ...(toefl ? { target_score: Number(score) || profile?.target_score || 100 } : {}),
      });
      notify(t('Your exam is saved.'), 'ok');
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <BackLink to="/">{t('Today')}</BackLink>
      <PageHeader eyebrow={t('Your exam')} title={profile?.exam_name || t('Your exam')}>
        <p className="muted">{t('Save the date, see how many days are left, and test the skills the exam asks for.')}</p>
      </PageHeader>

      <div className="stack">
        {loadError && <Notice tone="error">{t(loadError)}</Notice>}

        <section className="hero" aria-label={t('Days left')}>
          <p className="eyebrow">{profile?.exam_name || t('No exam named yet')}</p>
          <h2 className="hero__title">{paused ? t('Exam paused') : summary.title}</h2>
          <p className="hero__text">{paused ? t('You are not planning an exam for now. Your name and date are kept.') : summary.text}</p>
        </section>

        <div>
          <button className="btn btn--ghost" onClick={() => void setPaused(!paused)} disabled={saving}>
            {paused ? t('Plan the exam again') : t('Not planning an exam for now')}
          </button>
        </div>

        <SectionTitle title={t('Exam details')} />
        <Field label={t('Exam name')} hint={t('For example TOEFL iBT, IELTS, or a school exam.')}>
          <input
            className="input"
            value={name}
            maxLength={80}
            placeholder={t('Name of the exam')}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label={t('Exam date')} hint={t('Leave it empty to hide the countdown.')}>
          <DateField label={t('Exam date')} value={date} onChange={setDate} min={todayIso()} />
        </Field>
        {toefl && (
          <Field label={t('Target score')} hint={t('TOEFL iBT scores go from 60 to 120.')}>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={60}
              max={120}
              step={1}
              value={score}
              onChange={(event) => setScore(event.target.value)}
            />
          </Field>
        )}
        <div>
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? <Spinner /> : t('Save the exam')}
          </button>
        </div>

        <SectionTitle title={t('Test your skills')} />
        {attempts === null ? (
          <Skeleton height={180} />
        ) : (
          <div className="set-list">
            {examSkills(Boolean(toefl)).map((skill) => {
              const best = latestSkillScore(attempts, skill);
              const testId = skillTestId(skill, level, Boolean(toefl));
              return (
                <button key={skill} className="set-row" onClick={() => navigate(testId ? `/play/test/${testId}` : `/study/${skill}`)}>
                  <span className="set-row__body">
                    <span className="set-row__title">{t(SKILL_LABEL[skill])}</span>
                    <span className="set-row__meta">
                      {best === null ? t('Not tested yet') : t('Last result: {score}%', { score: best })}
                    </span>
                  </span>
                  <ArrowRight className="muted" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        )}

        <SectionTitle title={t('Checks and tests')} />
        <div className="grid-2">
          {diagnostic ? (
            <FeatureCard
              icon={<ScanSearch />}
              title={t('Level report')}
              meta={t('Your last level check')}
              onClick={() => navigate(`/report/${diagnostic.id}`)}
            />
          ) : (
            <FeatureCard
              icon={<ScanSearch />}
              title={t('Level check')}
              meta={t('Find your level and the skills to work on, in about 15 minutes.')}
              onClick={() => navigate('/play/diagnostic')}
            />
          )}
          <FeatureCard
            icon={<ClipboardCheck />}
            title={t(levelTest(level).title)}
            meta={t('Questions from every lesson of your level')}
            onClick={() => navigate(`/play/test/${levelTestId(level)}`)}
          />
          {toefl && (
            <FeatureCard
              icon={<GraduationCap />}
              title={t('TOEFL warm-up test')}
              meta={t('Reading, lectures, and speaking and writing tasks in one sitting')}
              onClick={() => navigate(`/play/test/${TOEFL_TEST_ID}`)}
            />
          )}
        </div>
        <div>
          <button className="btn btn--ghost" onClick={() => navigate('/study')}>
            {t('All mock tests')}
          </button>
        </div>
      </div>
    </div>
  );
}
