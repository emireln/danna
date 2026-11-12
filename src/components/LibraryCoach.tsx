// The coach for My library. It searches the files the learner chose (all of them when none is
// chosen), sends only the passages that match the question, and says which file each answer comes from.
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { Notice, Spinner } from './ui';
import { bridge, errorText } from '../lib/bridge';
import { indexFor, retrieve } from '../lib/retrieval';
import type { LibraryFileRow } from '../lib/types';
import { useAI } from '../state/ai';
import { useAuth } from '../state/auth';

const SYSTEM = `You are a patient English coach. Answer only from the passages from the learner's files that come with the question. Each passage is labelled with its file and section, like [Unit 3.pdf · Present perfect]. The overview lines list the sections of each file, and they are the right place to look for questions about what the files cover. If the passages do not contain the answer, say so briefly and say what they do cover. Keep answers short and clear. Quote short phrases in quotation marks and name the file each one comes from in square brackets.`;

/** The text of each file, kept while the library is open, so a question does not download it again. */
const texts = new Map<string, string>();

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  files?: string[];
}

export function LibraryCoach({ files, selected, onToggle }: { files: LibraryFileRow[]; selected: string[]; onToggle: (id: string) => void }) {
  const { backend } = useAuth();
  const ai = useAI();
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [thread, setThread] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const chosen = files.filter((file) => selected.includes(file.id));
  // With no file chosen, the coach searches all of them.
  const searched = chosen.length > 0 ? chosen : files;
  const canAsk = Boolean(bridge && ai.ready && backend);

  async function ask(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy || !canAsk || !backend) return;
    setNotice(null);
    if (searched.length === 0) {
      setNotice('Add a file in the Files tab first.');
      return;
    }
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
        setNotice('These files have no readable text yet. A scanned PDF needs its text first.');
        return;
      }
      // A short follow-up borrows the words of the question before it.
      const earlier = thread.filter((turn) => turn.role === 'user').map((turn) => turn.content).slice(-2);
      const found = retrieve(text, indexes, earlier);
      const history = thread.slice(-6).map(({ role, content }) => ({ role, content }));
      const reply = await ai.complete({
        system: SYSTEM,
        messages: [...history, { role: 'user', content: `Passages from the learner's files:\n\n${found.text}\n\n---\nQuestion: ${text}` }],
        maxTokens: 1200,
      });
      setThread((turns) => [...turns, { role: 'user', content: text }, { role: 'assistant', content: reply.text, files: found.files }]);
      setQuestion('');
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      {!bridge && <Notice tone="info">The coach runs in the danna desktop app, where your AI key is kept.</Notice>}
      {bridge && !ai.ready && (
        <Notice tone="info">
          Add an AI key to use the coach.{' '}
          <button className="btn btn--text" onClick={() => navigate('/settings')}>
            Open settings
          </button>
        </Notice>
      )}

      <div className="card stack--tight">
        <span className="field__label">Files the coach reads</span>
        {files.length === 0 ? (
          <span className="small muted">Add a file in the Files tab first.</span>
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
                ? `Searching ${chosen.length === 1 ? 'one file' : `${chosen.length} files`}.`
                : 'No file is chosen, so the coach searches all of your files.'}
            </span>
          </>
        )}
      </div>

      <div className="tutor-thread" aria-live="polite">
        {thread.length === 0 && (
          <span className="small muted">Ask a question about your files. Answers come only from them, and each one names its source.</span>
        )}
        {thread.map((turn, index) => (
          <div key={index} className={turn.role === 'user' ? 'tutor-user' : 'tutor-reply'}>
            {turn.content}
            {turn.files && turn.files.length > 0 && <div className="small muted tutor-source">From: {turn.files.join(', ')}</div>}
          </div>
        ))}
        {busy && (
          <div className="tutor-reply" aria-label="Coach is typing">
            <Spinner dark />
          </div>
        )}
      </div>

      {notice && <Notice tone="error">{notice}</Notice>}

      <form className="chat-input" onSubmit={ask}>
        <input
          value={question}
          maxLength={500}
          placeholder="Ask about your files"
          aria-label="Question for the coach"
          disabled={busy || !canAsk}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button className="btn btn--primary btn--icon" type="submit" disabled={busy || !canAsk || !question.trim()} aria-label="Send question">
          <ArrowUp />
        </button>
      </form>
    </section>
  );
}
