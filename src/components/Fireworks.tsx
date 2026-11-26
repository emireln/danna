import { useEffect, useRef } from 'react';
import { runFireworks } from '../lib/fireworks';

// The fireworks over a lesson finished with three stars. The canvas covers the runner and takes no clicks. People who
// ask the system for less motion get no show.
export function Fireworks() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    return runFireworks(element);
  }, []);

  return <canvas ref={canvas} className="fireworks" aria-hidden="true" />;
}
