import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, Sparkles, Trash2 } from 'lucide-react';
import { ConfirmSheet, Notice, PageHeader, Skeleton } from '../components/ui';
import { errorText } from '../lib/bridge';
import { chatHistory, coachSystem } from '../lib/ai';
import { useAI } from '../state/ai';
import { useAuth } from '../state/auth';
import { useAppData } from '../state/appData';
import { useToast } from '../state/toast';
import type { TutorRow } from '../lib/types';

const SUGGESTIONS = [
  'Explain my weakest skill and what to do this week',
  'Quiz me on present perfect vs past simple',
  'Correct this sentence and explain the rule: She have went to school yesterday.',
  'Plan my next 15 minutes of study',
];

export function CoachScreen() {
  const navigate = useNavigate();
  const { backend } = useAuth();
  const { profile } = useAppData();
  const { ready, selection, complete, connections } = useAI();
  const { notify } = useToast();
  const [messages, setMessages] = useState<TutorRow[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!backend) return undefined;
    let active = true;
    backend
      .listTutor(60)
      .then((rows) => {
        if (active) setMessages(rows);
      })
      .catch((error: unknown) => {
        console.error('Could not load the conversation', error);
        if (active) setMessages([]);
      });
    return () => {
      active = false;
    };
  }, [backend]);

  // Only the conversation scrolls, and it opens on the newest message.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages?.length, sending, failure]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending || !backend || !profile) return;
    setSending(true);
    setFailure(null);
    setDraft('');
    try {
      const userRow = await backend.addTutor('user', content);
      const history = [...(messages ?? []), userRow];
      setMessages(history);
      const reply = await complete({ system: coachSystem(profile), messages: chatHistory(history), maxTokens: 2048 });
      const coachRow = await backend.addTutor('assistant', reply.text);
      setMessages((previous) => [...(previous ?? []), coachRow]);
    } catch (error) {
      // The message stays in the conversation and the reason stays on screen until the next try.
      setFailure(errorText(error));
      notify(errorText(error), 'error');
    } finally {
      setSending(false);
    }
  };

  const clear = async () => {
    if (!backend) return;
    try {
      await backend.clearTutor();
      setMessages([]);
      setFailure(null);
      setConfirmClear(false);
    } catch (error) {
      notify(errorText(error), 'error');
    }
  };

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  };

  const providerLabel = selection ? connections.find((item) => item.provider === selection.provider)?.label : undefined;

  return (
    <div className="page page--coach">
      <PageHeader
        eyebrow="Ask anything"
        title="Coach"
        aside={
          <>
            {ready && providerLabel && (
              <span className="chip chip--ai">
                <Sparkles aria-hidden="true" /> {providerLabel}
              </span>
            )}
            {(messages?.length ?? 0) > 0 && (
              <button className="btn btn--ghost btn--sm" onClick={() => setConfirmClear(true)} disabled={sending}>
                <Trash2 /> Clear
              </button>
            )}
          </>
        }
      />

      {!ready && (
        <Notice tone="info">
          Add your AI key to start chatting with your coach.{' '}
          <button className="btn btn--text" onClick={() => navigate('/settings')}>
            Open settings
          </button>
        </Notice>
      )}

      <div className="coach__list" ref={listRef} aria-live="polite">
        {messages === null ? (
          <Skeleton height={260} />
        ) : (
          <div className="chat">
            {messages.length === 0 && ready && (
              <div className="stack">
                <p className="muted">Ask anything about English. Try one of these to start.</p>
                <div className="suggest">
                  {SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion} onClick={() => send(suggestion)} disabled={sending}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`bubble ${message.role === 'user' ? 'bubble--user' : 'bubble--coach'}`}>
                {message.content}
              </div>
            ))}
            {sending && (
              <div className="bubble bubble--coach muted" aria-label="Coach is typing">
                Thinking…
              </div>
            )}
            {failure && <Notice tone="error">{failure}</Notice>}
          </div>
        )}
      </div>

      <div className="coach__composer">
        <div className="chat-input">
          <textarea
            rows={1}
            value={draft}
            placeholder="Ask your coach…"
            disabled={!ready || sending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKey}
            aria-label="Message your coach"
          />
          <button
            className="btn btn--primary btn--icon"
            onClick={() => send(draft)}
            disabled={!ready || sending || !draft.trim()}
            aria-label="Send message"
          >
            <ArrowUp />
          </button>
        </div>
      </div>

      {confirmClear && (
        <ConfirmSheet
          title="Clear this conversation?"
          confirmLabel="Clear chat"
          onConfirm={clear}
          onClose={() => setConfirmClear(false)}
        >
          The messages are deleted. This cannot be undone.
        </ConfirmSheet>
      )}
    </div>
  );
}
