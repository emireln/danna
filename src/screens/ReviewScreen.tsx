import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Play } from 'lucide-react';
import { Empty, Notice, PageHeader, SectionTitle, Skeleton } from '../components/ui';
import { errorText } from '../lib/bridge';
import { plural } from '../lib/text';
import { questionPreview } from '../lib/srs';
import { SKILL_LABEL, type ReviewRow } from '../lib/types';
import { useAuth } from '../state/auth';

function dueText(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return 'Due now';
  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return `In ${Math.max(1, hours)} h`;
  return `In ${plural(Math.round(hours / 24), 'day')}`;
}

export function ReviewScreen() {
  const navigate = useNavigate();
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
      <PageHeader eyebrow="Spaced repetition" title="Review" />

      {loadError && <Notice tone="error">{loadError}</Notice>}

      {items === null ? (
        <Skeleton height={170} />
      ) : (
        <>
          <section className="hero" aria-label="Daily review">
            <p className="eyebrow">Due now</p>
            <h2 className="hero__title">{plural(due.length, 'question')} to review</h2>
            <p className="hero__text">
              {due.length > 0
                ? 'Questions you miss in lessons come back here just before you would forget them. Clear the queue a few minutes at a time.'
                : 'Nothing is due right now. Missed questions return here just before you would forget them.'}
            </p>
            <p className="hero__meta">
              {plural(mastered, 'question')} mastered · {plural(items.length, 'question')} in total
            </p>
            <button className="btn btn--white btn--block hero__cta" disabled={due.length === 0} onClick={() => navigate('/play/review')}>
              <Play /> Start review
            </button>
          </section>

          <SectionTitle title="Coming up" />
          {items.length === 0 ? (
            <Empty icon={<Layers />} title="Your review queue is empty">
              Finish a lesson and any question you miss will be scheduled here.
            </Empty>
          ) : upcoming.length === 0 ? (
            <p className="muted">Nothing is scheduled after today&apos;s queue.</p>
          ) : (
            <div className="set-list">
              {upcoming.map((item) => (
                <div key={item.item_key} className="set-row set-row--static">
                  <span className="chip chip--blue">{SKILL_LABEL[item.skill]}</span>
                  <span className="set-row__body">
                    <span className="set-row__title">{questionPreview(item.payload?.question)}</span>
                  </span>
                  <span className="set-row__when">{dueText(item.due_at, now)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
