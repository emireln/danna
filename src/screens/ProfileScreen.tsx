import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Camera, Pencil, Settings2 } from 'lucide-react';
import { Avatar, Empty, Field, ProgressBar, Sheet, Skeleton, Spinner } from '../components/ui';
import { errorText } from '../lib/bridge';
import { PictureError, prepareAvatar } from '../lib/avatar';
import { daysUntil, formatDate, levelInfo, timeAgo } from '../lib/progress';
import { toeflRange } from '../lib/scoring';
import { SKILL_LABEL, type AttemptRow } from '../lib/types';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useToast } from '../state/toast';

export function ProfileScreen() {
  const navigate = useNavigate();
  const { backend, mode, email, signOut } = useAuth();
  const { profile, patchProfile, pictureUrl, changePicture } = useAppData();
  const { notify } = useToast();
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [pictureBusy, setPictureBusy] = useState(false);
  const [libraryCounts, setLibraryCounts] = useState<{ files: number; links: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    backend
      .listAttempts(40)
      .then((rows) => {
        if (active) setAttempts(rows);
      })
      .catch(() => {
        if (active) setAttempts([]);
      });
    return () => {
      active = false;
    };
  }, [backend]);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    Promise.all([backend.listLibraryFiles(), backend.listLibraryLinks()])
      .then(([files, links]) => {
        if (active) setLibraryCounts({ files: files.length, links: links.length });
      })
      .catch(() => {
        if (active) setLibraryCounts({ files: 0, links: 0 });
      });
    return () => {
      active = false;
    };
  }, [backend]);

  if (!profile) return <div className="page"><Skeleton height={300} /></div>;

  const name = profile.display_name || profile.username;
  const level = levelInfo(profile.xp);
  const diagnostics = (attempts ?? []).filter((attempt) => attempt.kind === 'diagnostic');
  const best = diagnostics.reduce((max, attempt) => Math.max(max, attempt.predicted ?? 0), 0);
  const daysLeft = daysUntil(profile.exam_date);

  const saveName = async () => {
    const next = nameDraft.trim();
    if (!next) return;
    setSaving(true);
    try {
      await patchProfile({ display_name: next });
      setEditing(false);
      notify('Name updated.', 'ok');
    } catch (error) {
      notify(errorText(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Picture changes work offline too: they are saved on this device, or sent to the account when online.
  const choosePicture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPictureBusy(true);
    try {
      await changePicture(await prepareAvatar(file));
      notify('Picture updated.', 'ok');
    } catch (error) {
      notify(error instanceof PictureError ? error.message : errorText(error), 'error');
    } finally {
      setPictureBusy(false);
    }
  };

  const removePicture = async () => {
    setPictureBusy(true);
    try {
      await changePicture(null);
      notify('Picture removed.', 'ok');
    } catch (error) {
      notify(errorText(error), 'error');
    } finally {
      setPictureBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="profile-head">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <Avatar name={name} color={profile.avatar_color} size="lg" src={pictureUrl} />
          <button className="btn btn--ghost btn--sm" onClick={() => fileInput.current?.click()} disabled={pictureBusy}>
            {pictureBusy ? <Spinner dark /> : <Camera />} {pictureUrl ? 'Change picture' : 'Add picture'}
          </button>
          {pictureUrl && (
            <button className="btn--text small" style={{ color: 'var(--muted)' }} onClick={removePicture} disabled={pictureBusy}>
              Remove picture
            </button>
          )}
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={choosePicture} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{name}</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            {mode === 'local' ? 'Kept on this device' : `@${profile.username} · ${email ?? ''}`}
          </p>
          <div style={{ marginTop: 12, maxWidth: 380 }}>
            <div className="row row--between small" style={{ marginBottom: 6, fontWeight: 600 }}>
              <span>Level {level.level}</span>
              <span className="muted">
                {level.into} / {level.span} XP
              </span>
            </div>
            <ProgressBar value={level.percent} label="Level progress" />
          </div>
        </div>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => {
            setNameDraft(profile.display_name);
            setEditing(true);
          }}
        >
          <Pencil /> Edit name
        </button>
      </div>

      <div className="grid-4" style={{ marginTop: 24 }}>
        <div className="stat">
          <span className="stat__value">{profile.streak}</span>
          <span className="stat__label">Day streak</span>
        </div>
        <div className="stat">
          <span className="stat__value">{profile.xp}</span>
          <span className="stat__label">Total XP</span>
        </div>
        <div className="stat">
          <span className="stat__value">{diagnostics.length}</span>
          <span className="stat__label">Diagnostics taken</span>
        </div>
        <div className="stat">
          <span className="stat__value">{best ? best : '—'}</span>
          <span className="stat__label">{best ? `Best estimate · ${toeflRange(best).join('–')}` : 'Best estimate'}</span>
        </div>
      </div>

      <section className="card" style={{ marginTop: 22, display: 'flex', gap: 16, alignItems: 'center' }}>
        <span className="icon-tile icon-tile--sm">
          <Settings2 />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>Learning setup</h3>
          <p className="small muted">
            Target {profile.target_score} · level {profile.level} · {profile.daily_minutes} min a day
            {daysLeft !== null && daysLeft >= 0 ? ` · exam in ${daysLeft} days` : ''}
          </p>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/setup')}>
          Edit setup
        </button>
      </section>

      <section className="card" style={{ marginTop: 22, display: 'flex', gap: 16, alignItems: 'center' }}>
        <span className="icon-tile icon-tile--sm">
          <BookOpen />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>My library</h3>
          <p className="small muted">
            {libraryCounts && libraryCounts.files + libraryCounts.links > 0
              ? `${libraryCounts.files} files · ${libraryCounts.links} links`
              : 'Keep your PDF, TXT and Markdown files, and learning links, in one place.'}
          </p>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/library')}>
          Open library
        </button>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ marginBottom: 12 }}>Recent activity</h2>
        {attempts === null ? (
          <Skeleton height={140} />
        ) : attempts.length === 0 ? (
          <Empty title="No sessions yet">Your results will appear here after your first lesson or test.</Empty>
        ) : (
          <div className="set-list">
            {attempts.slice(0, 8).map((attempt) => (
              <button
                key={attempt.id}
                className="set-row"
                onClick={() => (attempt.kind === 'diagnostic' || attempt.kind === 'mock' ? navigate(`/report/${attempt.id}`) : undefined)}
                style={attempt.kind === 'diagnostic' || attempt.kind === 'mock' ? undefined : { cursor: 'default' }}
              >
                <span className="set-row__body">
                  <span className="set-row__title" style={{ display: 'block', fontSize: 15 }}>
                    {attempt.title}
                  </span>
                  <span className="set-row__meta" style={{ display: 'block' }}>
                    {formatDate(attempt.created_at)} · {timeAgo(attempt.created_at)} ·{' '}
                    {Object.entries(attempt.skills)
                      .map(([skill, score]) => `${SKILL_LABEL[skill as keyof typeof SKILL_LABEL]} ${score}`)
                      .slice(0, 3)
                      .join(' · ')}
                  </span>
                </span>
                <span className="chip">{attempt.predicted ? `${attempt.predicted} / 120` : `${attempt.score_pct}%`}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 28 }} className="row row--between">
        <div>
          <h3>Account</h3>
          <p className="small muted">
            {mode === 'local'
              ? 'Your progress stays on this device.'
              : 'Your progress is saved to your account.'}
          </p>
        </div>
        <button
          className="btn btn--danger btn--sm"
          onClick={async () => {
            await signOut();
            navigate('/auth', { replace: true });
          }}
        >
          {mode === 'local' ? 'Switch mode' : 'Sign out'}
        </button>
      </section>

      {editing && (
        <Sheet
          title="Your name"
          onClose={() => setEditing(false)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={saveName} disabled={saving || !nameDraft.trim()}>
                {saving ? <Spinner /> : null} Save
              </button>
            </>
          }
        >
          <Field label="Display name" hint="Shown to friends. Your username stays the same.">
            <input className="input" value={nameDraft} maxLength={40} onChange={(event) => setNameDraft(event.target.value)} />
          </Field>
        </Sheet>
      )}
    </div>
  );
}
