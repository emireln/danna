// The two looks as radio cards, each with a small picture of what it looks like. Used in Settings.
import { Check } from 'lucide-react';
import { useT } from '../lib/i18n/react';
import { LOOKS, type LookId } from '../lib/types';

export function LookPicker({ value, disabled, onChange }: { value: LookId; disabled?: boolean; onChange: (look: LookId) => void }) {
  const t = useT();
  return (
    <div className="look-grid" role="radiogroup" aria-label={t('Look')}>
      {LOOKS.map((look) => {
        const title = look === 'classic' ? t('Classic') : t('Playful');
        const text =
          look === 'classic'
            ? t('The calm, clear look you know. Flat buttons, quiet colours.')
            : t('Friendlier and bright: 3D buttons, quests and celebrations.');
        const selected = value === look;
        return (
          <button
            key={look}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`look-card look-card--${look}`}
            disabled={disabled}
            onClick={() => onChange(look)}
          >
            <span className={`look-card__preview look-card__preview--${look}`} aria-hidden="true">
              <span className="look-card__bar" />
              <span className="look-card__block" />
              <span className="look-card__button" />
            </span>
            <span className="look-card__title">{title}</span>
            {look === 'playful' && <span className="look-card__badge">{t('Discontinued, it might have bugs')}</span>}
            <span className="look-card__text">{text}</span>
            <span className="look-card__tick">{selected && <Check aria-hidden="true" />}</span>
          </button>
        );
      })}
    </div>
  );
}
