import { useEffect, useState } from 'react';
import { Field, Sheet, Spinner, Empty } from './ui';
import { errorText } from '../lib/bridge';
import { tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
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

  const pressed = (candidate: ShareItem) => item?.kind === candidate.kind && item.id === candidate.id;

  return (
    <Sheet
      title={t('Share with a friend')}
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
            <span className="field__label">{t('Send to')}</span>
            <div className="row row--wrap">
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
            <span className="field__label">{t('What to send')}</span>
            {loading ? (
              <span className="row small muted">
                <Spinner dark /> {t('Loading your results and sets')}
              </span>
            ) : (
              <div className="set-list">
                {attempts.map((attempt) => {
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
                {tests.map((test) => {
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
                {attempts.length === 0 && tests.length === 0 && (
                  <span className="small muted">{t('Finish a session or create a set first.')}</span>
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
