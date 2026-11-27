import { useEffect } from 'react';
import { Empty, PageHeader } from '../components/ui';
import { useT, type Translate } from '../lib/i18n/react';
import { formatLongDate } from '../lib/progress';
import { isVersionAtLeast } from '../lib/version';
import type { AnnouncementRow } from '../lib/types';
import { useAppData } from '../state/appData';

// The notes of V2 start at 2.0.0. They are shown first and highlighted; the older notes follow them.
const V2_FROM = '2.0.0';

function ReleaseBody({ body, t }: { body: string; t: Translate }) {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets = lines.filter((line) => line.startsWith('- ')).map((line) => line.slice(2));
  const paragraphs = lines.filter((line) => !line.startsWith('- '));
  return (
    <>
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="release__text">
          {t(paragraph)}
        </p>
      ))}
      {bullets.length > 0 && (
        <ul>
          {bullets.map((item) => (
            <li key={item}>{t(item)}</li>
          ))}
        </ul>
      )}
    </>
  );
}

function ReleaseArticle({ release, t, highlight }: { release: AnnouncementRow; t: Translate; highlight: boolean }) {
  return (
    <article className={highlight ? 'release release--v2' : 'release'}>
      <div>
        <span className="release__pill">{release.version ? `v${release.version}` : t('Update')}</span>
        <div className="release__version">{formatLongDate(release.created_at)}</div>
      </div>
      <div>
        <h2>{t(release.title)}</h2>
        <div className="mt-2">
          <ReleaseBody body={release.body} t={t} />
        </div>
      </div>
    </article>
  );
}

export function WhatsNewScreen() {
  const t = useT();
  const { releases, markReleaseSeen } = useAppData();

  useEffect(() => {
    markReleaseSeen();
  }, [markReleaseSeen]);

  const isV2 = (release: AnnouncementRow) => Boolean(release.version && isVersionAtLeast(release.version, V2_FROM));
  const v2 = releases.filter(isV2);
  const earlier = releases.filter((release) => !isV2(release));

  return (
    <div className="page">
      <PageHeader title={t("What's new")} />

      {releases.length === 0 ? (
        <Empty title={t('No release notes yet')}>{t('New features and fixes will appear here.')}</Empty>
      ) : (
        <>
          {v2.length > 0 && (
            <section className="release-group" aria-labelledby="release-group-v2">
              <div className="release-group__head">
                <span className="release-group__badge">V2</span>
                <h2 id="release-group-v2" className="release-group__title">
                  {t('Version 2')}
                </h2>
              </div>
              <p className="release-group__text">
                {t('Everything new in version 2, from the looks and decks to the writing check.')}
              </p>
              {v2.map((release) => (
                <ReleaseArticle key={release.id} release={release} t={t} highlight />
              ))}
            </section>
          )}
          {earlier.length > 0 && (
            <section className="release-group" aria-labelledby="release-group-earlier">
              <h2 id="release-group-earlier" className="release-group__title">
                {t('Earlier versions')}
              </h2>
              {earlier.map((release) => (
                <ReleaseArticle key={release.id} release={release} t={t} highlight={false} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
