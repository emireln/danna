import { useLayoutEffect, useRef, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bot, Home, Layers, LibraryBig } from 'lucide-react';
import { useT } from '../lib/i18n/react';
import { GuidedTour } from './Tour';
import { ReminderSync } from './ReminderSync';

// tour names the button for the guided tour (see Tour.tsx).
const TABS: Array<{ to: string; label: string; icon: ComponentType<{ 'aria-hidden'?: boolean }>; end: boolean; ai?: boolean; tour: string }> = [
  { to: '/', label: 'Today', icon: Home, end: true, tour: 'today' },
  { to: '/study', label: 'Self study', icon: LibraryBig, end: false, tour: 'study' },
  { to: '/review', label: 'Review', icon: Layers, end: false, tour: 'review' },
  { to: '/coach', label: 'Coach', icon: Bot, end: false, ai: true, tour: 'coach' },
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
            data-tour={tab.tour}
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
  // It runs before the frame is painted, so the page never shows at the old scroll position first.
  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="shell">
      <main className="main" ref={mainRef}>
        {/* A section fades in with a CSS animation when it opens. Nothing waits for the old page to leave first, and
            nothing is animated in JavaScript while the new page mounts, so the change does not stutter. */}
        <div key={section} className="shell__page">
          <Outlet />
        </div>
      </main>
      <BottomNav />
      <GuidedTour />
      <ReminderSync />
    </div>
  );
}
