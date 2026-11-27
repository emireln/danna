// The pop-up for a newer Danna. It appears when one is found, and it stays until the person chooses: Download fetches the
// new version in the background, and Restart to update installs it once it is ready. Later hides it for now. It comes
// back when the person checks for updates again, and when the next state of that version arrives.
import { useEffect, useState } from 'react';
import { bridge } from '../lib/bridge';
import { useT } from '../lib/i18n/react';
import { UPDATE_CHECKED, useUpdateStatus } from '../lib/update';

export function UpdateNotice() {
  const t = useT();
  const status = useUpdateStatus();
  // The state of the version the person hid. A new state of the same version (ready, after downloading) shows again.
  const [hidden, setHidden] = useState<string | null>(null);

  useEffect(() => {
    const show = () => setHidden(null);
    window.addEventListener(UPDATE_CHECKED, show);
    return () => window.removeEventListener(UPDATE_CHECKED, show);
  }, []);

  const { state, version } = status;
  if (!version || (state !== 'available' && state !== 'downloading' && state !== 'ready')) return null;
  const key = `${state}:${version}`;
  if (hidden === key) return null;

  const copy =
    state === 'available'
      ? {
          title: t('Danna {version} is available', { version }),
          text: t('Download it now and keep learning. When it is ready, restart Danna to update.'),
        }
      : state === 'downloading'
        ? {
            title: t('Downloading Danna {version}', { version }),
            text: t('It downloads in the background, so you can keep learning.'),
          }
        : {
            title: t('Danna {version} is ready', { version }),
            text: t('Restart now to use the new version. Otherwise it installs when you close Danna.'),
          };

  return (
    <section className="update-pop" role="status" aria-live="polite" aria-label={t('Update')}>
      <div className="update-pop__title">{copy.title}</div>
      <p className="update-pop__text">{copy.text}</p>
      <div className="update-pop__actions">
        {state === 'available' && (
          <button className="btn btn--primary btn--sm" onClick={() => void bridge?.update.download()}>
            {t('Download update')}
          </button>
        )}
        {state === 'ready' && (
          <button className="btn btn--primary btn--sm" onClick={() => void bridge?.update.install()}>
            {t('Restart to update')}
          </button>
        )}
        <button className="btn btn--ghost btn--sm" onClick={() => setHidden(key)}>
          {t('Later')}
        </button>
      </div>
    </section>
  );
}
