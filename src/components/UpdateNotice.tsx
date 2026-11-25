// Tells the person once when a newer DANNA is available, and once when it is ready to restart into. The update itself is
// offered in Settings: nothing downloads or restarts without a click.
import { useEffect, useRef } from 'react';
import { useT } from '../lib/i18n/react';
import { useUpdateStatus } from '../lib/update';
import { useToast } from '../state/toast';

export function UpdateNotice() {
  const t = useT();
  const { notify } = useToast();
  const status = useUpdateStatus();
  const told = useRef<string | null>(null);

  useEffect(() => {
    if (!status.version || (status.state !== 'available' && status.state !== 'ready')) return;
    const key = `${status.state}:${status.version}`;
    if (told.current === key) return;
    told.current = key;
    if (status.state === 'available') {
      notify(t('DANNA {version} is available. Download it in Settings.', { version: status.version }), 'ok');
    } else {
      notify(t('DANNA {version} is ready. Restart to update when you are ready.', { version: status.version }), 'ok');
    }
  }, [status, notify, t]);

  return null;
}
