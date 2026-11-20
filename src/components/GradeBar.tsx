// The four grades of a card, each with the wait it sets: again, hard, good and easy. Keys 1 to 4 choose one.
import { useT } from '../lib/i18n/react';
import type { Grade } from '../lib/srs';

export function waitLabel(ms: number, t: ReturnType<typeof useT>): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return t('{count} min', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('{count} h', { count: hours });
  return t('{count} d', { count: Math.round(hours / 24) });
}

export function GradeBar({
  waits,
  disabled,
  onGrade,
}: {
  waits: Record<Grade, number>;
  disabled?: boolean;
  onGrade: (grade: Grade) => void;
}) {
  const t = useT();
  const items: Array<{ grade: Grade; label: string; key: string }> = [
    { grade: 'again', label: t('Again'), key: '1' },
    { grade: 'hard', label: t('Hard'), key: '2' },
    { grade: 'good', label: t('Good'), key: '3' },
    { grade: 'easy', label: t('Easy'), key: '4' },
  ];
  return (
    <div className="grade-bar" role="group" aria-label={t('How well did you know it?')}>
      {items.map((item) => (
        <button key={item.grade} type="button" className={`grade grade--${item.grade}`} disabled={disabled} onClick={() => onGrade(item.grade)}>
          <span className="grade__label">{item.label}</span>
          <span className="grade__wait">{waitLabel(waits[item.grade], t)}</span>
          <span className="grade__key" aria-hidden="true">
            {item.key}
          </span>
        </button>
      ))}
    </div>
  );
}
