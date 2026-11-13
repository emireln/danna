// The day streak. The flame keeps its orange look up to 200 days (see frame.css). Above that it turns red, then blue,
// then purple from 1000 days, and each colour moves a little more than the one before.
import { useT } from '../lib/i18n/react';
import { tn } from '../lib/i18n';
import { streakTier } from '../lib/progress';

export function StreakFire({ days }: { days: number }) {
  // Redraws the label when the language changes.
  useT();
  if (days <= 0) return null;
  const tier = streakTier(days);
  const label = tn('{count} day streak', '{count} days streak', days, { count: days });
  return (
    <span className={`streak streak--${tier}`} title={label} role="img" aria-label={label}>
      <span className="streak__flame" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path className="streak__outer" d="M12 2.5c.6 3.1 3.1 4.9 4.6 7.1 1.1 1.6 1.4 3 1.4 4.6A6 6 0 0 1 6 14.2c0-2.4 1.2-4.2 2.6-5.6.2 1.8 1 3 2.2 3.8C10.6 8.1 11 5 12 2.5z" />
          <path className="streak__core" d="M12 11.4c.3 1.6 1.7 2.4 1.7 4.1a1.7 1.7 0 0 1-3.4 0c0-.9.4-1.5.9-2 .1.6.3 1 .8 1.3-.2-1 0-2 0-3.4z" />
        </svg>
      </span>
      <span className="streak__days" aria-hidden="true">
        {days}
      </span>
    </span>
  );
}
