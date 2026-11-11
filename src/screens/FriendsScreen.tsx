import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Flame, Play, Search, Share2, UserPlus } from 'lucide-react';
import { ShareSheet, type ShareItem } from '../components/ShareSheet';
import { Avatar, Empty, Notice, Skeleton } from '../components/ui';
import { errorText } from '../lib/bridge';
import { timeAgo } from '../lib/progress';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useToast } from '../state/toast';
import type { FriendRow, PersonRow, ShareRow } from '../lib/types';

type Tab = 'friends' | 'requests' | 'inbox';

export function FriendsScreen() {
  const navigate = useNavigate();
  const { backend, signOut } = useAuth();
  const { profile, refreshSocial } = useAppData();
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const [shares, setShares] = useState<ShareRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<PersonRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [sharing, setSharing] = useState<{ friendId?: string; item?: ShareItem } | null>(null);
  const online = backend?.mode === 'supabase';

  const load = useCallback(async () => {
    if (!backend || backend.mode !== 'supabase') return;
    const [nextFriends, nextShares] = await Promise.all([backend.listFriends(), backend.listShares()]);
    setFriends(nextFriends);
    setShares(nextShares);
  }, [backend]);

  useEffect(() => {
    load().catch((error: unknown) => notify(errorText(error), 'error'));
  }, [load, notify]);

  useEffect(() => {
    if (!backend || backend.mode !== 'supabase') return undefined;
    const term = query.trim().toLowerCase();
    if (term.length < 2) {
      setFound([]);
      return undefined;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      backend
        .searchPeople(term)
        .then(setFound)
        .catch((error: unknown) => notify(errorText(error), 'error'))
        .finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, backend, notify]);

  useEffect(() => {
    if (tab !== 'inbox' || !backend || backend.mode !== 'supabase') return;
    backend
      .markSharesSeen()
      .then(() => refreshSocial())
      .catch(() => undefined);
  }, [tab, backend, refreshSocial]);

  const accepted = useMemo(() => (friends ?? []).filter((friend) => friend.status === 'accepted'), [friends]);
  const incoming = useMemo(() => (friends ?? []).filter((friend) => friend.status === 'pending' && friend.direction === 'incoming'), [friends]);
  const outgoing = useMemo(() => (friends ?? []).filter((friend) => friend.status === 'pending' && friend.direction === 'outgoing'), [friends]);
  const received = (shares ?? []).filter((share) => share.direction === 'received');
  const sent = (shares ?? []).filter((share) => share.direction === 'sent');
  const unseen = received.filter((share) => !share.seen).length;

  const ranking = useMemo(() => {
    const rows = accepted.map((friend) => ({ id: friend.id, name: friend.display_name || friend.username, xp: friend.xp, streak: friend.streak, me: false }));
    if (profile) rows.push({ id: profile.id, name: profile.display_name || profile.username, xp: profile.xp, streak: profile.streak, me: true });
    return rows.sort((a, b) => b.xp - a.xp);
  }, [accepted, profile]);

  const run = async (action: () => Promise<void>, success?: string) => {
    try {
      await action();
      if (success) notify(success, 'ok');
      await load();
      await refreshSocial();
    } catch (error) {
      notify(errorText(error), 'error');
    }
  };

  if (!online) {
    return (
      <div className="page">
        <h1 style={{ marginBottom: 14 }}>Friends</h1>
        <Notice tone="info">
          <span>
            Friends, shared results and shared sets need an online account. You are using danna offline on this device.{' '}
            <button
              className="btn--text"
              style={{ fontWeight: 650 }}
              onClick={async () => {
                await signOut();
                navigate('/auth', { replace: true });
              }}
            >
              Create an account
            </button>
          </span>
        </Notice>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <p className="eyebrow">Study together</p>
          <h1 style={{ marginTop: 4 }}>Friends</h1>
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => setSharing({})} disabled={accepted.length === 0}>
          <Share2 /> Share
        </button>
      </div>

      <div className="segmented" role="tablist" aria-label="Friends">
        {(
          [
            ['friends', 'Friends', accepted.length],
            ['requests', 'Requests', incoming.length],
            ['inbox', 'Inbox', unseen],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            className="segmented__btn"
            onClick={() => setTab(value)}
          >
            {label}
            {count > 0 && <span className="segmented__count">{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'friends' && (
        <div className="stack" style={{ marginTop: 18, gap: 18 }}>
          <label className="input-wrap" style={{ display: 'block' }}>
            <span className="sr-only">Find people by username</span>
            <Search aria-hidden="true" style={{ position: 'absolute', left: 14, top: 13, width: 18, height: 18, color: 'var(--muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 42 }}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find people by username"
              maxLength={40}
            />
          </label>

          {query.trim().length >= 2 && (
            <div className="set-list">
              {searching && <span className="small muted">Searching…</span>}
              {!searching && found.length === 0 && <span className="small muted">No one matches that username yet.</span>}
              {found.map((person) => {
                const already = friends?.some((friend) => friend.id === person.id);
                return (
                  <div key={person.id} className="person">
                    <Avatar name={person.display_name || person.username} color={person.avatar_color} />
                    <div className="person__body">
                      <div className="person__name">{person.display_name || person.username}</div>
                      <div className="person__meta">@{person.username}</div>
                    </div>
                    <button
                      className="btn btn--ghost btn--sm"
                      disabled={already}
                      onClick={() => run(() => backend!.requestFriend(person.id), 'Request sent.')}
                    >
                      {already ? <Check /> : <UserPlus />} {already ? 'Connected' : 'Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {friends === null ? (
            <Skeleton height={160} />
          ) : (
            <>
              <section className="stack--tight">
                <h2 style={{ fontSize: 17 }}>Ranking this week</h2>
                <div className="set-list">
                  {ranking.map((row, index) => (
                    <div key={row.id} className="person" style={row.me ? { borderColor: 'var(--primary-100)', background: 'var(--primary-50)' } : undefined}>
                      <span className="small muted" style={{ width: 22, fontWeight: 700 }}>
                        {index + 1}
                      </span>
                      <Avatar name={row.name} size="sm" />
                      <div className="person__body">
                        <div className="person__name">{row.me ? `${row.name} (you)` : row.name}</div>
                      </div>
                      <span className="person__meta">
                        <Flame aria-hidden="true" style={{ width: 14, height: 14, color: '#e6822c' }} /> {row.streak}
                      </span>
                      <span className="chip">{row.xp} XP</span>
                    </div>
                  ))}
                  {accepted.length === 0 && <Empty title="No friends yet">Search for a username above and send a request.</Empty>}
                </div>
              </section>

              {accepted.length > 0 && (
                <section className="stack--tight">
                  <h2 style={{ fontSize: 17 }}>Your friends</h2>
                  <div className="set-list">
                    {accepted.map((friend) => (
                      <div key={friend.id} className="person">
                        <Avatar name={friend.display_name || friend.username} color={friend.avatar_color} />
                        <div className="person__body">
                          <div className="person__name">{friend.display_name || friend.username}</div>
                          <div className="person__meta">
                            @{friend.username} · {friend.xp} XP
                          </div>
                        </div>
                        <div className="person__actions">
                          <button className="btn btn--ghost btn--sm" onClick={() => setSharing({ friendId: friend.id })}>
                            <Share2 /> Share
                          </button>
                          <button
                            className="btn--text small"
                            style={{ color: 'var(--muted)' }}
                            onClick={() => {
                              if (window.confirm(`Remove ${friend.display_name || friend.username} from your friends?`)) {
                                void run(() => backend!.answerFriend(friend.friendship_id, false), 'Friend removed.');
                              }
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="stack" style={{ marginTop: 18 }}>
          {incoming.length === 0 && outgoing.length === 0 && <Empty title="No pending requests" />}
          {incoming.length > 0 && (
            <div className="set-list">
              <span className="field__label">Wants to connect</span>
              {incoming.map((friend) => (
                <div key={friend.friendship_id} className="person">
                  <Avatar name={friend.display_name || friend.username} color={friend.avatar_color} />
                  <div className="person__body">
                    <div className="person__name">{friend.display_name || friend.username}</div>
                    <div className="person__meta">@{friend.username}</div>
                  </div>
                  <div className="person__actions">
                    <button className="btn btn--primary btn--sm" onClick={() => run(() => backend!.answerFriend(friend.friendship_id, true), 'You are now friends.')}>
                      Accept
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => run(() => backend!.answerFriend(friend.friendship_id, false))}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {outgoing.length > 0 && (
            <div className="set-list">
              <span className="field__label">Waiting for a reply</span>
              {outgoing.map((friend) => (
                <div key={friend.friendship_id} className="person">
                  <Avatar name={friend.display_name || friend.username} color={friend.avatar_color} />
                  <div className="person__body">
                    <div className="person__name">{friend.display_name || friend.username}</div>
                    <div className="person__meta">@{friend.username}</div>
                  </div>
                  <button className="btn btn--ghost btn--sm" onClick={() => run(() => backend!.answerFriend(friend.friendship_id, false), 'Request cancelled.')}>
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'inbox' && (
        <div className="stack" style={{ marginTop: 18 }}>
          {shares === null && <Skeleton height={140} />}
          {shares !== null && received.length === 0 && (
            <Empty title="Nothing shared with you yet">When a friend shares a report or a practice set, it appears here.</Empty>
          )}
          {received.map((share) => (
            <div key={share.id} className={`share-item ${share.seen ? '' : 'share-item--unseen'}`}>
              {!share.seen && <span className="unseen-dot" aria-label="New" />}
              <div className="share-item__body">
                <span className="small muted">
                  {share.other_display_name || share.other_username} shared {share.kind === 'result' ? 'a report' : 'a practice set'} ·{' '}
                  {timeAgo(share.created_at)}
                </span>
                <h3>{share.item_title ?? 'Shared item'}</h3>
                {share.kind === 'result' && share.item_predicted !== null && (
                  <span className="small">Estimated TOEFL {share.item_predicted} / 120</span>
                )}
                {share.note && <p className="share-item__note">&ldquo;{share.note}&rdquo;</p>}
              </div>
              {share.kind === 'result' && share.attempt_id && (
                <button className="btn btn--ghost btn--sm" onClick={() => navigate(`/report/${share.attempt_id}`)}>
                  View report
                </button>
              )}
              {share.kind === 'test' && share.test_id && (
                <button className="btn btn--primary btn--sm" onClick={() => navigate(`/play/test/${share.test_id}`)}>
                  <Play /> Play
                </button>
              )}
            </div>
          ))}
          {sent.length > 0 && (
            <div className="set-list">
              <span className="field__label">Sent by you</span>
              {sent.map((share) => (
                <div key={share.id} className="person">
                  <div className="person__body">
                    <div className="person__name">{share.item_title ?? 'Shared item'}</div>
                    <div className="person__meta">
                      To {share.other_display_name || share.other_username} · {timeAgo(share.created_at)}
                    </div>
                  </div>
                  {share.seen && <span className="chip chip--blue">Seen</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sharing && (
        <ShareSheet
          friends={accepted}
          preferredFriendId={sharing.friendId}
          preferredItem={sharing.item}
          onClose={() => setSharing(null)}
          onSent={() => void load()}
        />
      )}
    </div>
  );
}
