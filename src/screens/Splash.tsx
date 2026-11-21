import { Wordmark } from '../components/ui';
import { useT } from '../lib/i18n/react';

export function Splash() {
  const t = useT();
  return (
    <div className="auth" role="status" aria-label={t('Loading danna')}>
      <div className="splash-stack">
        <Wordmark className="wordmark--xl" />
        <span className="spinner spinner--dark" aria-hidden="true" />
      </div>
    </div>
  );
}
