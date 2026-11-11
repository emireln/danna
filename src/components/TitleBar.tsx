// The app's own title bar: the wordmark, account actions and window controls.
// On Windows it replaces the system title bar.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Bell, BookOpen, LogOut, Settings, User, Users } from 'lucide-react';
import { Avatar } from './ui';
import { bridge, type WindowState } from '../lib/bridge';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';

function useWindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!bridge) return undefined;
    bridge.window
      .state()
      .then((state: WindowState) => setMaximized(state.maximized))
      .catch(() => undefined);
    return bridge.window.onState((state) => setMaximized(state.maximized));
  }, []);

  return {
    desktop: Boolean(bridge),
    maximized,
    minimize: () => void bridge?.window.minimize(),
    toggle: () => void bridge?.window.toggleMaximize(),
    close: () => void bridge?.window.close(),
  };
}

export function TitleBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { status, mode, email, signOut } = useAuth();
  const { profile, incomingRequests, unseenShares, hasNewRelease, pictureUrl } = useAppData();
  const windows = useWindowControls();
  const [menuOpen, setMenuOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const showActions = status === 'in' && !location.pathname.startsWith('/play') && location.pathname !== '/setup';
  const name = profile?.display_name || profile?.username || 'You';
  const friendBadge = incomingRequests + unseenShares;
  const go = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="titlebar">
      <Link to="/" className="wordmark" aria-label="danna home">
        danna
      </Link>

      <div className="titlebar__spacer" onDoubleClick={() => windows.desktop && windows.toggle()} />

      {showActions && (
        <div className="titlebar__actions">
          {mode === 'supabase' && (
            <Link
              to="/friends"
              className="btn btn--icon icon-wrap"
              aria-label={friendBadge ? `Friends, ${friendBadge} waiting` : 'Friends'}
            >
              <Users />
              {friendBadge > 0 && <span className="icon-badge">{friendBadge}</span>}
            </Link>
          )}
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
              <Avatar name={name} color={profile?.avatar_color} size="sm" src={pictureUrl} />
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
                    <span className="menu__mail">{mode === 'supabase' ? (email ?? 'Online account') : 'Kept on this device'}</span>
                  </div>
                  <button className="menu__item" role="menuitem" onClick={() => go('/profile')}>
                    <User /> Profile
                  </button>
                  <button className="menu__item" role="menuitem" onClick={() => go('/library')}>
                    <BookOpen /> My library
                  </button>
                  <button className="menu__item" role="menuitem" onClick={() => go('/settings')}>
                    <Settings /> Settings
                  </button>
                  <button className="menu__item" role="menuitem" onClick={() => go('/settings')}>
                    <ArrowLeftRight /> {mode === 'supabase' ? 'Use on this device' : 'Use an online account'}
                  </button>
                  {mode === 'supabase' && (
                    <>
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
                        <LogOut /> Sign out
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {windows.desktop && (
        <div className="titlebar__controls">
          <button className="titlebar__control" onClick={windows.minimize} aria-label="Minimize">
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M0 5.5h10" />
            </svg>
          </button>
          <button className="titlebar__control" onClick={windows.toggle} aria-label={windows.maximized ? 'Restore' : 'Maximize'}>
            {windows.maximized ? (
              <svg viewBox="0 0 10 10" aria-hidden="true">
                <path d="M2.5 0.5h7v7" />
                <rect x="0.5" y="2.5" width="7" height="7" />
              </svg>
            ) : (
              <svg viewBox="0 0 10 10" aria-hidden="true">
                <rect x="0.5" y="0.5" width="9" height="9" />
              </svg>
            )}
          </button>
          <button className="titlebar__control titlebar__control--close" onClick={windows.close} aria-label="Close">
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M0 0L10 10M10 0L0 10" />
            </svg>
          </button>
        </div>
      )}
    </header>
  );
}
