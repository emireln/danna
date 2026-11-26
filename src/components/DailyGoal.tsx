// The daily goal: a ring that fills as the learner practises today, and what is still to do.
import { useT } from '../lib/i18n/react';
import { GOAL_ICON } from '../lib/art';

const RADIUS = 34;
const LENGTH = 2 * Math.PI * RADIUS;

export function DailyGoal({ minutes, goal, percent, done }: { minutes: number; goal: number; percent: number; done: boolean }) {
  const t = useT();
  const shown = Math.min(minutes, goal);
  return (
    <div className="daily-goal">
      <svg className="daily-goal__ring" viewBox="0 0 84 84" aria-hidden="true">
        <circle className="daily-goal__track" cx="42" cy="42" r={RADIUS} />
        <circle
          className="daily-goal__value"
          cx="42"
          cy="42"
          r={RADIUS}
          strokeDasharray={LENGTH}
          strokeDashoffset={LENGTH * (1 - percent / 100)}
        />
      </svg>
      <div className="daily-goal__text">
        <span className="daily-goal__title">{t('Daily goal')}</span>
        <span
          className="daily-goal__count"
          role="progressbar"
          aria-label={t('Daily goal')}
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={shown}
          aria-valuetext={done ? t('Goal reached. Nice!') : t('{minutes} of {goal} minutes today', { minutes: shown, goal })}
        >
          {done ? t('Goal reached. Nice!') : t('{minutes} of {goal} minutes today', { minutes: shown, goal })}
        </span>
      </div>
      <img className="daily-goal__art" src={GOAL_ICON} alt="" aria-hidden="true" />
    </div>
  );
}
