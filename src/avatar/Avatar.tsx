// The coach on the talk screen: a real person model (characters.ts), drawn in 3D and moved every frame by the pose from rig.ts.
// The model is loaded when the talk opens. Without 3D graphics the talk still works, and a line says so.
import { useEffect, useRef, useState } from 'react';
import { Spinner } from '../components/ui';
import { useT } from '../lib/i18n/react';
import type { LiveConversation } from '../lib/live/conversation';
import type { CoachInfo } from './characters';
import { createRig } from './rig';

export function CoachFigure({ coach, conversation }: { coach: CoachInfo; conversation: LiveConversation }) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    let disposed = false;
    let frame = 0;
    let dispose: (() => void) | null = null;
    const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rig = createRig({ reducedMotion });
    setState('loading');
    import('./coach3d')
      .then(({ loadCoach }) => loadCoach(element, coach))
      .then((scene) => {
        if (disposed) {
          scene.dispose();
          return;
        }
        dispose = scene.dispose;
        setState('ready');
        let last = performance.now();
        const loop = (now: number) => {
          const seconds = (now - last) / 1000;
          last = now;
          const sound = conversation.sound();
          scene.render(rig.update({ status: conversation.snapshot().status, coach: sound.coach, user: sound.user }, seconds));
          frame = window.requestAnimationFrame(loop);
        };
        frame = window.requestAnimationFrame(loop);
      })
      .catch(() => {
        if (!disposed) setState('failed');
      });
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      dispose?.();
    };
  }, [coach, conversation]);

  if (state === 'failed') {
    return (
      <p className="live__fallback">
        {t('The 3D coach needs graphics support, which this device does not have. The talk still works.')}
      </p>
    );
  }
  return (
    <div className="live__scene" ref={host} role="img" aria-label={t('Your talking coach')} aria-busy={state === 'loading'}>
      {state === 'loading' && (
        <p className="live__loading">
          <Spinner /> {t('Loading your coach…')}
        </p>
      )}
    </div>
  );
}
