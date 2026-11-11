// The tutor for My library: it answers questions from the files the learner chose, and says
// which file each answer comes from.
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { Notice, Spinner } from './ui';
import { bridge, errorText } from '../lib/bridge';
import { tutorExcerpts } from '../lib/library';
import type { LibraryFileRow } from '../lib/types';
import { useAI } from '../state/ai';
import { useAuth } from '../state/auth';

const SYSTEM = `You are a patient English tutor for a learner preparing for the TOEFL. Answer only from the excerpts from the learner's files that come with the question. If the excerpts do not contain the answer, say so briefly and say what they do cover. Keep answers short and clear. Quote short phrases from the excerpts in quotation marks, and name the file each one comes from in square brackets, like [Unit 3.pdf].`;

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  files?: string[];
}

export function Tutor({ files, selected, onToggle }: { files: LibraryFileRow[]; selected: string[]; onToggle: (id: string) => void }) {
  const { backend } = useAuth();
  const ai = useAI();
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [thread, setThread] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const chosen = files.filter((file) => selected.includes(file.id));
  const canAsk = Boolean(bridge && ai.ready && backend);

  async function ask(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy || !canAsk || !backend) return;
    setNotice(null);
    if (chosen.length === 0) {
      setNotice('Choose one or more files above first.');
      return;
    }
    setBusy(true);
    try {
      const sources = await Promise.all(
        chosen.map(async (file) => ({ name: file.name, text: await backend.getLibraryText(file.id) })),
      );
      const excerpts = tutorExcerpts(text, sources.filter((source) => source.text.trim()));
      if (!excerpts) {
        setNotice('These files have no readable text yet. A scanned PDF needs its text first.');
        return;
      }
      const used = [...new Set([...excerpts.matchAll(/^\[(.+)\]$/gm)].map((match) => match[1]))];
      const history = thread.slice(-6).map(({ role, content }) => ({ role, content }));
      const reply = await ai.complete({
        system: SYSTEM,
        messages: [...history, { role: 'user', content: `Excerpts from the learner's files:\n\n${excerpts}\n\n---\nQuestion: ${text}` }],
        maxTokens: 1200,
      });
      setThread((turns) => [...turns, { role: 'user', content: text }, { role: 'assistant', content: reply.text, files: used }]);
      setQuestion('');
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack" style={{ gap: 16 }}>
      {!bridge && <Notice tone="info">The tutor runs in the danna desktop app, where your AI key is kept.</Notice>}
      {bridge && !ai.ready && (
        <Notice tone="info">
          <span>Add an AI key to use the tutor. </span>
          <button className="btn--text" style={{ fontWeight: 650 }} onClick={() => navigate('/settings')}>
            Open settings
          </button>
        </Notice>
      )}

      <div className="card stack--tight" style={{ gap: 10 }}>
        <span className="field__label">Files the tutor reads</span>
        {files.length === 0 ? (
          <span className="small muted">Add a file in the Files tab first.</span>
        ) : (
          <div className="library-filters">
            {files.map((file) => (
              <button key={file.id} className="chip-toggle" aria-pressed={selected.includes(file.id)} onClick={() => onToggle(file.id)}>
                {file.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="tutor-thread">
        {thread.length === 0 && (
          <span className="small muted">Ask a question about the files you chose. Answers come only from those files.</span>
        )}
        {thread.map((turn, index) => (
          <div key={index} className={turn.role === 'user' ? 'tutor-user' : 'tutor-reply'}>
            {turn.content}
            {turn.files && turn.files.length > 0 && <div className="small muted tutor-source">From: {turn.files.join(', ')}</div>}
          </div>
        ))}
        {busy && (
          <div className="tutor-reply">
            <Spinner dark />
          </div>
        )}
      </div>

      {notice && <Notice tone="error">{notice}</Notice>}

      <form className="tutor-input" onSubmit={ask}>
        <input
          className="input"
          value={question}
          maxLength={500}
          placeholder="Ask about the chosen files"
          disabled={busy || !canAsk}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button className="btn btn--primary" type="submit" disabled={busy || !canAsk || !question.trim()}>
          {busy ? <Spinner /> : <Send />} Ask
        </button>
      </form>
    </section>
  );
}
