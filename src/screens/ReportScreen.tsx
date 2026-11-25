import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Download, Share2 } from 'lucide-react';
import { ScoreReport, type ReportCard, type ReportPlanSlice } from '../components/ScoreReport';
import { ShareSheet } from '../components/ShareSheet';
import { Empty, Skeleton } from '../components/ui';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useAI } from '../state/ai';
import { useToast } from '../state/toast';
import { bandFor, studyPlan, toeflEstimate, toeflRange, type SkillMap } from '../lib/scoring';
import { formatLongDate } from '../lib/progress';
import { isSharedReport } from '../lib/reports';
import { PLAN_COLORS, TIPS, adviceFor } from '../lib/reportText';
import { useT, type Translate } from '../lib/i18n/react';
import { SKILLS, SKILL_LABEL, type AttemptRow, type FriendRow } from '../lib/types';

/** The summary of a report a friend shared: the same scores, described without the reader's own plan. */
function summaryFor(skills: SkillMap, t: Translate) {
  const scored = SKILLS.filter((skill) => skills[skill] !== undefined).map((skill) => ({ skill, score: skills[skill] ?? 0 }));
  const ranked = [...scored].sort((a, b) => a.score - b.score);
  const weakest = ranked[0];
  const strongest = ranked[ranked.length - 1];
  return {
    title: t('Skill summary'),
    body: weakest
      ? t('{strongest} is the strongest area at {strongScore}/100, and {weakest} has the lowest score at {weakScore}/100.', {
          strongest: t(SKILL_LABEL[strongest.skill]),
          strongScore: strongest.score,
          weakest: t(SKILL_LABEL[weakest.skill]),
          weakScore: weakest.score,
        })
      : '',
  };
}

function saveImage(attempt: AttemptRow, estimate: number | null, t: Translate) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, '#1f4fd0');
  gradient.addColorStop(1, '#3a74f4');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 630);

  const font = "'Inter Variable', Inter, 'Segoe UI', sans-serif";
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 34px ${font}`;
  ctx.fillText(estimate !== null ? t('DANNA · TOEFL estimate') : t('DANNA · level report'), 72, 110);
  ctx.font = `750 190px ${font}`;
  ctx.fillText(String(estimate ?? attempt.score_pct), 72, 340);
  ctx.font = `600 40px ${font}`;
  ctx.fillText(estimate !== null ? t('of 120 (estimate)') : t('% accuracy'), 76, 412);
  ctx.font = `500 26px ${font}`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(formatLongDate(attempt.created_at), 72, 570);

  SKILLS.forEach((skill, index) => {
    const value = attempt.skills[skill] ?? 0;
    const y = 180 + index * 76;
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 28px ${font}`;
    ctx.fillText(t(SKILL_LABEL[skill]), 640, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${value}`, 1128, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(640, y + 16, 488, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(640, y + 16, 488 * (value / 100), 14);
  });

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `danna-report-${attempt.id.slice(0, 8)}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, 'image/png');
}

export function ReportScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const { id = '' } = useParams();
  const { backend } = useAuth();
  const { profile } = useAppData();
  const { ready: aiReady, selection } = useAI();
  const { notify } = useToast();
  const [attempt, setAttempt] = useState<AttemptRow | null | undefined>(undefined);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [sharing, setSharing] = useState(false);
  // Set when a friend's shared report is opened from the friends inbox.
  const sharedBy = (location.state as { sharedBy?: string } | null)?.sharedBy ?? '';

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    backend
      .getAttempt(id)
      .then((row) => {
        if (active) setAttempt(row);
      })
      .catch(() => {
        if (active) setAttempt(null);
      });
    if (backend.mode === 'supabase') {
      backend
        .listFriends()
        .then((list) => {
          if (active) setFriends(list.filter((friend) => friend.status === 'accepted'));
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [backend, id]);

  if (attempt === undefined) {
    return (
      <div className="page">
        <Skeleton height={420} />
      </div>
    );
  }
  if (attempt === null) {
    return (
      <div className="page">
        <Empty title={t('This report is not available')} action={<button className="btn btn--ghost" onClick={() => navigate('/')}>{t('Back to today')}</button>}>
          {t('It may have been removed, or it was not shared with you.')}
        </Empty>
      </div>
    );
  }

  // A report belongs to the person who took the test. Anything else was shared with this person.
  const shared = isSharedReport(attempt.user_id, profile?.id);
  const sharer = sharedBy || t('a friend');
  const percent = attempt.score_pct;
  const isEstimate = attempt.kind === 'diagnostic' || attempt.kind === 'mock';
  // The TOEFL estimate: the learner's own report uses their goal, and a shared report keeps the estimate it was saved with.
  let estimate: number | null = null;
  if (isEstimate) {
    if (shared) estimate = attempt.predicted;
    else if (profile?.goal === 'toefl') estimate = attempt.predicted ?? toeflEstimate(percent);
  }
  const [low, high] = estimate !== null ? toeflRange(estimate) : [percent, percent];
  const skills = attempt.skills;
  const advice = shared ? null : adviceFor(skills, percent, bandFor(percent), estimate, t);
  const summary = shared ? summaryFor(skills, t) : null;
  const plan = studyPlan(skills);
  const goal = !shared && profile?.goal === 'toefl' ? Math.round(profile.target_score / 1.2) : undefined;
  const axes = SKILLS.map((skill) => ({ label: t(SKILL_LABEL[skill]), value: skills[skill] ?? 0 }));
  const cardOrder = SKILLS.filter((skill) => skills[skill] !== undefined).sort((a, b) => (skills[a] ?? 0) - (skills[b] ?? 0));
  const cards: ReportCard[] = cardOrder.map((skill) => ({
    key: skill,
    name: t(SKILL_LABEL[skill]),
    score: skills[skill] ?? 0,
    tip: shared ? undefined : t(TIPS[skill]),
  }));
  const slices: ReportPlanSlice[] = plan.map((slice, index) => ({
    key: slice.key,
    label: t(slice.label),
    percent: slice.percent,
    color: PLAN_COLORS[index],
  }));

  const actions = (
    <>
      {!shared && backend?.mode === 'supabase' && (
        <button className="btn btn--primary" onClick={() => setSharing(true)}>
          <Share2 /> {t('Share with a friend')}
        </button>
      )}
      <button
        className="btn btn--ghost"
        onClick={() => {
          try {
            saveImage(attempt, estimate, t);
            notify(t('Image saved to your Downloads folder.'), 'ok');
          } catch {
            notify(t('The image could not be created on this device.'), 'error');
          }
        }}
      >
        <Download /> {t('Save as image')}
      </button>
      {!shared && attempt.kind === 'diagnostic' && (
        <button className="btn btn--ghost" onClick={() => navigate('/play/diagnostic')}>
          {t('Retake diagnostic')}
        </button>
      )}
    </>
  );

  return (
    <>
      <ScoreReport
        eyebrow={formatLongDate(attempt.created_at)}
        title={shared ? t('Report from {name}', { name: sharer }) : isEstimate ? t('Score report') : t(attempt.title)}
        sub={
          shared
            ? t('Shared with you')
            : isEstimate
              ? estimate !== null
                ? t('TOEFL predicted score')
                : t('Your level is {level}', { level: bandFor(percent) })
              : undefined
        }
        pill={!shared && isEstimate ? (estimate !== null ? t('Overall score') : t('Overall')) : undefined}
        gauge={{
          value: estimate ?? percent,
          max: estimate !== null ? 120 : 100,
          range: estimate !== null ? t('{low}–{high} of 120', { low, high }) : t('{percent}% accuracy', { percent }),
        }}
        summary={summary}
        advice={
          advice
            ? {
                label: aiReady && selection ? t('Coach') : t('Your advice'),
                title: advice.title,
                body: advice.body,
                hint: aiReady ? undefined : t('Connect an AI key in Settings for a longer, personal explanation from your coach.'),
              }
            : null
        }
        radar={{
          title: shared ? t('Skill profile') : t('Your skill profile'),
          axes,
          goal,
          youLabel: shared ? sharer : t('You'),
          goalLabel: goal !== undefined ? t('Your goal ({score})', { score: profile?.target_score ?? '' }) : undefined,
        }}
        cardsTitle={t('Skills to improve your score')}
        cards={cards}
        plan={
          shared
            ? null
            : {
                title: t("Today's learning plan"),
                description: t('Boost your skills in {minutes} minutes a day with questions picked for your weakest areas.', {
                  minutes: profile?.daily_minutes ?? 15,
                }),
                slices,
                startLabel: t("Start today's plan"),
                onStart: () => navigate(plan[0].key === 'other' ? '/study' : `/study/${plan[0].key}`),
              }
        }
        actions={actions}
      />
      {sharing && !shared && (
        <ShareSheet friends={friends} preferredItem={{ kind: 'result', id: attempt.id }} onClose={() => setSharing(false)} />
      )}
    </>
  );
}
