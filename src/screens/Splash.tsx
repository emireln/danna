import { BrandMark } from '../components/ui';
import { useT } from '../lib/i18n/react';

export function Splash() {
  const t = useT();
  return (
    <div className="auth" role="status" aria-label={t('Loading danna')}>
      <div className="splash-stack">
        <BrandMark size={44} />
        <span className="spinner spinner--dark" aria-hidden="true" />
      </div>
    </div>
  );
}
