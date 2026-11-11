import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Field, BrandMark, Notice, Spinner } from '../components/ui';
import { errorText } from '../lib/bridge';
import { supabaseConfigured } from '../lib/supabase';
import { useAuth } from '../state/auth';

export function AuthScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, signIn, signUp, useOffline } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  useEffect(() => {
    if (status === 'in') navigate(from, { replace: true });
  }, [status, from, navigate]);

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
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password, username);
        if (result.confirmEmail) setInfo('Check your inbox to confirm your email, then sign in.');
      }
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth-hero">
          <BrandMark size={44} />
          <div>
            <h1>{mode === 'signin' ? 'Sign in to danna' : 'Create your account'}</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              Practise for TOEFL with a plan that adapts to what you get wrong.
            </p>
          </div>
        </div>

        <div className="segmented" role="tablist" aria-label="Account" style={{ alignSelf: 'stretch' }}>
          <button
            role="tab"
            aria-selected={mode === 'signin'}
            className="segmented__btn"
            style={{ flex: 1 }}
            onClick={() => setMode('signin')}
          >
            Sign in
          </button>
          <button
            role="tab"
            aria-selected={mode === 'signup'}
            className="segmented__btn"
            style={{ flex: 1 }}
            onClick={() => setMode('signup')}
          >
            Create account
          </button>
        </div>

        {!supabaseConfigured && (
          <Notice>
            Accounts, friends and sharing need Supabase. Add your project keys to <code>.env</code> to turn them on. Offline
            mode works now.
          </Notice>
        )}

        <form className="stack" onSubmit={submit} noValidate>
          <Field label="Email">
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              disabled={!supabaseConfigured || busy}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          {mode === 'signup' && (
            <Field label="Username" hint="Friends find you by this name. 3 to 20 characters.">
              <input
                className="input"
                autoComplete="username"
                value={username}
                disabled={!supabaseConfigured || busy}
                onChange={(event) => setUsername(event.target.value.toLowerCase())}
                placeholder="your_name"
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
                disabled={!supabaseConfigured || busy}
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

          <button className="btn btn--primary btn--block" type="submit" disabled={!supabaseConfigured || busy}>
            {busy ? <Spinner /> : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="row" style={{ gap: 12 }}>
          <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          <span className="small muted">or</span>
          <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>

        <button
          className="btn btn--ghost btn--block"
          disabled={busy}
          onClick={() => {
            useOffline();
          }}
        >
          Use danna offline on this device
        </button>
        <p className="small muted" style={{ textAlign: 'center' }}>
          <Lock aria-hidden="true" style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> Your AI keys are encrypted on
          this device and never sent to danna.
        </p>
      </div>
    </div>
  );
}
