// The weekly league on the profile: your tier and your week's XP. With an online account it ranks you and your
// friends; without one, the bars show your own last seven days, and a note says why friends are not shown.
import { useT } from '../lib/i18n/react';
import { dailyXp, LEAGUE_DAYS, placeOf, ranked, tierOf, type TierId } from '../lib/league';
import type { AttemptRow, LeagueRow } from '../lib/types';
import { PersonAvatar } from './PersonAvatar';
import { Skeleton } from './ui';

function tierName(t: ReturnType<typeof useT>, id: TierId): string {
  switch (id) {
    case 'bronze':
      return t('Bronze');
    case 'silver':
      return t('Silver');
    case 'gold':
      return t('Gold');
    case 'sapphire':
      return t('Sapphire');
    case 'ruby':
      return t('Ruby');
    case 'emerald':
      return t('Emerald');
    case 'diamond':
      return t('Diamond');
  }
}

export function LeagueCard({
  rows,
  online,
  runs,
  userId,
}: {
  /** The members of the league, with the caller among them. Null while it loads. */
  rows: LeagueRow[] | null;
  online: boolean;
  /** The caller's recent runs, for the bars shown without friends. */
  runs: AttemptRow[];
  userId: string;
}) {
  const t = useT();
  if (rows === null) {
    return (
      <section className="card league" aria-label={t('League')}>
        <Skeleton height={140} />
      </section>
    );
  }

  const mine = rows.find((row) => row.user_id === userId);
  const weekXp = mine?.week_xp ?? 0;
  const tier = tierOf(weekXp);
  const place = placeOf(rows, userId);
  const days = dailyXp(runs, LEAGUE_DAYS);
  const dayMax = Math.max(1, ...days.map((item) => item.xp));

  return (
    <section className="card league" aria-label={t('League')}>
      <div className="league__head">
        <span className="league__title">{t('League')}</span>
        <span className={`league__tier league__tier--${tier.id}`}>{tierName(t, tier.id)}</span>
      </div>

      <p className="league__week">{t('Your week: {xp} XP', { xp: weekXp })}</p>

      <div className="league__next">
        <span
          className="league__bar"
          role="progressbar"
          aria-label={tier.next ? t('{xp} XP to {tier}', { xp: tier.toNext ?? 0, tier: tierName(t, tier.next) }) : t('Top of the league')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={tier.progress}
        >
          <span style={{ width: `${tier.progress}%` }} />
        </span>
        <span className="league__hint">
          {tier.next && tier.toNext !== null ? t('{xp} XP to {tier}', { xp: tier.toNext, tier: tierName(t, tier.next) }) : t('Top of the league')}
        </span>
      </div>

      {online ? (
        <>
          {place && <p className="league__place">{t('You are #{place} of {total} this week', { place: place.place, total: place.total })}</p>}
          <ol className="league__list">
            {ranked(rows).map((row, index) => (
              <li key={row.user_id} className={row.user_id === userId ? 'league__row league__row--me' : 'league__row'}>
                <span className="league__position">{index + 1}</span>
                <span className="league__who" aria-hidden="true">
                  <PersonAvatar person={{ ...row, id: row.user_id }} size="sm" />
                </span>
                <span className="league__name">
                  {row.display_name || row.username}
                  {row.user_id === userId ? ` · ${t('You')}` : ''}
                </span>
                <span className="league__xp">{row.week_xp} XP</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <div className="league__days" role="img" aria-label={t('Last seven days')}>
            {days.map((item) => (
              <div className="league__day" key={item.day}>
                <span className="league__column" style={{ height: `${Math.max(6, (item.xp / dayMax) * 100)}%` }} />
                <span className="league__date">{Number(item.day.slice(8))}</span>
              </div>
            ))}
          </div>
          <p className="league__note">
            {t('Friends see your league when you use an online account.')}
          </p>
        </>
      )}
    </section>
  );
}
