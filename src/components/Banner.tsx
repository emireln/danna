import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { bridge } from '../lib/bridge';
import type { AnnouncementRow } from '../lib/types';

/** In-app routes (starting with /) navigate; https links open in the browser. */
export function openLink(url: string, navigate: (to: string) => void): void {
  if (url.startsWith('/')) {
    navigate(url);
    return;
  }
  if (!/^https:\/\//i.test(url)) return;
  if (bridge) void bridge.openExternal(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

function BannerArt() {
  return (
    <svg className="banner__art" viewBox="0 0 220 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="1.5">
        <circle cx="150" cy="82" r="44" />
        <circle cx="150" cy="82" r="72" />
        <circle cx="150" cy="82" r="100" />
        <path d="M0 150C48 112 96 176 220 128" />
      </g>
      <circle cx="150" cy="82" r="9" fill="rgba(255,255,255,0.92)" />
    </svg>
  );
}

export function BannerCarousel({ items }: { items: AnnouncementRow[] }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  // The carousel waits while the person points at it or works inside it, so a message can be read or used.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (items.length < 2 || paused) return undefined;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % items.length), 7000);
    return () => window.clearInterval(timer);
  }, [items.length, paused]);

  const current = items[Math.min(index, items.length - 1)];
  if (!current) return null;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.section
        key={current.id}
        className={`banner banner--${current.accent}`}
        aria-label="Announcement"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="banner__body" style={{ paddingBottom: items.length > 1 ? 30 : undefined }}>
          <h2 className="banner__title">{current.title}</h2>
          {current.body && <p className="banner__text">{current.body.split('\n')[0].replace(/^- /, '')}</p>}
          {current.cta_label && current.cta_url && (
            <button className="btn btn--white" onClick={() => openLink(current.cta_url ?? '', navigate)}>
              {current.cta_label}
            </button>
          )}
        </div>
        <div className="banner__media">
          {current.image_url ? <img src={current.image_url} alt="" /> : <BannerArt />}
        </div>
        {items.length > 1 && (
          <div className="dots" aria-hidden="true">
            {items.map((item, position) => (
              <span key={item.id} className={position === index ? 'is-active' : ''} />
            ))}
          </div>
        )}
      </motion.section>
    </AnimatePresence>
  );
}
