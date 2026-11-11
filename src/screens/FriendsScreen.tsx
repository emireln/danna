import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Play, Search, Share2, UserPlus } from 'lucide-react';
import { ShareSheet, type ShareItem } from '../components/ShareSheet';
import { PersonAvatar } from '../components/PersonAvatar';
import { Avatar, ConfirmSheet, Empty, PageHeader, SectionTitle, Skeleton, Tabs } from '../components/ui';
import { errorText } from '../lib/bridge';
import { timeAgo } from '../lib/progress';
import { onlineAvailable } from '../lib/session';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useToast } from '../state/toast';
import type { FriendRow, PersonRow, ShareRow } from '../lib/types';

type Tab = 'friends' | 'requests' | 'inbox';

/** What a search result already is for you: a friend, a request you sent, or a request waiting for you. */
function relationLabel(friend: FriendRow): string {
  if (friend.status === 'accepted') return 'Friends';
  return friend.direction === 'outgoing' ? 'Request sent' : 'Wants to connect';
}

export function FriendsScreen() {
  const navigate = useNavigate();
  const { backend } = useAuth();
  const { profile, refreshSocial, pictureUrl } = useAppData();
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const [shares, setShares] = useState<ShareRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<PersonRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [sharing, setSharing] = useState<{ friendId?: string; item?: ShareItem } | null>(null);
  const [removing, setRemoving] = useState<FriendRow | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const online = backend?.mode === 'supabase';

  const load = useCallback(async () => {
    if (!backend || backend.mode !== 'supabase') return;
    const [nextFriends, nextShares] = await Promise.all([backend.listFriends(), backend.listShares()]);
    setFriends(nextFriends);
    setShares(nextShares);
  }, [backend]);

  useEffect(() => {
    load().catch((error: unknown) => {
      // Show what is known instead of loading forever.
      setFriends((current) => current ?? []);
      setShares((current) => current ?? []);
      notify(errorText(error), 'error');
    });
  }, [load, notify]);

  useEffect(() => {
    if (!backend || backend.mode !== 'supabase') return undefined;
    const term = query.trim().toLowerCase();
    // The server searches from three letters on, so shorter terms are not sent.
    if (term.length < 3) {
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
    const rows: Array<{ id: string; name: string; xp: number; streak: number; me: boolean; friend: FriendRow | null }> = accepted.map(
      (friend) => ({
        id: friend.id,
        name: friend.display_name || friend.username,
        xp: friend.xp ?? 0,
        streak: friend.streak ?? 0,
        me: false,
        friend,
      }),
    );
    if (profile) {
      rows.push({ id: profile.id, name: profile.display_name || profile.username, xp: profile.xp, streak: profile.streak, me: true, friend: null });
    }
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
        <PageHeader eyebrow="Study together" title="Friends" />
        <Empty
          title="Friends need an online account"
          action={
            onlineAvailable() ? (
              <button
                className="btn btn--primary"
                onClick={() => navigate('/auth', { state: { next: '/friends', switchingFrom: 'local' } })}
              >
                Create an account
              </button>
            ) : undefined
          }
        >
          Friends, shared results and shared sets work with an online account. You are using danna offline on this device.
        </Empty>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Study together"
        title="Friends"
        aside={
          <button className="btn btn--primary btn--sm" onClick={() => setSharing({})} disabled={accepted.length === 0}>
            <Share2 /> Share
          </button>
        }
      />

      <Tabs
        label="Friends"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'friends', label: 'Friends', count: accepted.length },
          { value: 'requests', label: 'Requests', count: incoming.length, alert: true },
          { value: 'inbox', label: 'Inbox', count: unseen, alert: true },
        ]}
      />

      {tab === 'friends' && (
        <div className="stack mt-4">
          <label className="search-field">
            <span className="sr-only">Find people by username</span>
            <Search aria-hidden="true" />
            <input
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find people by username"
              maxLength={40}
            />
          </label>

          {query.trim().length >= 3 && (
            <div className="set-list">
              {searching && <span className="small muted">Searching…</span>}
              {!searching && found.length === 0 && <span className="small muted">No one matches that username yet.</span>}
              {found.map((person) => {
                const relation = friends?.find((friend) => friend.id === person.id);
                return (
                  <div key={person.id} className="person">
                    <PersonAvatar person={person} />
                    <div className="person__body">
                      <div className="person__name">{person.display_name || person.username}</div>
                      <div className="person__meta">@{person.username}</div>
                    </div>
                    {relation ? (
                      <span className="chip">{relationLabel(relation)}</span>
                    ) : (
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => run(() => backend!.requestFriend(person.id), 'Request sent.')}
                      >
                        <UserPlus /> Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {friends === null ? (
            <Skeleton height={160} />
          ) : (
            <>
              <SectionTitle title="Ranking by XP" />
              <div className="set-list">
                {ranking.map((row, index) => (
                  <div key={row.id} className={`person${row.me ? ' person--me' : ''}`}>
                    <span className="person__rank">{index + 1}</span>
                    {row.friend ? (
                      <PersonAvatar person={row.friend} size="sm" />
                    ) : (
                      <Avatar name={row.name} size="sm" src={pictureUrl} />
                    )}
                    <div className="person__body">
                      <div className="person__name">{row.me ? `${row.name} (you)` : row.name}</div>
                    </div>
                    <span className="person__meta person__streak">
                      <Flame aria-hidden="true" /> {row.streak}
                    </span>
                    <span className="chip">{row.xp} XP</span>
                  </div>
                ))}
                {accepted.length === 0 && <Empty title="No friends yet">Search for a username above and send a request.</Empty>}
              </div>

              {accepted.length > 0 && (
                <>
                  <SectionTitle title="Your friends" />
                  <div className="set-list">
                    {accepted.map((friend) => (
                      <div key={friend.id} className="person">
                        <PersonAvatar person={friend} />
                        <div className="person__body">
                          <div className="person__name">{friend.display_name || friend.username}</div>
                          <div className="person__meta">
                            @{friend.username} · {friend.xp ?? 0} XP
                          </div>
                        </div>
                        <div className="person__actions">
                          <button className="btn btn--ghost btn--sm" onClick={() => setSharing({ friendId: friend.id })}>
                            <Share2 /> Share
                          </button>
                          <button className="btn btn--text btn--text-muted small" onClick={() => setRemoving(friend)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="stack mt-4">
          {incoming.length === 0 && outgoing.length === 0 && (
            <Empty title="No pending requests">When someone sends you a request, it appears here.</Empty>
          )}
          {incoming.length > 0 && (
            <div className="set-list">
              <p className="group-label">Wants to connect</p>
              {incoming.map((friend) => (
                <div key={friend.friendship_id} className="person">
                  <PersonAvatar person={friend} />
                  <div className="person__body">
                    <div className="person__name">{friend.display_name || friend.username}</div>
                    <div className="person__meta">@{friend.username}</div>
                  </div>
                  <div className="person__actions">
                    <button
                      className="btn btn--primary btn--sm"
                      onClick={() => run(() => backend!.answerFriend(friend.friendship_id, true), 'You are now friends.')}
                    >
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
              <p className="group-label">Waiting for a reply</p>
              {outgoing.map((friend) => (
                <div key={friend.friendship_id} className="person">
                  <PersonAvatar person={friend} />
                  <div className="person__body">
                    <div className="person__name">{friend.display_name || friend.username}</div>
                    <div className="person__meta">@{friend.username}</div>
                  </div>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => run(() => backend!.answerFriend(friend.friendship_id, false), 'Request cancelled.')}
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'inbox' && (
        <div className="stack mt-4">
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
              <p className="group-label">Sent by you</p>
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

      {removing && (
        <ConfirmSheet
          title="Remove friend?"
          confirmLabel="Remove"
          busy={removeBusy}
          onConfirm={async () => {
            setRemoveBusy(true);
            await run(() => backend!.answerFriend(removing.friendship_id, false), 'Friend removed.');
            setRemoveBusy(false);
            setRemoving(null);
          }}
          onClose={() => setRemoving(null)}
        >
          {removing.display_name || removing.username} will no longer see your shared results or profile picture.
        </ConfirmSheet>
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
