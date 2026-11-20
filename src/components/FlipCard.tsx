// The card of a study session: the front first, and the back once the learner turns it. A click, Space or Enter turns it.
import type { ReactNode } from 'react';

export function FlipCard({
  front,
  back,
  note,
  revealed,
  onReveal,
  frontLabel,
  backLabel,
}: {
  front: string;
  back: string;
  note?: string;
  revealed: boolean;
  onReveal: () => void;
  frontLabel: ReactNode;
  backLabel: ReactNode;
}) {
  return (
    <button type="button" className={revealed ? 'flip-card is-flipped' : 'flip-card'} onClick={onReveal} aria-pressed={revealed}>
      <span className="flip-card__inner">
        <span className="flip-card__face flip-card__face--front">
          <span className="flip-card__label">{frontLabel}</span>
          <span className="flip-card__text">{front}</span>
        </span>
        <span className="flip-card__face flip-card__face--back" aria-hidden={!revealed}>
          <span className="flip-card__label">{backLabel}</span>
          <span className="flip-card__text">{back}</span>
          {note && <span className="flip-card__note">{note}</span>}
        </span>
      </span>
    </button>
  );
}
