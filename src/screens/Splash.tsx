import { useT } from '../lib/i18n/react';

// The loading page shows only a spinner. The app's name is not written on it.
export function Splash() {
  const t = useT();
  return (
    <div className="auth" role="status" aria-label={t('Loading Danna')}>
      <div className="splash-stack">
        <span className="spinner spinner--dark" aria-hidden="true" />
      </div>
    </div>
  );
}
