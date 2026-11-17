import { useEffect, useMemo, useState } from 'react';
import { Field, Sheet, Spinner, Empty } from './ui';
import { errorText } from '../lib/bridge';
import { tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { formatDate } from '../lib/progress';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import type { AttemptRow, FriendRow, ShareRow, TestRow } from '../lib/types';

export type ShareItem = { kind: 'result'; id: string } | { kind: 'test'; id: string };

/** How many friends the sheet lists before the person searches or asks for all of them. */
const RECENT_FRIENDS = 6;

const nameOf = (friend: FriendRow) => friend.display_name || friend.username;

interface ShareSheetProps {
  friends: FriendRow[];
  preferredFriendId?: string;
  preferredItem?: ShareItem;
  onClose: () => void;
  onSent?: () => void;
}

/** Sends one of your results or sets to a friend. The note is limited to 280 characters. */
export function ShareSheet({ friends, preferredFriendId, preferredItem, onClose, onSent }: ShareSheetProps) {
  const t = useT();
  const { backend } = useAuth();
  const { notify } = useToast();
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState<string | null>(preferredFriendId ?? friends[0]?.id ?? null);
  const [item, setItem] = useState<ShareItem | null>(preferredItem ?? null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [showAllFriends, setShowAllFriends] = useState(false);
  const [shares, setShares] = useState<ShareRow[]>([]);

  // The result that was picked before the sheet opened, so it is listed even when it is older than the newest ones.
  const pickedResultId = preferredItem?.kind === 'result' ? preferredItem.id : null;

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    Promise.all([backend.listAttempts(12), backend.listMyTests()])
      .then(async ([recent, mine]) => {
        const picked =
          pickedResultId && !recent.some((attempt) => attempt.id === pickedResultId)
            ? await backend.getAttempt(pickedResultId).catch(() => null)
            : null;
        if (!active) return;
        setAttempts(picked ? [picked, ...recent] : recent);
        setTests(mine);
      })
      .catch((error: unknown) => notify(t(errorText(error)), 'error'))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [backend, notify, pickedResultId]);

  // The shares show who the person talked with last, so the friends they share with most come first.
  useEffect(() => {
    if (!backend || backend.mode !== 'supabase') return undefined;
    let active = true;
    backend
      .listShares()
      .then((rows) => {
        if (active) setShares(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [backend]);

  const send = async () => {
    if (!backend || !recipient || !item) return;
    setBusy(true);
    try {
      await backend.sendShare({
        recipientId: recipient,
        kind: item.kind,
        attemptId: item.kind === 'result' ? item.id : undefined,
        testId: item.kind === 'test' ? item.id : undefined,
        note: note.trim(),
      });
      notify(t('Sent. Your friend will see it in their inbox.'), 'ok');
      onSent?.();
      onClose();
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setBusy(false);
    }
  };

  // A friend chosen before the sheet opened: the recipient is already decided, so the sheet names them and lists no friends.
  const lockedFriend = preferredFriendId ? (friends.find((friend) => friend.id === preferredFriendId) ?? null) : null;
  const needle = query.trim().toLowerCase();
  const lastShared = useMemo(() => {
    const times = new Map<string, number>();
    for (const share of shares) {
      const time = Date.parse(share.created_at);
      if (Number.isFinite(time) && time > (times.get(share.other_id) ?? 0)) times.set(share.other_id, time);
    }
    return times;
  }, [shares]);
  const ordered = useMemo(
    () =>
      [...friends].sort(
        (a, b) => (lastShared.get(b.id) ?? 0) - (lastShared.get(a.id) ?? 0) || nameOf(a).localeCompare(nameOf(b)),
      ),
    [friends, lastShared],
  );
  const matchingFriends = ordered.filter(
    (friend) => !needle || nameOf(friend).toLowerCase().includes(needle) || friend.username.toLowerCase().includes(needle),
  );
  const visibleFriends = needle || showAllFriends ? matchingFriends : matchingFriends.slice(0, RECENT_FRIENDS);
  const shownAttempts = attempts.filter((attempt) => !needle || t(attempt.title).toLowerCase().includes(needle));
  const shownTests = tests.filter((test) => !needle || t(test.title).toLowerCase().includes(needle));

  const pressed = (candidate: ShareItem) => item?.kind === candidate.kind && item.id === candidate.id;

  return (
    <Sheet
      title={lockedFriend ? t('Share with {name}', { name: nameOf(lockedFriend) }) : t('Share with a friend')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            {t('Cancel')}
          </button>
          <button className="btn btn--primary" onClick={send} disabled={busy || !recipient || !item || friends.length === 0}>
            {busy ? <Spinner /> : null} {t('Send')}
          </button>
        </>
      }
    >
      {friends.length === 0 ? (
        <Empty title={t('Add a friend first')}>{t('Search for a username in Friends, then send a request.')}</Empty>
      ) : (
        <>
          <div className="field">
            <input
              className="input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={lockedFriend ? t('Search your results and sets') : t('Search friends and results')}
              aria-label={lockedFriend ? t('Search your results and sets') : t('Search friends and results')}
            />
          </div>

          {!lockedFriend && (
            <div className="field">
              <span className="field__label">{t('Send to')}</span>
              <div className="row row--wrap">
                {visibleFriends.map((friend) => (
                  <button
                    key={friend.id}
                    className={`chip ${recipient === friend.id ? 'chip--blue' : ''}`}
                    aria-pressed={recipient === friend.id}
                    onClick={() => setRecipient(friend.id)}
                  >
                    {nameOf(friend)}
                  </button>
                ))}
              </div>
              {!needle && !showAllFriends && matchingFriends.length > RECENT_FRIENDS && (
                <button type="button" className="btn btn--text btn--sm" onClick={() => setShowAllFriends(true)}>
                  {t('Show all {count} friends', { count: matchingFriends.length })}
                </button>
              )}
            </div>
          )}

          <div className="field">
            <span className="field__label">{t('What to send')}</span>
            {loading ? (
              <span className="row small muted">
                <Spinner dark /> {t('Loading your results and sets')}
              </span>
            ) : (
              <div className="set-list">
                {shownAttempts.map((attempt) => {
                  const candidate: ShareItem = { kind: 'result', id: attempt.id };
                  return (
                    <button
                      key={attempt.id}
                      className={`set-row${pressed(candidate) ? ' set-row--picked' : ''}`}
                      aria-pressed={pressed(candidate)}
                      onClick={() => setItem(candidate)}
                    >
                      <span className="set-row__body">
                        <span className="set-row__title">{t(attempt.title)}</span>
                        <span className="set-row__meta">
                          {attempt.predicted
                            ? t('Estimate {score} / 120', { score: attempt.predicted })
                            : `${attempt.score_pct}%`}{' '}
                          · {formatDate(attempt.created_at)}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {shownTests.map((test) => {
                  const candidate: ShareItem = { kind: 'test', id: test.id };
                  return (
                    <button
                      key={test.id}
                      className={`set-row${pressed(candidate) ? ' set-row--picked' : ''}`}
                      aria-pressed={pressed(candidate)}
                      onClick={() => setItem(candidate)}
                    >
                      <span className="set-row__body">
                        <span className="set-row__title">{t(test.title)}</span>
                        <span className="set-row__meta">
                          {t('Practice set · {questions}', {
                            questions: tn('{count} question', '{count} questions', test.content.questions.length, {
                              count: test.content.questions.length,
                            }),
                          })}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {shownAttempts.length === 0 && shownTests.length === 0 && (
                  <span className="small muted">
                    {needle ? t('Nothing matches your search.') : t('Finish a session or create a set first.')}
                  </span>
                )}
              </div>
            )}
          </div>

          <Field label={t('Note (optional)')}>
            <textarea
              className="input"
              rows={2}
              maxLength={280}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('Try this one before Friday.')}
            />
          </Field>
        </>
      )}
    </Sheet>
  );
}
