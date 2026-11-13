// The coach for My library. It searches the files the learner chose (all of them when none is
// chosen), sends only the passages that match the question, and says which file each answer comes from.
// The question appears at once, and each answer is formatted as text: bold, italics, lists and quotes.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import { ArrowUp, BookOpen } from 'lucide-react';
import { Notice } from './ui';
import { bridge, errorText } from '../lib/bridge';
import { replyLanguage, tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { indexFor, retrieve } from '../lib/retrieval';
import type { LibraryFileRow } from '../lib/types';
import { useAI } from '../state/ai';
import { useAuth } from '../state/auth';

const SYSTEM = `You are a patient English coach. Answer only from the passages from the learner's files that come with the question. Each passage is labelled with its file and section, like [Unit 3.pdf · Present perfect]. The overview lines list the sections of each file, and they are the right place to look for questions about what the files cover. If the passages do not contain the answer, say so briefly and say what they do cover.

Format the answer in Markdown so it is easy to scan: one short opening sentence, **bold** for the key terms, *italics* for example sentences, a bullet list for steps or several points, and a > quote for a short phrase from a file. Put the file name in square brackets after each quote. Keep the answer short. Do not add a list of sources at the end, because the app shows them.`;

/** The text of each file, kept while the library is open, so a question does not download it again. */
const texts = new Map<string, string>();

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  files?: string[];
}

// An answer is text, not a page: links are shown as plain words, since the app opens no links from answers.
const answerParts: Components = {
  a: ({ children }) => <span className="answer__link">{children}</span>,
};

export function LibraryCoach({ files, selected, onToggle }: { files: LibraryFileRow[]; selected: string[]; onToggle: (id: string) => void }) {
  const { backend } = useAuth();
  const ai = useAI();
  const navigate = useNavigate();
  const t = useT();
  const [question, setQuestion] = useState('');
  const [thread, setThread] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const chosen = files.filter((file) => selected.includes(file.id));
  // With no file chosen, the coach searches all of them.
  const searched = chosen.length > 0 ? chosen : files;
  const canAsk = Boolean(bridge && ai.ready && backend);

  // The conversation opens on the newest message.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [thread.length, busy, notice]);

  async function ask(text: string) {
    if (!text || busy || !canAsk || !backend) return;
    setNotice(null);
    if (searched.length === 0) {
      setNotice(t('Add a file in the Files tab first.'));
      return;
    }
    // The question appears in the conversation at once, and the box is cleared, so nothing waits in the input.
    const earlier = thread;
    setThread([...earlier, { role: 'user', content: text }]);
    setQuestion('');
    setBusy(true);
    try {
      const docs = await Promise.all(
        searched.map(async (file) => {
          let body = texts.get(file.id);
          if (body === undefined) {
            body = await backend.getLibraryText(file.id);
            texts.set(file.id, body);
          }
          return { id: file.id, name: file.name, text: body };
        }),
      );
      const indexes = docs.filter((doc) => doc.text.trim()).map(indexFor);
      if (indexes.length === 0) {
        setNotice(t('These files have no readable text yet. A scanned PDF needs its text first.'));
        return;
      }
      // A short follow-up borrows the words of the question before it.
      const previousQuestions = earlier.filter((turn) => turn.role === 'user').map((turn) => turn.content).slice(-2);
      const found = retrieve(text, indexes, previousQuestions);
      const history = earlier.slice(-6).map(({ role, content }) => ({ role, content }));
      const reply = await ai.complete({
        system: `${SYSTEM} Write your answer in ${replyLanguage()}. Keep quoted text in the language of the file.`,
        messages: [...history, { role: 'user', content: `Passages from the learner's files:\n\n${found.text}\n\n---\nQuestion: ${text}` }],
        maxTokens: 1200,
      });
      setThread((turns) => [...turns, { role: 'assistant', content: reply.text, files: found.files }]);
    } catch (error) {
      // The question stays in the conversation, and the reason stays on screen until the next question.
      setNotice(t(errorText(error)));
    } finally {
      setBusy(false);
    }
  }

  const send = () => void ask(question.trim());

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <section className="library-coach">
      {!bridge && <Notice tone="info">{t('The coach runs in the danna desktop app, where your AI key is kept.')}</Notice>}
      {bridge && !ai.ready && (
        <Notice tone="info">
          {t('Add an AI key to use the coach.')}{' '}
          <button className="btn btn--text" onClick={() => navigate('/settings')}>
            {t('Open settings')}
          </button>
        </Notice>
      )}

      <div className="card library-coach__files">
        <span className="field__label">{t('Files the coach reads')}</span>
        {files.length === 0 ? (
          <span className="small muted">{t('Add a file in the Files tab first.')}</span>
        ) : (
          <>
            <div className="library-filters">
              {files.map((file) => (
                <button key={file.id} className="chip-toggle" aria-pressed={selected.includes(file.id)} onClick={() => onToggle(file.id)}>
                  {file.name}
                </button>
              ))}
            </div>
            <span className="small muted">
              {chosen.length > 0
                ? tn('Searching one file.', 'Searching {count} files.', chosen.length, { count: chosen.length })
                : t('No file is chosen, so the coach searches all of your files.')}
            </span>
          </>
        )}
      </div>

      <div className="coach__list" ref={listRef} aria-live="polite">
        <div className="chat">
          {thread.length === 0 && (
            <p className="muted">{t('Ask a question about your files. Answers come only from them, and each one names its source.')}</p>
          )}
          {thread.map((turn, index) =>
            turn.role === 'user' ? (
              <div key={index} className="bubble bubble--user">
                {turn.content}
              </div>
            ) : (
              <div key={index} className="answer">
                <ReactMarkdown components={answerParts}>{turn.content}</ReactMarkdown>
                {turn.files && turn.files.length > 0 && (
                  <div className="answer__source">
                    <BookOpen aria-hidden="true" />
                    <span>{t('From: {files}', { files: turn.files.join(', ') })}</span>
                  </div>
                )}
              </div>
            ),
          )}
          {busy && (
            <div className="answer answer--typing" role="status" aria-label={t('Coach is typing')}>
              <i />
              <i />
              <i />
            </div>
          )}
          {notice && <Notice tone="error">{notice}</Notice>}
        </div>
      </div>

      <div className="coach__composer">
        <div className="chat-input">
          <textarea
            rows={1}
            value={question}
            maxLength={500}
            placeholder={t('Ask about your files')}
            aria-label={t('Question for the coach')}
            disabled={busy || !canAsk}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={onKey}
          />
          <button className="btn btn--primary btn--icon" type="button" onClick={send} disabled={busy || !canAsk || !question.trim()} aria-label={t('Send question')}>
            <ArrowUp />
          </button>
        </div>
      </div>
    </section>
  );
}
