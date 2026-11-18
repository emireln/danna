// The score report: one layout for the level check and for the profile report. Each screen gives the numbers and
// the wording; this component puts them together, so the two reports look the same.
import type { ReactNode } from 'react';
import { ArrowRight, Smile, Sparkles, Target } from 'lucide-react';
import { useT } from '../lib/i18n/react';
import { TONE_LABEL, toneFor } from '../lib/scoring';
import { Donut, Gauge, Radar, REPORT_GOAL, REPORT_YOU } from './charts';
import { ProgressBar, SectionTitle } from './ui';

export interface ReportStat {
  label: string;
  value: string;
}

export interface ReportCard {
  key: string;
  name: string;
  /** Null when the skill has not been practised yet. */
  score: number | null;
  /** A tip for the skill. Shared reports leave it out. */
  tip?: string;
}

export interface ReportPlanSlice {
  key: string;
  label: string;
  percent: number;
  color: string;
}

export interface ScoreReportProps {
  eyebrow: string;
  title: string;
  sub?: string;
  pill?: string;
  gauge: { value: number; max: number; range: string };
  /** Four numbers shown under the gauge, for the profile report. */
  stats?: ReportStat[];
  summary?: { title: string; body: string } | null;
  advice?: { label: string; title: string; body: string; hint?: string } | null;
  radar: { title: string; axes: { label: string; value: number }[]; goal?: number; youLabel: string; goalLabel?: string };
  cardsTitle: string;
  cards: ReportCard[];
  plan?: { title: string; description: string; slices: ReportPlanSlice[]; startLabel: string; onStart: () => void } | null;
  actions?: ReactNode;
}

export function ScoreReport({
  eyebrow,
  title,
  sub,
  pill,
  gauge,
  stats,
  summary,
  advice,
  radar,
  cardsTitle,
  cards,
  plan,
  actions,
}: ScoreReportProps) {
  const t = useT();
  return (
    <div>
      <section className="report-hero">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="report-hero__title">{title}</h1>
        {sub && <p className="report-hero__sub">{sub}</p>}
        {pill && <span className="report-hero__pill">{pill}</span>}
        <div className="mt-3">
          <Gauge value={gauge.value} max={gauge.max} range={gauge.range} />
        </div>
        {stats && stats.length > 0 && (
          <div className="profile-hero__stats mt-4">
            {stats.map((stat) => (
              <div key={stat.label} className="profile-hero__stat">
                <span className="profile-hero__value">{stat.value}</span>
                <span className="profile-hero__label">{stat.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="page">
        <div className="stack stack--loose mt-6">
          {summary && (
            <section className="advice">
              <h2 className="advice__title">{summary.title}</h2>
              {summary.body && <p className="advice__body">{summary.body}</p>}
            </section>
          )}

          {advice && (
            <section className="advice">
              <div className="advice__head">
                <span className="chip chip--ai">
                  <Sparkles aria-hidden="true" /> {advice.label}
                </span>
              </div>
              <h2 className="advice__title">{advice.title}</h2>
              <p className="advice__body">{advice.body}</p>
              {advice.hint && <p className="small muted">{advice.hint}</p>}
            </section>
          )}

          <section>
            <SectionTitle title={radar.title} />
            <div className="stack stack--center">
              <Radar axes={radar.axes} goal={radar.goal} />
              <div className="legend">
                <span>
                  <i style={{ background: REPORT_YOU }} /> {radar.youLabel}
                </span>
                {radar.goal !== undefined && radar.goalLabel && (
                  <span>
                    <i style={{ background: REPORT_GOAL }} /> {radar.goalLabel}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section>
            <SectionTitle title={cardsTitle} />
            <div className="grid-2">
              {cards.map((card) => {
                const practised = card.score !== null;
                const score = card.score ?? 0;
                const tone = practised ? toneFor(score) : 'needs-work';
                return (
                  <div key={card.key} className="skill-card">
                    <div className="skill-card__head">
                      <span className="icon-tile icon-tile--sm">
                        <Smile />
                      </span>
                      <span className="skill-card__name">{card.name}</span>
                      <span className={`tone tone--${tone}`}>{practised ? t(TONE_LABEL[tone]) : t('Not practised yet')}</span>
                    </div>
                    <ProgressBar value={score} max={100} label={t('{label} score', { label: card.name })} />
                    <div className="skill-card__score">
                      {practised ? (
                        <>
                          {t('Score')}: <b>{score}</b>/100
                        </>
                      ) : (
                        t('Not practised yet')
                      )}
                    </div>
                    {card.tip && (
                      <div className="skill-card__tip">
                        <Target aria-hidden="true" />
                        <span>{card.tip}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {plan && (
            <section>
              <SectionTitle title={plan.title} />
              <div className="plan">
                <Donut slices={plan.slices.map((slice) => ({ label: slice.label, percent: slice.percent, color: slice.color }))} />
                <div className="stack">
                  <p className="muted">{plan.description}</p>
                  <div className="plan__legend">
                    {plan.slices.map((slice) => (
                      <div key={slice.key} className="plan__row">
                        <i style={{ background: slice.color }} />
                        <span>{slice.label}</span>
                        <span>{slice.percent}%</span>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn--primary self-start" onClick={plan.onStart}>
                    {plan.startLabel} <ArrowRight />
                  </button>
                </div>
              </div>
            </section>
          )}

          {actions && <div className="row row--wrap pb-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
