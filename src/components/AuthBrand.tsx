import { useEffect, useRef } from 'react';
import botdanna3d from '../assets/3d/botdanna-3d-logo.webp';
import danna3d from '../assets/3d/danna-3d-logo.webp';
import recovery3d from '../assets/3d/password-recovery-3d-logo.webp';
import { ART_DRIFT, RECOVERY_SPACE, artSpacing, freePlace, placeArt, type Box, type Panel } from '../lib/authArt';

export type ArtName = 'danna' | 'botdanna' | 'recovery';

const SOURCES: Record<ArtName, string> = { danna: danna3d, botdanna: botdanna3d, recovery: recovery3d };
/** A picture's height as a share of the panel's shorter side, at its largest size. */
const SHARES: Record<ArtName, number> = { danna: 0.72, botdanna: 0.72, recovery: 0.55 };
/** Milliseconds for the recovery picture to fade in or out. */
const FADE_MS = 1800;

interface Picture {
  name: ArtName;
  img: HTMLImageElement;
  ratio: number;
}

function place(img: HTMLImageElement, box: Box) {
  img.style.display = '';
  img.style.width = `${box.w.toFixed(1)}px`;
  img.style.height = `${box.h.toFixed(1)}px`;
  img.style.left = `${box.x.toFixed(1)}px`;
  img.style.top = `${box.y.toFixed(1)}px`;
}

/**
 * The brand panel of the sign-in screen, as on the website's account pages: the apps' 3D pictures, placed at random on
 * every load, apart from each other, and drifting slowly. On the password screen a third picture, the recovery one, fades
 * in and out at free places. With reduced motion the pictures stay where they are, and the recovery picture stays
 * visible. The panel has no text.
 */
export function AuthBrand({ art }: { art: readonly ArtName[] }) {
  const panelRef = useRef<HTMLElement>(null);
  const names = art.join(' ');

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pictures: Picture[] = [];
    panel.querySelectorAll<HTMLImageElement>('img[data-art]').forEach((img) => {
      pictures.push({ name: img.dataset.art as ArtName, img, ratio: 1.15 });
    });

    let timer: number | undefined;
    let resizeTimer: number | undefined;
    let observer: ResizeObserver | undefined;
    let stopped = false;
    let lastWidth = 0;
    let lastHeight = 0;

    const layout = () => {
      window.clearTimeout(timer);
      const rect = panel.getBoundingClientRect();
      lastWidth = rect.width;
      lastHeight = rect.height;
      if (rect.width < 1 || rect.height < 1) return; // the panel is hidden on a narrow window
      const size: Panel = { width: rect.width, height: rect.height };
      const placed = placeArt(
        pictures.map(({ name, ratio }) => ({ name, ratio, share: SHARES[name], recovery: name === 'recovery' })),
        size,
      );
      if (!placed) {
        pictures.forEach(({ img }) => {
          img.style.display = 'none';
        });
        return;
      }
      const { short, margin, gap } = artSpacing(size);
      pictures.forEach(({ name, img }) => {
        const box = placed.get(name);
        if (!box) return;
        place(img, box);
        // Each picture drifts a little from its place, in its own direction and at its own pace
        const angle = Math.random() * Math.PI * 2;
        const reach = ART_DRIFT * short * (0.6 + 0.4 * Math.random());
        img.style.setProperty('--dx', `${(Math.cos(angle) * reach).toFixed(1)}px`);
        img.style.setProperty('--dy', `${(Math.sin(angle) * reach).toFixed(1)}px`);
        img.style.setProperty('--drift-time', `${(7 + Math.random() * 3).toFixed(2)}s`);
        img.style.setProperty('--drift-delay', `${(-Math.random() * 10).toFixed(2)}s`);
      });

      const recovery = pictures.find(({ name }) => name === 'recovery');
      const recoveryBox = placed.get('recovery');
      if (!recovery || !recoveryBox) return;
      recovery.img.classList.remove('is-in');
      if (reduced) {
        recovery.img.classList.add('is-in');
        return;
      }
      // Somewhere free and far from the others, it fades in, rests, fades out, and comes back at another free place
      const fixed = [...placed].filter(([name]) => name !== 'recovery').map(([, box]) => box);
      const step = () => {
        const spot = freePlace({ w: recoveryBox.w, h: recoveryBox.h }, fixed, size, gap * RECOVERY_SPACE, margin);
        if (!spot) {
          timer = window.setTimeout(step, 2000);
          return;
        }
        recovery.img.style.left = `${spot.x.toFixed(1)}px`;
        recovery.img.style.top = `${spot.y.toFixed(1)}px`;
        recovery.img.classList.add('is-in');
        timer = window.setTimeout(() => {
          recovery.img.classList.remove('is-in');
          timer = window.setTimeout(step, FADE_MS + 1200);
        }, FADE_MS + 4200);
      };
      step();
    };

    // Wait for the pictures to load, then lay them out and fade them in. A new size lays them out again.
    const loaded = pictures.map(
      ({ img }) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) resolve();
          else {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }
        }),
    );
    void Promise.all(loaded).then(() => {
      if (stopped) return;
      pictures.forEach((picture) => {
        picture.ratio = picture.img.naturalHeight / picture.img.naturalWidth || 1.15;
      });
      layout();
      pictures.forEach(({ name, img }) => {
        if (name !== 'recovery') img.classList.add('is-in');
      });
      observer = new ResizeObserver(() => {
        const { width, height } = panel.getBoundingClientRect();
        if (Math.abs(width - lastWidth) < 1 && Math.abs(height - lastHeight) < 1) return;
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(layout, 250);
      });
      observer.observe(panel);
    });

    return () => {
      stopped = true;
      observer?.disconnect();
      window.clearTimeout(timer);
      window.clearTimeout(resizeTimer);
    };
  }, [names]);

  return (
    <aside ref={panelRef} className="auth-brand" aria-hidden="true">
      {art.map((name) => (
        <img key={name} className="auth-brand__art" data-art={name} src={SOURCES[name]} alt="" draggable={false} decoding="async" />
      ))}
    </aside>
  );
}
