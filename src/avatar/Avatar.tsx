// The coach's face on the talk screen. The 3D scene (scene.ts, with three.js) is loaded only when the talk opens, and each
// frame the character is moved by the pose from rig.ts. On a device without 3D graphics the talk still works, and a line says so.
import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n/react';
import type { LiveConversation } from '../lib/live/conversation';
import { createRig } from './rig';
import type { CharacterKind } from './scene';

export function CoachFigure({ kind, conversation }: { kind: CharacterKind; conversation: LiveConversation }) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    let disposed = false;
    let frame = 0;
    let dispose: (() => void) | null = null;
    const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rig = createRig({ reducedMotion });
    import('./scene')
      .then(({ createCharacterScene }) => {
        if (disposed) return;
        const scene = createCharacterScene(element, kind);
        dispose = scene.dispose;
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
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      dispose?.();
    };
  }, [kind, conversation]);

  if (failed) {
    return <p className="live__fallback">{t('The 3D coach needs graphics support, which this device does not have. The talk still works.')}</p>;
  }
  return <div className="live__scene" ref={host} role="img" aria-label={t('Your talking coach')} />;
}
