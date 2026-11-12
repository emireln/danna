import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Play } from 'lucide-react';
import { Empty, Notice, PageHeader, SectionTitle, Skeleton } from '../components/ui';
import { errorText } from '../lib/bridge';
import { tn } from '../lib/i18n';
import { useT, type Translate } from '../lib/i18n/react';
import { questionPreview } from '../lib/srs';
import { SKILL_LABEL, type ReviewRow } from '../lib/types';
import { useAuth } from '../state/auth';

function dueText(iso: string, now: number, t: Translate): string {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return t('Due now');
  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return t('In {hours} h', { hours: Math.max(1, hours) });
  const days = Math.round(hours / 24);
  return tn('In {count} day', 'In {count} days', days, { count: days });
}

export function ReviewScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { backend } = useAuth();
  const [items, setItems] = useState<ReviewRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const now = useMemo(() => Date.now(), []);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    backend
      .listReviewItems()
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((error: unknown) => {
        console.error('Could not load your review queue', error);
        if (!active) return;
        setItems([]);
        setLoadError(errorText(error));
      });
    return () => {
      active = false;
    };
  }, [backend]);

  const due = items?.filter((item) => new Date(item.due_at).getTime() <= now) ?? [];
  const upcoming = (items ?? [])
    .filter((item) => new Date(item.due_at).getTime() > now)
    .sort((a, b) => a.due_at.localeCompare(b.due_at))
    .slice(0, 12);
  const mastered = (items ?? []).filter((item) => item.reps >= 3).length;

  return (
    <div className="page">
      <PageHeader eyebrow={t('Spaced repetition')} title={t('Review')} />

      {loadError && <Notice tone="error">{t(loadError)}</Notice>}

      {items === null ? (
        <Skeleton height={170} />
      ) : (
        <>
          <section className="hero" aria-label={t('Daily review')}>
            <p className="eyebrow">{t('Due now')}</p>
            <h2 className="hero__title">
              {tn('{count} question to review', '{count} questions to review', due.length, { count: due.length })}
            </h2>
            <p className="hero__text">
              {due.length > 0
                ? t('Questions you miss in lessons come back here just before you would forget them. Clear the queue a few minutes at a time.')
                : t('Nothing is due right now. Missed questions return here just before you would forget them.')}
            </p>
            <p className="hero__meta">
              {tn('{count} question mastered', '{count} questions mastered', mastered, { count: mastered })} ·{' '}
              {tn('{count} question in total', '{count} questions in total', items.length, { count: items.length })}
            </p>
            <button className="btn btn--white btn--block hero__cta" disabled={due.length === 0} onClick={() => navigate('/play/review')}>
              <Play /> {t('Start review')}
            </button>
          </section>

          <SectionTitle title={t('Coming up')} />
          {items.length === 0 ? (
            <Empty icon={<Layers />} title={t('Your review queue is empty')}>
              {t('Finish a lesson and any question you miss will be scheduled here.')}
            </Empty>
          ) : upcoming.length === 0 ? (
            <p className="muted">{t("Nothing is scheduled after today's queue.")}</p>
          ) : (
            <div className="set-list">
              {upcoming.map((item) => (
                <div key={item.item_key} className="set-row set-row--static">
                  <span className="chip chip--blue">{t(SKILL_LABEL[item.skill])}</span>
                  <span className="set-row__body">
                    <span className="set-row__title">{t(questionPreview(item.payload?.question))}</span>
                  </span>
                  <span className="set-row__when">{dueText(item.due_at, now, t)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
