import { useEffect } from 'react';
import { BannerCarousel } from '../components/Banner';
import { Empty } from '../components/ui';
import { formatLongDate } from '../lib/progress';
import { useAppData } from '../state/appData';

function ReleaseBody({ body }: { body: string }) {
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
  const bullets = lines.filter((line) => line.startsWith('- ')).map((line) => line.slice(2));
  const paragraphs = lines.filter((line) => !line.startsWith('- '));
  return (
    <>
      {paragraphs.map((paragraph) => (
        <p key={paragraph} style={{ color: 'var(--ink-2)' }}>
          {paragraph}
        </p>
      ))}
      {bullets.length > 0 && (
        <ul>
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </>
  );
}

export function WhatsNewScreen() {
  const { banners, releases, markReleaseSeen } = useAppData();

  useEffect(() => {
    markReleaseSeen();
  }, [markReleaseSeen]);

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <p className="eyebrow">Updates</p>
          <h1 style={{ marginTop: 4 }}>What&apos;s new</h1>
        </div>
      </div>

      {banners.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <BannerCarousel items={banners} />
        </div>
      )}

      {releases.length === 0 ? (
        <Empty title="No release notes yet">New features and fixes will appear here.</Empty>
      ) : (
        <div>
          {releases.map((release) => (
            <article key={release.id} className="release">
              <div>
                <span className="release__pill">{release.version ? `v${release.version}` : 'Update'}</span>
                <div className="release__version">{formatLongDate(release.created_at)}</div>
              </div>
              <div>
                <h2>{release.title}</h2>
                <div style={{ marginTop: 8 }}>
                  <ReleaseBody body={release.body} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
