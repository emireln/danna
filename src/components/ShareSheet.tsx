import { useEffect, useState } from 'react';
import { Field, Sheet, Spinner, Empty } from './ui';
import { errorText } from '../lib/bridge';
import { formatDate } from '../lib/progress';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import type { AttemptRow, FriendRow, TestRow } from '../lib/types';

export type ShareItem = { kind: 'result'; id: string } | { kind: 'test'; id: string };

interface ShareSheetProps {
  friends: FriendRow[];
  preferredFriendId?: string;
  preferredItem?: ShareItem;
  onClose: () => void;
  onSent?: () => void;
}

/** Sends one of your results or sets to a friend. The note is limited to 280 characters. */
export function ShareSheet({ friends, preferredFriendId, preferredItem, onClose, onSent }: ShareSheetProps) {
  const { backend } = useAuth();
  const { notify } = useToast();
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState<string | null>(preferredFriendId ?? friends[0]?.id ?? null);
  const [item, setItem] = useState<ShareItem | null>(preferredItem ?? null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    Promise.all([backend.listAttempts(12), backend.listMyTests()])
      .then(([recent, mine]) => {
        if (!active) return;
        setAttempts(recent);
        setTests(mine);
      })
      .catch((error: unknown) => notify(errorText(error), 'error'))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [backend, notify]);

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
      notify('Sent. Your friend will see it in their inbox.', 'ok');
      onSent?.();
      onClose();
    } catch (error) {
      notify(errorText(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const pressed = (candidate: ShareItem) => item?.kind === candidate.kind && item.id === candidate.id;

  return (
    <Sheet
      title="Share with a friend"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={send} disabled={busy || !recipient || !item || friends.length === 0}>
            {busy ? <Spinner /> : null} Send
          </button>
        </>
      }
    >
      {friends.length === 0 ? (
        <Empty title="Add a friend first">Search for a username in Friends, then send a request.</Empty>
      ) : (
        <>
          <div className="field">
            <span className="field__label">Send to</span>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {friends.map((friend) => (
                <button
                  key={friend.id}
                  className={`chip ${recipient === friend.id ? 'chip--blue' : ''}`}
                  aria-pressed={recipient === friend.id}
                  onClick={() => setRecipient(friend.id)}
                >
                  {friend.display_name || friend.username}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field__label">What to send</span>
            {loading ? (
              <span className="row small muted">
                <Spinner dark /> Loading your results and sets
              </span>
            ) : (
              <div className="set-list">
                {attempts.map((attempt) => {
                  const candidate: ShareItem = { kind: 'result', id: attempt.id };
                  return (
                    <button
                      key={attempt.id}
                      className="set-row"
                      aria-pressed={pressed(candidate)}
                      onClick={() => setItem(candidate)}
                      style={pressed(candidate) ? { borderColor: 'var(--primary)', background: 'var(--primary-50)' } : undefined}
                    >
                      <span className="set-row__body">
                        <span className="set-row__title" style={{ display: 'block', fontSize: 14.5 }}>
                          {attempt.title}
                        </span>
                        <span className="set-row__meta" style={{ display: 'block' }}>
                          {attempt.predicted ? `Estimate ${attempt.predicted} / 120` : `${attempt.score_pct}%`} · {formatDate(attempt.created_at)}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {tests.map((test) => {
                  const candidate: ShareItem = { kind: 'test', id: test.id };
                  return (
                    <button
                      key={test.id}
                      className="set-row"
                      aria-pressed={pressed(candidate)}
                      onClick={() => setItem(candidate)}
                      style={pressed(candidate) ? { borderColor: 'var(--primary)', background: 'var(--primary-50)' } : undefined}
                    >
                      <span className="set-row__body">
                        <span className="set-row__title" style={{ display: 'block', fontSize: 14.5 }}>
                          {test.title}
                        </span>
                        <span className="set-row__meta" style={{ display: 'block' }}>
                          Practice set · {test.content.questions.length} questions
                        </span>
                      </span>
                    </button>
                  );
                })}
                {attempts.length === 0 && tests.length === 0 && (
                  <span className="small muted">Finish a session or create a set first.</span>
                )}
              </div>
            )}
          </div>

          <Field label="Note (optional)">
            <textarea
              className="input"
              rows={2}
              maxLength={280}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Try this one before Friday."
            />
          </Field>
        </>
      )}
    </Sheet>
  );
}
