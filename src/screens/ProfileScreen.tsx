import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Camera, Image as ImageIcon, Pencil, Settings2, Trash2 } from 'lucide-react';
import { Avatar, Empty, Field, FeatureCard, ProgressBar, SectionTitle, Sheet, Skeleton, Spinner } from '../components/ui';
import { errorText } from '../lib/bridge';
import { PictureError, prepareAvatar } from '../lib/avatar';
import { prepareBanner } from '../lib/banner';
import { tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { daysUntil, formatDate, levelInfo, timeAgo } from '../lib/progress';
import { bandFor, toeflRange } from '../lib/scoring';
import { SKILL_LABEL, type AttemptRow } from '../lib/types';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useToast } from '../state/toast';

export function ProfileScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { backend, mode, email, signOut } = useAuth();
  const { profile, patchProfile, pictureUrl, changePicture, bannerUrl, changeBanner } = useAppData();
  const { notify } = useToast();
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [checks, setChecks] = useState<{ count: number; rows: AttemptRow[] } | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [pictureOpen, setPictureOpen] = useState(false);
  const [pictureBusy, setPictureBusy] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [libraryCounts, setLibraryCounts] = useState<{ files: number; links: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  // The recent sessions, and the level checks: their total, and the ones that give the best results.
  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    Promise.all([backend.listAttempts(8), backend.countAttempts('diagnostic'), backend.listAttempts(200, 'diagnostic')])
      .then(([recent, count, rows]) => {
        if (!active) return;
        setAttempts(recent);
        setChecks({ count, rows });
      })
      .catch(() => {
        if (!active) return;
        setAttempts([]);
        setChecks({ count: 0, rows: [] });
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

  if (!profile) {
    return (
      <div className="page">
        <Skeleton height={300} />
      </div>
    );
  }

  const name = profile.display_name || profile.username;
  const level = levelInfo(profile.xp);
  const diagnostics = checks?.rows ?? [];
  const best = diagnostics.reduce((max, attempt) => Math.max(max, attempt.predicted ?? 0), 0);
  const bestPercent = diagnostics.reduce((max, attempt) => Math.max(max, attempt.score_pct), 0);
  const daysLeft = daysUntil(profile.exam_date);
  const libraryTotal = (libraryCounts?.files ?? 0) + (libraryCounts?.links ?? 0);

  const saveName = async () => {
    const next = nameDraft.trim();
    if (!next) return;
    setSaving(true);
    try {
      await patchProfile({ display_name: next });
      setEditing(false);
      notify(t('Name updated.'), 'ok');
    } catch (error) {
      notify(t(errorText(error)), 'error');
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
      setPictureOpen(false);
      notify(t('Picture updated.'), 'ok');
    } catch (error) {
      notify(error instanceof PictureError ? t(error.message) : t(errorText(error)), 'error');
    } finally {
      setPictureBusy(false);
    }
  };

  const removePicture = async () => {
    setPictureBusy(true);
    try {
      await changePicture(null);
      setPictureOpen(false);
      notify(t('Picture removed.'), 'ok');
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setPictureBusy(false);
    }
  };

  // A banner is cropped to a wide strip and kept small, like the picture. It can be changed offline too.
  const chooseBanner = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBannerBusy(true);
    try {
      await changeBanner(await prepareBanner(file));
      setBannerOpen(false);
      notify(t('Banner updated.'), 'ok');
    } catch (error) {
      notify(error instanceof PictureError ? t(error.message) : t(errorText(error)), 'error');
    } finally {
      setBannerBusy(false);
    }
  };

  const removeBanner = async () => {
    setBannerBusy(true);
    try {
      await changeBanner(null);
      setBannerOpen(false);
      notify(t('Banner removed.'), 'ok');
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setBannerBusy(false);
    }
  };

  const signOutNow = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const goalText = profile.goal === 'toefl' ? t('TOEFL warm-up, target {score}', { score: profile.target_score }) : t('General English');
  const setupMeta = t('{goal} · level {level} · {minutes} min a day', {
    goal: goalText,
    level: profile.level,
    minutes: profile.daily_minutes,
  });

  return (
    <div className="page">
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={choosePicture} />
      <input ref={bannerInput} type="file" accept="image/*" hidden onChange={chooseBanner} />

      <section className={`profile-hero${bannerUrl ? ' profile-hero--photo' : ''}`} aria-label={t('Your profile')}>
        <div
          className="profile-hero__backdrop"
          style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}
          aria-hidden="true"
        />
        <button className="profile-hero__banner-edit" onClick={() => setBannerOpen(true)} disabled={bannerBusy}>
          <ImageIcon aria-hidden="true" />
          {bannerUrl ? t('Edit banner') : t('Add banner')}
        </button>

        <div className="profile-hero__top">
          <div className="profile-hero__who">
            <p className="profile-hero__eyebrow">{t('Your profile')}</p>
            <div className="profile-hero__name">
              <h1 className="profile-hero__title">{name}</h1>
              <button
                className="profile-hero__icon"
                onClick={() => {
                  setNameDraft(profile.display_name);
                  setEditing(true);
                }}
                aria-label={t('Edit name')}
                title={t('Edit name')}
              >
                <Pencil aria-hidden="true" />
              </button>
            </div>
            <p className="profile-hero__meta">{mode === 'local' ? t('Kept on this device') : `@${profile.username} · ${email ?? ''}`}</p>
            <div className="profile-hero__level">
              <div className="row row--between level-row">
                <span>{t('Level {level}', { level: level.level })}</span>
                <span>{t('{into} / {span} XP', { into: level.into, span: level.span })}</span>
              </div>
              <ProgressBar value={level.percent} label={t('Level progress')} onBlue />
            </div>
          </div>

          <div className="profile-hero__picture">
            <Avatar name={name} color={profile.avatar_color} size="lg" src={pictureUrl} />
            <button
              className="profile-hero__picture-edit"
              onClick={() => setPictureOpen(true)}
              disabled={pictureBusy}
              aria-label={t('Edit picture')}
              title={t('Edit picture')}
            >
              {pictureBusy ? <Spinner dark /> : <Pencil aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="profile-hero__stats">
          <div className="profile-hero__stat">
            <span className="profile-hero__value">{profile.streak}</span>
            <span className="profile-hero__label">{t('Day streak')}</span>
          </div>
          <div className="profile-hero__stat">
            <span className="profile-hero__value">{profile.xp}</span>
            <span className="profile-hero__label">{t('Total XP')}</span>
          </div>
          <div className="profile-hero__stat">
            <span className="profile-hero__value">{checks?.count ?? 0}</span>
            <span className="profile-hero__label">{t('Level checks taken')}</span>
          </div>
          <div className="profile-hero__stat">
            {profile.goal === 'toefl' ? (
              <>
                <span className="profile-hero__value">{best ? best : '—'}</span>
                <span className="profile-hero__label">
                  {best ? t('Best TOEFL estimate · {range}', { range: toeflRange(best).join('–') }) : t('Best TOEFL estimate')}
                </span>
              </>
            ) : (
              <>
                <span className="profile-hero__value">{diagnostics.length ? bandFor(bestPercent) : '—'}</span>
                <span className="profile-hero__label">{t('Best level')}</span>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="stack mt-6">
        <FeatureCard
          icon={<Settings2 />}
          title={t('Learning setup')}
          meta={
            daysLeft !== null && daysLeft >= 0
              ? t('{base} · exam in {days}', {
                  base: setupMeta,
                  days: tn('{count} day', '{count} days', daysLeft, { count: daysLeft }),
                })
              : setupMeta
          }
          action={
            <button className="btn btn--ghost btn--sm" onClick={() => navigate('/setup')}>
              {t('Edit setup')}
            </button>
          }
        />
        <FeatureCard
          icon={<BookOpen />}
          title={t('My library')}
          meta={
            libraryTotal > 0
              ? t('{files} · {links}', {
                  files: tn('{count} file', '{count} files', libraryCounts?.files ?? 0, { count: libraryCounts?.files ?? 0 }),
                  links: tn('{count} link', '{count} links', libraryCounts?.links ?? 0, { count: libraryCounts?.links ?? 0 }),
                })
              : t('Keep your PDF, TXT and Markdown files, and learning links, in one place.')
          }
          action={
            <button className="btn btn--ghost btn--sm" onClick={() => navigate('/library')}>
              {t('Open library')}
            </button>
          }
        />
      </div>

      <SectionTitle title={t('Recent activity')} />
      {attempts === null ? (
        <Skeleton height={140} />
      ) : attempts.length === 0 ? (
        <Empty title={t('No sessions yet')}>{t('Your results will appear here after your first lesson or test.')}</Empty>
      ) : (
        <div className="set-list">
          {attempts.slice(0, 8).map((attempt) => {
            const openable = attempt.kind === 'diagnostic' || attempt.kind === 'mock';
            const skillScores = Object.entries(attempt.skills)
              .map(([skill, score]) => `${t(SKILL_LABEL[skill as keyof typeof SKILL_LABEL])} ${score}`)
              .slice(0, 3);
            const detail = [formatDate(attempt.created_at), timeAgo(attempt.created_at), ...skillScores].join(' · ');
            const content = (
              <>
                <span className="set-row__body">
                  <span className="set-row__title">{t(attempt.title)}</span>
                  <span className="set-row__meta">{detail}</span>
                </span>
                <span className="chip">{attempt.predicted ? `${attempt.predicted} / 120` : `${attempt.score_pct}%`}</span>
              </>
            );
            return openable ? (
              <button key={attempt.id} className="set-row" onClick={() => navigate(`/report/${attempt.id}`)}>
                {content}
              </button>
            ) : (
              <div key={attempt.id} className="set-row set-row--static">
                {content}
              </div>
            );
          })}
        </div>
      )}

      <SectionTitle title={t('Account')} />
      <div className="settings-row">
        <div className="settings-row__body">
          <div className="settings-row__title">{mode === 'local' ? t('On this device') : (email ?? t('Signed in'))}</div>
          <div className="settings-row__text">
            {mode === 'local' ? t('Your progress stays on this device.') : t('Your progress is saved to your account.')}
          </div>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={signOutNow}>
          {mode === 'local' ? t('Switch mode') : t('Sign out')}
        </button>
      </div>

      {pictureOpen && (
        <Sheet
          title={t('Profile picture')}
          onClose={() => setPictureOpen(false)}
          footer={
            <button className="btn btn--ghost" onClick={() => setPictureOpen(false)} disabled={pictureBusy}>
              {t('Close')}
            </button>
          }
        >
          <div className="stack">
            <div className="picture-preview">
              <Avatar name={name} color={profile.avatar_color} size="lg" src={pictureUrl} />
            </div>
            <div className="stack--tight">
              <button className="btn btn--primary btn--block" onClick={() => fileInput.current?.click()} disabled={pictureBusy}>
                {pictureBusy ? <Spinner /> : <Camera aria-hidden="true" />} {pictureUrl ? t('Change picture') : t('Add picture')}
              </button>
              {pictureUrl && (
                <button className="btn btn--ghost btn--block" onClick={removePicture} disabled={pictureBusy}>
                  <Trash2 aria-hidden="true" /> {t('Remove picture')}
                </button>
              )}
            </div>
            <p className="small muted">{t('A picture is cropped to a square and kept small.')}</p>
          </div>
        </Sheet>
      )}

      {bannerOpen && (
        <Sheet
          title={t('Profile banner')}
          onClose={() => setBannerOpen(false)}
          footer={
            <button className="btn btn--ghost" onClick={() => setBannerOpen(false)} disabled={bannerBusy}>
              {t('Close')}
            </button>
          }
        >
          <div className="stack">
            <div className="banner-preview" style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}>
              {!bannerUrl && <span>{t('No banner yet')}</span>}
            </div>
            <div className="stack--tight">
              <button className="btn btn--primary btn--block" onClick={() => bannerInput.current?.click()} disabled={bannerBusy}>
                {bannerBusy ? <Spinner /> : <ImageIcon aria-hidden="true" />} {bannerUrl ? t('Change banner') : t('Add banner')}
              </button>
              {bannerUrl && (
                <button className="btn btn--ghost btn--block" onClick={removeBanner} disabled={bannerBusy}>
                  <Trash2 aria-hidden="true" /> {t('Remove banner')}
                </button>
              )}
            </div>
            <p className="small muted">{t('Use a wide picture. It is cropped to a strip and kept small.')}</p>
          </div>
        </Sheet>
      )}

      {editing && (
        <Sheet
          title={t('Your name')}
          onClose={() => setEditing(false)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => setEditing(false)} disabled={saving}>
                {t('Cancel')}
              </button>
              <button className="btn btn--primary" onClick={saveName} disabled={saving || !nameDraft.trim()}>
                {saving ? <Spinner /> : null} {t('Save name')}
              </button>
            </>
          }
        >
          <Field label={t('Display name')} hint={t('Shown to friends. Your username stays the same.')}>
            <input className="input" value={nameDraft} maxLength={40} onChange={(event) => setNameDraft(event.target.value)} />
          </Field>
        </Sheet>
      )}
    </div>
  );
}
