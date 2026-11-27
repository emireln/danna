import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { AuthBrand } from '../components/AuthBrand';
import { GoogleMark } from '../components/GoogleMark';
import { Field, Notice, Sheet, Spinner, Wordmark } from '../components/ui';
import { errorText } from '../lib/bridge';
import { copyProgress, hasLocalProgress } from '../lib/migrate';
import { backendFor, onlineAvailable } from '../lib/session';
import { returnPath } from '../lib/navigation';
import { useT } from '../lib/i18n/react';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';

interface AuthRouteState {
  /** Where to go after signing in, set by the screen that asked for an account. */
  next?: string;
  /** The page the person was on when the sign-in was required, set by the route guard. */
  from?: string;
  switchingFrom?: 'local';
}

type Form = 'signin' | 'signup' | 'forgot';

export function AuthScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const { status, mode: accountMode, signIn, signUp, requestPasswordReset, signInWithGoogle, googleError, dismissGoogleError, useOffline } = useAuth();
  const { refresh, refreshSocial } = useAppData();
  const routeState = (location.state ?? {}) as AuthRouteState;
  const next = returnPath(routeState.next ?? routeState.from);
  const online = onlineAvailable();

  const [mode, setMode] = useState<Form>('signin');
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

  // Moves to another form and clears what the last one said
  function switchForm(target: Form) {
    setMode(target);
    setError(null);
    setInfo(null);
    dismissGoogleError();
  }

  // Opens the Google sign-in page in the browser. The browser brings the person back to the app, which takes it from there.
  async function startGoogle() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (caught) {
      setError(t(errorText(caught)));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    dismissGoogleError();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t('Enter a valid email address.'));
      return;
    }
    if (mode === 'forgot') {
      setBusy(true);
      try {
        await requestPasswordReset(email);
        setInfo(t('If there is an account for this email, we sent a link to choose a new password. It can take a few minutes to arrive.'));
      } catch (caught) {
        setError(t(errorText(caught)));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (password.length < 8) {
      setError(t('Use at least 8 characters for your password.'));
      return;
    }
    if (mode === 'signup' && !/^[a-z0-9_]{3,20}$/.test(username)) {
      setError(t('Choose a username with 3 to 20 lowercase letters, numbers or underscores.'));
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
          setInfo(t('Check your inbox to confirm your email, then sign in.'));
          return;
        }
      }
      if (!movable) navigate(next, { replace: true });
    } catch (caught) {
      setOfferMove(false);
      setError(t(errorText(caught)));
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
      setError(t(errorText(caught)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <AuthBrand />

      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card__inner">
          <Wordmark className="wordmark--xl" />
          <h1 className="auth-title" id="auth-title">
            {mode === 'forgot' ? t('Reset your password') : mode === 'signin' ? t('Welcome back') : t('Create your account')}
          </h1>

          {!online ? (
            <>
              <Notice tone="info">{t('Online accounts are not available right now. You can keep learning on this device.')}</Notice>
              <button
                className="btn btn--primary btn--block"
                onClick={() => {
                  useOffline();
                  navigate('/', { replace: true });
                }}
              >
                {t('Continue on this device')}
              </button>
            </>
          ) : (
            <>
              {mode !== 'forgot' && (
                <>
                  <button className="btn btn--ghost btn--block btn--google" type="button" disabled={busy} onClick={() => void startGoogle()}>
                    <span className="btn__mark">
                      <GoogleMark />
                    </span>
                    <span>{t('Continue with Google')}</span>
                  </button>
                  <div className="divider-row" aria-hidden="true">
                    <span className="divider" />
                    <span>{t('or')}</span>
                    <span className="divider" />
                  </div>
                </>
              )}

              <form className="stack" onSubmit={submit} noValidate>
                <Field label={t('Email')}>
                  <input
                    className="input"
                    type="email"
                    autoComplete="email"
                    value={email}
                    disabled={busy}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t('you@example.com')}
                  />
                </Field>
                {mode === 'signup' && (
                  <Field label={t('Username')}>
                    <input
                      className="input"
                      autoComplete="username"
                      value={username}
                      disabled={busy}
                      onChange={(event) => setUsername(event.target.value.toLowerCase())}
                      placeholder={t('your_name')}
                      maxLength={20}
                    />
                  </Field>
                )}
                {mode !== 'forgot' && (
                  <Field label={t('Password')}>
                    <span className="input-wrap">
                      <input
                        className="input"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                        value={password}
                        disabled={busy}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={t('At least 8 characters')}
                      />
                      <button
                        type="button"
                        className="btn btn--icon"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? t('Hide password') : t('Show password')}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </span>
                  </Field>
                )}
                {mode === 'signin' && (
                  <button
                    type="button"
                    className="link-button"
                    disabled={busy}
                    onClick={() => {
                      setMode('forgot');
                      setPassword('');
                      setError(null);
                      setInfo(null);
                      dismissGoogleError();
                    }}
                  >
                    {t('Forgot your password?')}
                  </button>
                )}

                {error && <Notice tone="error">{error}</Notice>}
                {info && <Notice tone="info">{info}</Notice>}
                {googleError && <Notice tone="error">{t(googleError)}</Notice>}

                <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
                  {busy ? <Spinner /> : mode === 'forgot' ? t('Send reset link') : mode === 'signin' ? t('Sign in') : t('Create account')}
                </button>
              </form>

              {mode === 'forgot' && (
                <button className="btn btn--ghost btn--block" type="button" disabled={busy} onClick={() => switchForm('signin')}>
                  {t('Back to sign in')}
                </button>
              )}

              <p className="auth-foot">
                {mode === 'signin' && (
                  <>
                    {t('New here?')}{' '}
                    <button type="button" className="link-button" disabled={busy} onClick={() => switchForm('signup')}>
                      {t('Create an account')}
                    </button>
                  </>
                )}
                {mode === 'signup' && (
                  <>
                    {t('Already have an account?')}{' '}
                    <button type="button" className="link-button" disabled={busy} onClick={() => switchForm('signin')}>
                      {t('Sign in')}
                    </button>
                  </>
                )}
              </p>

              <button
                className="btn btn--ghost btn--block"
                disabled={busy}
                onClick={() => {
                  useOffline();
                  navigate('/', { replace: true });
                }}
              >
                {t('Continue on this device')}
              </button>
            </>
          )}
        </div>
      </section>

      {offerMove && (
        <Sheet
          title={t('Bring your progress along?')}
          onClose={() => void finishMove(false)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => void finishMove(false)} disabled={busy}>
                {t('Switch without copying')}
              </button>
              <button className="btn btn--primary" onClick={() => void finishMove(true)} disabled={busy}>
                {busy ? <Spinner /> : null} {t('Bring it along')}
              </button>
            </>
          }
        >
          <p className="muted">
            {t('Lessons, scores, library files and review items from this device can be added to your account.')}
          </p>
        </Sheet>
      )}
    </div>
  );
}
