import { useEffect, useRef, useState, type ComponentType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Bot, Home, Layers, LibraryBig, LogOut, Settings, User, Users } from 'lucide-react';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { Avatar, BrandMark } from './ui';

function TopBar() {
  const navigate = useNavigate();
  const { mode, email, signOut } = useAuth();
  const { profile, incomingRequests, unseenShares, hasNewRelease } = useAppData();
  const [menuOpen, setMenuOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const name = profile?.display_name || profile?.username || 'You';
  const friendBadge = incomingRequests + unseenShares;

  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="danna home">
        <BrandMark />
        <span>danna</span>
      </Link>
      <div className="topbar__actions">
        <Link
          to="/friends"
          className="btn btn--icon icon-wrap"
          aria-label={friendBadge ? `Friends, ${friendBadge} waiting` : 'Friends'}
        >
          <Users />
          {friendBadge > 0 && <span className="icon-badge">{friendBadge}</span>}
        </Link>
        <Link to="/whats-new" className="btn btn--icon icon-wrap" aria-label="What's new">
          <Bell />
          {hasNewRelease && <span className="dot-badge" aria-hidden="true" />}
        </Link>
        <div className="menu-anchor" ref={anchor}>
          <button
            className="avatar-btn"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
          >
            <Avatar name={name} color={profile?.avatar_color} size="sm" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                className="menu"
                role="menu"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
              >
                <div className="menu__head">
                  <span className="menu__name">{name}</span>
                  <span className="menu__mail">{mode === 'local' ? 'Offline profile on this device' : email}</span>
                </div>
                <button
                  className="menu__item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/profile');
                  }}
                >
                  <User /> Profile
                </button>
                <button
                  className="menu__item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/settings');
                  }}
                >
                  <Settings /> Settings and AI
                </button>
                <div className="menu__sep" />
                <button
                  className="menu__item menu__item--danger"
                  role="menuitem"
                  onClick={async () => {
                    setMenuOpen(false);
                    await signOut();
                    navigate('/auth', { replace: true });
                  }}
                >
                  <LogOut /> {mode === 'local' ? 'Leave offline mode' : 'Sign out'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

const TABS: Array<{ to: string; label: string; icon: ComponentType<{ 'aria-hidden'?: boolean }>; end: boolean; ai?: boolean }> = [
  { to: '/', label: 'Today', icon: Home, end: true },
  { to: '/study', label: 'Self study', icon: LibraryBig, end: false },
  { to: '/review', label: 'Review', icon: Layers, end: false },
  { to: '/coach', label: 'Coach', icon: Bot, end: false, ai: true },
];

function BottomNav() {
  return (
    <nav className="nav" aria-label="Main">
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
            <span>{tab.label}</span>
            {tab.ai && <span className="nav__ai">AI</span>}
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

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [section]);

  return (
    <div className="shell">
      <TopBar />
      <main className="main" ref={mainRef}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ minHeight: '100%' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
}
