import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, Sparkles, Trash2 } from 'lucide-react';
import { Notice, Skeleton } from '../components/ui';
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
  const { ready, selection, complete } = useAI();
  const { notify } = useToast();
  const [messages, setMessages] = useState<TutorRow[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages?.length, sending]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending || !backend || !profile) return;
    setSending(true);
    setDraft('');
    try {
      const userRow = await backend.addTutor('user', content);
      const history = [...(messages ?? []), userRow];
      setMessages(history);
      const reply = await complete({ system: coachSystem(profile), messages: chatHistory(history), maxTokens: 1400 });
      const coachRow = await backend.addTutor('assistant', reply.text);
      setMessages((previous) => [...(previous ?? []), coachRow]);
    } catch (error) {
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

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <p className="eyebrow">Your coach</p>
          <div className="row" style={{ marginTop: 4 }}>
            <h1>Coach</h1>
            {ready && selection && (
              <span className="chip chip--ai">
                <Sparkles aria-hidden="true" /> {selection.model}
              </span>
            )}
          </div>
        </div>
        {(messages?.length ?? 0) > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={clear} disabled={sending}>
            <Trash2 /> Clear
          </button>
        )}
      </div>

      {!ready && (
        <Notice tone="info">
          <span>
            Connect an AI key to chat with your coach. Your key stays encrypted on this device.{' '}
            <button className="btn--text" style={{ fontWeight: 650 }} onClick={() => navigate('/settings')}>
              Open settings
            </button>
          </span>
        </Notice>
      )}

      {messages === null ? (
        <Skeleton height={260} />
      ) : (
        <div className="chat" style={{ marginTop: 16 }} aria-live="polite">
          {messages.length === 0 && ready && (
            <div className="stack" style={{ gap: 14 }}>
              <p className="muted">Ask anything about English or TOEFL. Try one of these to start.</p>
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
          <div ref={endRef} />
        </div>
      )}

      <div className="composer" style={{ marginTop: 18 }}>
        <textarea
          rows={1}
          value={draft}
          placeholder={ready ? 'Ask your coach…' : 'Connect an AI key to start chatting'}
          disabled={!ready || sending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKey}
          aria-label="Message your coach"
        />
        <button
          className="btn btn--primary btn--icon"
          style={{ color: '#fff', background: 'var(--primary)' }}
          onClick={() => send(draft)}
          disabled={!ready || sending || !draft.trim()}
          aria-label="Send message"
        >
          <ArrowUp />
        </button>
      </div>
    </div>
  );
}
