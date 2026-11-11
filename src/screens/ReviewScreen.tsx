import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Layers } from 'lucide-react';
import { CountUp } from '../components/charts';
import { Empty, Skeleton } from '../components/ui';
import { useAuth } from '../state/auth';
import { SKILL_LABEL, type ReviewRow } from '../lib/types';

function dueText(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return 'Due now';
  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return `In ${Math.max(1, hours)} h`;
  const days = Math.round(hours / 24);
  return `In ${days} day${days === 1 ? '' : 's'}`;
}

export function ReviewScreen() {
  const navigate = useNavigate();
  const { backend } = useAuth();
  const [items, setItems] = useState<ReviewRow[] | null>(null);
  const now = useMemo(() => Date.now(), []);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    backend
      .listReviewItems()
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((error: unknown) => console.error('Could not load your review queue', error));
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
      <div className="page__head">
        <div>
          <p className="eyebrow">Spaced repetition</p>
          <h1 style={{ marginTop: 4 }}>Review</h1>
        </div>
      </div>

      {items === null ? (
        <Skeleton height={170} />
      ) : (
        <>
          <div className="review-hero">
            <div>
              <div className="review-hero__count">
                <CountUp to={due.length} />
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>
                questions due now
              </p>
            </div>
            <div className="stack" style={{ gap: 12 }}>
              <p>
                Questions you miss in lessons come back here just before you would forget them. Clear the queue a few
                minutes at a time.
              </p>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button className="btn btn--primary" disabled={due.length === 0} onClick={() => navigate('/play/review')}>
                  <Play /> Start review
                </button>
                <span className="small muted">
                  {mastered} mastered · {items.length} in total
                </span>
              </div>
            </div>
          </div>

          <h2 style={{ marginTop: 28, marginBottom: 12 }}>Coming up</h2>
          {items.length === 0 ? (
            <Empty icon={<Layers />} title="Your review queue is empty">
              Finish a lesson and any question you miss will be scheduled here.
            </Empty>
          ) : upcoming.length === 0 ? (
            <p className="muted">Nothing scheduled after today&apos;s queue.</p>
          ) : (
            <div className="set-list">
              {upcoming.map((item) => (
                <div key={item.item_key} className="set-row" style={{ cursor: 'default' }}>
                  <span className="chip chip--blue">{SKILL_LABEL[item.skill]}</span>
                  <span className="set-row__body">
                    <span className="set-row__title" style={{ display: 'block', fontWeight: 560, fontSize: 15 }}>
                      {item.payload.question.prompt}
                    </span>
                  </span>
                  <span className="small muted" style={{ whiteSpace: 'nowrap' }}>
                    {dueText(item.due_at, now)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
