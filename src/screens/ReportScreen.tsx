import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Download, Share2, Smile, Sparkles, Target } from 'lucide-react';
import { Donut, Gauge, Radar } from '../components/charts';
import { ShareSheet } from '../components/ShareSheet';
import { Empty, ProgressBar, SectionTitle, Skeleton } from '../components/ui';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useAI } from '../state/ai';
import { useToast } from '../state/toast';
import { bandFor, studyPlan, toeflEstimate, toeflRange, toneFor, TONE_LABEL, type SkillMap } from '../lib/scoring';
import { formatLongDate } from '../lib/progress';
import { SKILLS, SKILL_LABEL, type AttemptRow, type FriendRow, type Skill } from '../lib/types';

const TIPS: Record<Skill, string> = {
  reading: 'Summarize each paragraph in one sentence before you answer. Then check every option against that summary.',
  listening: 'Replay each clip once with the transcript hidden. Then write the main idea in five words.',
  speaking: 'Use three parts: your position, one reason and one example. Record it and listen back for pauses.',
  writing: 'Write a thesis you could argue against. Give each body paragraph one reason and one example.',
  language: 'Rebuild the sentences you missed from memory the next day. Repeat the ones that still feel slow.',
};

const PLAN_COLORS = ['#2f6bff', '#14b8a6', '#f5b400', '#a4adbf'];

function adviceFor(skills: SkillMap, percent: number, estimate: number | null) {
  const ranked = SKILLS.map((skill) => ({ skill, score: skills[skill] ?? 0 })).sort((a, b) => a.score - b.score);
  const weakest = ranked[0];
  const strongest = ranked[ranked.length - 1];
  const band = bandFor(percent);
  const title =
    percent >= 80
      ? `Strong across the sections, sharpen ${SKILL_LABEL[weakest.skill].toLowerCase()}`
      : `Strong ${SKILL_LABEL[strongest.skill].toLowerCase()}, focus on ${SKILL_LABEL[weakest.skill].toLowerCase()}`;
  const body =
    `Your overall level looks like ${band}` +
    (estimate !== null ? `, with an estimated TOEFL score of ${estimate}.` : '.') +
    ` ${SKILL_LABEL[strongest.skill]} is your strongest area at ${strongest.score}/100, and ${SKILL_LABEL[weakest.skill]} needs the most attention at ${weakest.score}/100. ${TIPS[weakest.skill]}`;
  return { title, body, weakest: weakest.skill };
}

function saveImage(attempt: AttemptRow, estimate: number | null) {
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
  ctx.fillText('danna · TOEFL estimate', 72, 110);
  ctx.font = `750 190px ${font}`;
  ctx.fillText(String(estimate ?? attempt.score_pct), 72, 340);
  ctx.font = `600 40px ${font}`;
  ctx.fillText(estimate !== null ? 'of 120 (estimate)' : '% accuracy', 76, 412);
  ctx.font = `500 26px ${font}`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(formatLongDate(attempt.created_at), 72, 570);

  SKILLS.forEach((skill, index) => {
    const value = attempt.skills[skill] ?? 0;
    const y = 180 + index * 76;
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 28px ${font}`;
    ctx.fillText(SKILL_LABEL[skill], 640, y);
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
  const { id = '' } = useParams();
  const { backend } = useAuth();
  const { profile } = useAppData();
  const { ready: aiReady, selection } = useAI();
  const { notify } = useToast();
  const [attempt, setAttempt] = useState<AttemptRow | null | undefined>(undefined);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [sharing, setSharing] = useState(false);

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
        <Empty title="This report is not available" action={<button className="btn btn--ghost" onClick={() => navigate('/')}>Back to today</button>}>
          It may have been removed, or it was not shared with you.
        </Empty>
      </div>
    );
  }

  const percent = attempt.score_pct;
  const isEstimate = attempt.kind === 'diagnostic' || attempt.kind === 'mock';
  const estimate = isEstimate ? (attempt.predicted ?? toeflEstimate(percent)) : null;
  const [low, high] = estimate !== null ? toeflRange(estimate) : [percent, percent];
  const skills = attempt.skills;
  const advice = adviceFor(skills, percent, estimate);
  const plan = studyPlan(skills);
  const goal = profile ? Math.round(profile.target_score / 1.2) : undefined;
  const axes = SKILLS.map((skill) => ({ label: SKILL_LABEL[skill], value: skills[skill] ?? 0 }));
  const cardOrder = SKILLS.filter((skill) => skills[skill] !== undefined).sort((a, b) => (skills[a] ?? 0) - (skills[b] ?? 0));

  return (
    <div className="report">
      <section className="report-hero">
        <p className="eyebrow">{formatLongDate(attempt.created_at)}</p>
        <h1 className="report-hero__title">{isEstimate ? 'Score report' : attempt.title}</h1>
        {isEstimate && (
          <>
            <p className="report-hero__sub">TOEFL predicted score</p>
            <span className="report-hero__pill">Overall score</span>
          </>
        )}
        <div className="mt-3">
          <Gauge
            value={estimate ?? percent}
            max={estimate !== null ? 120 : 100}
            range={estimate !== null ? `${low}–${high} of 120` : `${percent}% accuracy`}
          />
        </div>
      </section>

      <div className="page">
        <div className="stack stack--loose mt-6">
          <section className="advice">
            <div className="advice__head">
              <span className="chip chip--ai">
                <Sparkles aria-hidden="true" /> {aiReady && selection ? 'Coach' : 'Your advice'}
              </span>
            </div>
            <h2 className="advice__title">{advice.title}</h2>
            <p className="advice__body">{advice.body}</p>
            {!aiReady && <p className="small muted">Connect an AI key in Settings for a longer, personal explanation from your coach.</p>}
          </section>

          <section>
            <SectionTitle title="Your skill profile" />
            <div className="stack stack--center">
              <Radar axes={axes} goal={goal} />
              <div className="legend">
                <span>
                  <i style={{ background: '#2f6bff' }} /> You
                </span>
                {goal !== undefined && (
                  <span>
                    <i style={{ background: '#a4adbf' }} /> Your goal ({profile?.target_score})
                  </span>
                )}
              </div>
            </div>
          </section>

          <section>
            <SectionTitle title="Skills to improve your score" />
            <div className="grid-2">
              {cardOrder.map((skill) => {
                const score = skills[skill] ?? 0;
                const tone = toneFor(score);
                return (
                  <div key={skill} className="skill-card">
                    <div className="skill-card__head">
                      <span className="icon-tile icon-tile--sm">
                        <Smile />
                      </span>
                      <span className="skill-card__name">{SKILL_LABEL[skill]}</span>
                      <span className={`tone tone--${tone}`}>{TONE_LABEL[tone]}</span>
                    </div>
                    <ProgressBar value={score} max={100} label={`${SKILL_LABEL[skill]} score`} />
                    <div className="skill-card__score">
                      Score: <b>{score}</b>/100
                    </div>
                    <div className="skill-card__tip">
                      <Target aria-hidden="true" />
                      <span>{TIPS[skill]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <SectionTitle title="Today's learning plan" />
            <div className="plan">
              <Donut slices={plan.map((slice, index) => ({ label: slice.label, percent: slice.percent, color: PLAN_COLORS[index] }))} />
              <div className="stack">
                <p className="muted">
                  Boost your skills in {profile?.daily_minutes ?? 15} minutes a day with questions picked for your weakest areas.
                </p>
                <div className="plan__legend">
                  {plan.map((slice, index) => (
                    <div key={slice.key} className="plan__row">
                      <i style={{ background: PLAN_COLORS[index] }} />
                      <span>{slice.label}</span>
                      <span>{slice.percent}%</span>
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn--primary self-start"
                  onClick={() => navigate(plan[0].key === 'other' ? '/study' : `/study/${plan[0].key}`)}
                >
                  Start today&apos;s plan <ArrowRight />
                </button>
              </div>
            </div>
          </section>

          <div className="row row--wrap pb-3">
            {backend?.mode === 'supabase' && (
              <button className="btn btn--primary" onClick={() => setSharing(true)}>
                <Share2 /> Share with a friend
              </button>
            )}
            <button
              className="btn btn--ghost"
              onClick={() => {
                try {
                  saveImage(attempt, estimate);
                  notify('Image saved to your Downloads folder.', 'ok');
                } catch {
                  notify('The image could not be created on this device.', 'error');
                }
              }}
            >
              <Download /> Save as image
            </button>
            {attempt.kind === 'diagnostic' && (
              <button className="btn btn--ghost" onClick={() => navigate('/play/diagnostic')}>
                Retake diagnostic
              </button>
            )}
          </div>
        </div>
      </div>

      {sharing && (
        <ShareSheet friends={friends} preferredItem={{ kind: 'result', id: attempt.id }} onClose={() => setSharing(false)} />
      )}
    </div>
  );
}
