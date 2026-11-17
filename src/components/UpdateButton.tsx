// The update in the title bar: offered when a newer danna is found, downloaded on a click, and restarted into when it is
// ready. It shows only on the desktop app, where updates exist.
import { Download, RotateCw } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { useT } from '../lib/i18n/react';
import { useUpdateStatus } from '../lib/update';
import { Spinner } from './ui';

export function UpdateButton() {
  const t = useT();
  const status = useUpdateStatus();
  if (!bridge || !status.version) return null;
  const api = bridge;

  if (status.state === 'available') {
    return (
      <button type="button" className="btn btn--ghost btn--sm update-control" onClick={() => void api.update.download()}>
        <Download aria-hidden="true" /> {t('Update to {version}', { version: status.version })}
      </button>
    );
  }
  if (status.state === 'downloading') {
    return (
      <span className="update-control update-control--busy small">
        <Spinner dark /> {t('Downloading {version}…', { version: status.version })}
      </span>
    );
  }
  if (status.state === 'ready') {
    return (
      <button type="button" className="btn btn--primary btn--sm update-control" onClick={() => void api.update.install()}>
        <RotateCw aria-hidden="true" /> {t('Restart to update')}
      </button>
    );
  }
  return null;
}
