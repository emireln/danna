// A friend's profile, shown briefly: the picture, the banner, the day streak, and what the friend shared with you.
// Opening a shared report or practice set goes to it.
import { useNavigate } from 'react-router-dom';
import { Empty, SectionTitle, Sheet } from './ui';
import { PersonAvatar } from './PersonAvatar';
import { StreakFire } from './StreakFire';
import { usePictureUrl } from '../lib/avatarCache';
import { sharesFrom } from '../lib/friends';
import { useT } from '../lib/i18n/react';
import { timeAgo } from '../lib/progress';
import type { FriendRow, ShareRow } from '../lib/types';
import { useAuth } from '../state/auth';

export function FriendProfile({ friend, shares, onClose }: { friend: FriendRow; shares: ShareRow[]; onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const { backend } = useAuth();
  const name = friend.display_name || friend.username;
  const bannerPath = friend.banner_path;
  const bannerVersion = friend.banner_updated_at;
  const banner = usePictureUrl(bannerPath && bannerVersion ? `friend-banner:${bannerPath}:${bannerVersion}` : null, () =>
    backend && bannerPath ? backend.fetchBanner(bannerPath) : Promise.resolve(null),
  );
  const received = sharesFrom(shares, friend.id);

  const open = (share: ShareRow) => {
    onClose();
    if (share.kind === 'result' && share.attempt_id) navigate(`/report/${share.attempt_id}`, { state: { sharedBy: name } });
    else if (share.kind === 'test' && share.test_id) navigate(`/play/test/${share.test_id}`);
  };

  return (
    <Sheet title={t('Profile')} onClose={onClose} footer={<button className="btn btn--ghost" onClick={onClose}>{t('Close')}</button>}>
      <div className="friend-profile">
        <div
          className={`friend-profile__banner${banner ? '' : ' friend-profile__banner--plain'}`}
          style={banner ? { backgroundImage: `url(${banner})` } : undefined}
          aria-hidden="true"
        />
        <div className="friend-profile__head">
          <div className="friend-profile__picture">
            <PersonAvatar person={friend} size="lg" />
          </div>
          <div className="friend-profile__who">
            <h2 className="friend-profile__name">{name}</h2>
            <p className="small muted">@{friend.username}</p>
          </div>
          <div className="friend-profile__streak">
            {friend.streak && friend.streak > 0 ? (
              <StreakFire days={friend.streak} />
            ) : (
              <span className="small muted">{t('No day streak yet')}</span>
            )}
          </div>
        </div>

        <SectionTitle title={t('Shared with you')} />
        {received.length === 0 ? (
          <Empty title={t('Nothing shared yet')}>{t('When {name} shares a report or a practice set with you, it appears here.', { name })}</Empty>
        ) : (
          <div className="set-list">
            {received.map((share) => (
              <button key={share.id} className="set-row" onClick={() => open(share)}>
                <span className="set-row__body">
                  <span className="set-row__title">{share.item_title ? t(share.item_title) : t('Shared item')}</span>
                  <span className="set-row__meta">
                    {share.kind === 'result' ? t('A report') : t('A practice set')} · {timeAgo(share.created_at)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
