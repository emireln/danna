import { useEffect, useRef, type ComponentType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bot, Home, Layers, LibraryBig } from 'lucide-react';
import { useT } from '../lib/i18n/react';

const TABS: Array<{ to: string; label: string; icon: ComponentType<{ 'aria-hidden'?: boolean }>; end: boolean; ai?: boolean }> = [
  { to: '/', label: 'Today', icon: Home, end: true },
  { to: '/study', label: 'Self study', icon: LibraryBig, end: false },
  { to: '/review', label: 'Review', icon: Layers, end: false },
  { to: '/coach', label: 'Coach', icon: Bot, end: false, ai: true },
];

function BottomNav() {
  const t = useT();
  return (
    <nav className="nav" aria-label={t('Main')}>
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `nav__item ${isActive ? 'is-active' : ''}`}
          >
            <Icon aria-hidden={true} />
            <span>{t(tab.label)}</span>
            {tab.ai && <span className="nav__ai">{t('AI')}</span>}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const section = location.pathname.split('/')[1] || 'today';

  // Every new page starts at its top, including a sub-page of the same section (a skill or a report).
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="shell">
      <main className="main" ref={mainRef}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="shell__page"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
}
