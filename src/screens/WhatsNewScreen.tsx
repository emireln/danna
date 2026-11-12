import { useEffect } from 'react';
import { BannerCarousel } from '../components/Banner';
import { Empty, PageHeader } from '../components/ui';
import { useT, type Translate } from '../lib/i18n/react';
import { formatLongDate } from '../lib/progress';
import { useAppData } from '../state/appData';

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

export function WhatsNewScreen() {
  const t = useT();
  const { banners, releases, markReleaseSeen } = useAppData();

  useEffect(() => {
    markReleaseSeen();
  }, [markReleaseSeen]);

  return (
    <div className="page">
      <PageHeader eyebrow={t('Updates')} title={t("What's new")} />

      {banners.length > 0 && (
        <div className="mb-4">
          <BannerCarousel items={banners} />
        </div>
      )}

      {releases.length === 0 ? (
        <Empty title={t('No release notes yet')}>{t('New features and fixes will appear here.')}</Empty>
      ) : (
        <div>
          {releases.map((release) => (
            <article key={release.id} className="release">
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
          ))}
        </div>
      )}
    </div>
  );
}
