// The desktop app's update state: a newer version is downloading, or it is ready and installs when
// danna closes. In the browser there are no updates, so the state stays idle.
import { useEffect, useState } from 'react';
import { bridge, type UpdateStatus } from './bridge';

const IDLE: UpdateStatus = { state: 'idle', version: null };

export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>(IDLE);

  useEffect(() => {
    if (!bridge) return undefined;
    let active = true;
    bridge.update
      .status()
      .then((next) => {
        if (active) setStatus(next);
      })
      .catch(() => undefined);
    const stop = bridge.update.onStatus((next) => setStatus(next));
    return () => {
      active = false;
      stop();
    };
  }, []);

  return status;
}
