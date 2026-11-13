// Says once, when a newer danna has finished downloading, that it installs when the app closes.
// The restart itself is offered in Settings, so nothing restarts while someone is studying.
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
    if (status.state !== 'ready' || !status.version || told.current === status.version) return;
    told.current = status.version;
    notify(t('danna {version} is ready. It installs when you close danna.', { version: status.version }), 'ok');
  }, [status, notify, t]);

  return null;
}
