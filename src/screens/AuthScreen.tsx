import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { BrandMark, Field, Notice, Sheet, Spinner, Tabs, Wordmark } from '../components/ui';
import { errorText } from '../lib/bridge';
import { copyProgress, hasLocalProgress } from '../lib/migrate';
import { backendFor, onlineAvailable } from '../lib/session';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';

interface AuthRouteState {
  next?: string;
  switchingFrom?: 'local';
}

export function AuthScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, mode: accountMode, signIn, signUp, useOffline } = useAuth();
  const { refresh, refreshSocial } = useAppData();
  const routeState = (location.state ?? {}) as AuthRouteState;
  const next = routeState.next ?? '/';
  const online = onlineAvailable();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [offerMove, setOfferMove] = useState(false);

  useEffect(() => {
    // Only a signed-in online account leaves this screen on its own. On this device the
    // person may be here on purpose, to switch to an account.
    if (status === 'in' && accountMode === 'supabase' && !offerMove) navigate(next, { replace: true });
  }, [status, accountMode, offerMove, next, navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (mode === 'signup' && !/^[a-z0-9_]{3,20}$/.test(username)) {
      setError('Choose a username with 3 to 20 lowercase letters, numbers or underscores.');
      return;
    }
    setBusy(true);
    try {
      const movable = routeState.switchingFrom === 'local' ? await hasLocalProgress(backendFor('local')) : false;
      if (movable) setOfferMove(true);
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password, username);
        if (result.confirmEmail) {
          setOfferMove(false);
          setInfo('Check your inbox to confirm your email, then sign in.');
          return;
        }
      }
      if (!movable) navigate(next, { replace: true });
    } catch (caught) {
      setOfferMove(false);
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function finishMove(keepCopy: boolean) {
    setBusy(true);
    try {
      if (keepCopy) await copyProgress(backendFor('local'), backendFor('supabase'));
      await refresh();
      await refreshSocial();
      setOfferMove(false);
      navigate(next, { replace: true });
    } catch (caught) {
      setOfferMove(false);
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth-hero">
          <BrandMark size={52} />
          <Wordmark className="wordmark--xl" />
          <div>
            <h1>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
            <p className="muted mt-2">
              Your progress syncs across your devices.
            </p>
          </div>
        </div>

        {!online ? (
          <>
            <Notice tone="info">Online accounts are not available right now. You can keep learning on this device.</Notice>
            <button
              className="btn btn--primary btn--block"
              onClick={() => {
                useOffline();
                navigate('/', { replace: true });
              }}
            >
              Continue on this device
            </button>
          </>
        ) : (
          <>
            <Tabs
              block
              label="Account"
              value={mode}
              onChange={setMode}
              items={[
                { value: 'signin', label: 'Sign in' },
                { value: 'signup', label: 'Create account' },
              ]}
            />

            <form className="stack" onSubmit={submit} noValidate>
              <Field label="Email">
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  disabled={busy}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              {mode === 'signup' && (
                <Field label="Username" hint="Friends find you by this name.">
                  <input
                    className="input"
                    autoComplete="username"
                    value={username}
                    disabled={busy}
                    onChange={(event) => setUsername(event.target.value.toLowerCase())}
                    placeholder="your_name"
                    maxLength={20}
                  />
                </Field>
              )}
              <Field label="Password">
                <span className="input-wrap">
                  <input
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    value={password}
                    disabled={busy}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    className="btn btn--icon"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </span>
              </Field>

              {error && <Notice tone="error">{error}</Notice>}
              {info && <Notice tone="info">{info}</Notice>}

              <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
                {busy ? <Spinner /> : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <div className="divider-row">
              <span className="divider" />
              <span className="small muted">or</span>
              <span className="divider" />
            </div>

            <button
              className="btn btn--ghost btn--block"
              disabled={busy}
              onClick={() => {
                useOffline();
                navigate('/', { replace: true });
              }}
            >
              Continue on this device
            </button>
          </>
        )}
      </div>

      {offerMove && (
        <Sheet
          title="Bring your progress along?"
          onClose={() => void finishMove(false)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => void finishMove(false)} disabled={busy}>
                Switch without copying
              </button>
              <button className="btn btn--primary" onClick={() => void finishMove(true)} disabled={busy}>
                {busy ? <Spinner /> : null} Bring it along
              </button>
            </>
          }
        >
          <p className="muted">Lessons, scores, library files and review items from this device can be added to your account.</p>
        </Sheet>
      )}
    </div>
  );
}
