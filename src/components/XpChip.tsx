// The XP of the account, shown in the title bar of the Playful look (the Classic look keeps its title bar as it is).
import { Zap } from 'lucide-react';
import { useT } from '../lib/i18n/react';

export function XpChip({ xp }: { xp: number }) {
  const t = useT();
  return (
    <span className="xp-chip" title={t('Total XP')}>
      <Zap aria-hidden="true" />
      <b>{xp}</b>
      <span>{t('XP')}</span>
    </span>
  );
}
