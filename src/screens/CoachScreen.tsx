// The coach: a list of chats, each with its own history. A chat is named from its first question. A
// message can carry up to ten files (pictures, PDF, TXT, Markdown) and mentioned library files.
import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AtSign, ArrowUp, BookOpen, FileText, History, Image as ImageIcon, Paperclip, Plus, Sparkles, X } from 'lucide-react';
import { ChatHistory } from '../components/ChatHistory';
import { MentionSheet } from '../components/MentionSheet';
import { Notice, PageHeader, Skeleton, Spinner } from '../components/ui';
import { readAttachment } from '../lib/attachments';
import { chatHistory, coachSystem } from '../lib/ai';
import { errorText } from '../lib/bridge';
import { MAX_FILES, STARTERS, STARTER_COUNT, TITLE_SYSTEM, attachmentsOf, cleanTitle, fallbackTitle, pickStarters, type PendingFile } from '../lib/coach';
import { useT } from '../lib/i18n/react';
import { indexFor, retrieve, type LibraryDocument } from '../lib/retrieval';
import type { ChatImage, LibraryFileRow, TutorChatRow, TutorRow } from '../lib/types';
import { useAI } from '../state/ai';
import { useAppData } from '../state/appData';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,.md,.markdown,.txt,.pdf';
// The text of the files sent in a chat is kept for its follow-up questions, up to this many files.
const KEPT_FILES = 20;

// What the model is asked when a message has files but no question. Not shown to the learner.
const FILES_ONLY = 'Summarize these files and tell me what matters most for learning English.';
const PICTURES_ONLY = 'Describe these pictures and tell me what is useful for learning English in them.';

export function CoachScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { backend } = useAuth();
  const { profile } = useAppData();
  const { ready, selection, complete, connections, desktop } = useAI();
  const { notify } = useToast();

  const [chats, setChats] = useState<TutorChatRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TutorRow[] | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [reading, setReading] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyMatches, setHistoryMatches] = useState<Set<string> | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState<LibraryFileRow[]>([]);
  // The questions offered to start a chat are picked at random, and picked again for each new chat.
  const [starters, setStarters] = useState(() => pickStarters(STARTERS, STARTER_COUNT));

  const listRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // The chat on screen. A reply is saved to the chat it was asked in, even if the learner has moved on.
  const activeRef = useRef<string | null>(null);
  // The text of the files sent earlier in each chat, so a follow-up question can still use them.
  const chatFiles = useRef(new Map<string, LibraryDocument[]>());
  const libraryTexts = useRef(new Map<string, string>());

  const activeChat = chats.find((chat) => chat.id === activeId) ?? null;

  const openChat = useCallback(
    async (id: string | null) => {
      activeRef.current = id;
      setActiveId(id);
      setFailure(null);
      if (!id || !backend) {
        setMessages([]);
        return;
      }
      setMessages(null);
      try {
        const rows = await backend.listTutor(id, 200);
        if (activeRef.current === id) setMessages(rows);
      } catch (error) {
        if (activeRef.current === id) {
          setMessages([]);
          setFailure(t(errorText(error)));
        }
      }
    },
    [backend, t],
  );

  // On open, the newest chat that is not archived is shown. Without one, a new chat is ready to start.
  useEffect(() => {
    if (!backend) return undefined;
    let cancelled = false;
    backend
      .listTutorChats()
      .then((rows) => {
        if (cancelled) return undefined;
        setChats(rows);
        return openChat(rows.find((chat) => !chat.archived)?.id ?? null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Could not load the chats', error);
        setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [backend, openChat]);

  // The conversation opens on its newest message.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages?.length, sending, failure, activeId]);

  // Search in the chat history: the chats whose name or messages match, a moment after the learner stops typing.
  useEffect(() => {
    const query = historyQuery.trim();
    setHistoryMatches(null);
    if (!backend || !historyOpen || !query) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      backend
        .searchTutorChats(query)
        .then((ids) => {
          if (!cancelled) setHistoryMatches(new Set(ids));
        })
        .catch(() => {
          if (!cancelled) setHistoryMatches(new Set());
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [backend, historyOpen, historyQuery]);

  const query = historyQuery.trim().toLowerCase();
  const visibleChats = chats.filter((chat) => {
    if (!query) return true;
    if (historyMatches) return historyMatches.has(chat.id);
    return (chat.title ?? '').toLowerCase().includes(query);
  });

  const replaceChat = (row: TutorChatRow) => setChats((list) => list.map((chat) => (chat.id === row.id ? row : chat)));

  // Names a new chat from its first question. The first words of the question stand in when the model cannot.
  const nameChat = async (id: string, question: string) => {
    if (!backend) return;
    let title = fallbackTitle(question);
    try {
      const named = await complete({
        system: TITLE_SYSTEM,
        messages: [{ role: 'user', content: question.slice(0, 600) }],
        maxTokens: 40,
      });
      title = cleanTitle(named.text, question);
    } catch {
      // The chat keeps the first words of its question as its name.
    }
    if (!title) return;
    try {
      replaceChat(await backend.renameTutorChat(id, title));
    } catch {
      // The chat works without a name, and the learner can name it in the history.
    }
  };

  const loadLibraryText = async (id: string): Promise<string> => {
    const known = libraryTexts.current.get(id);
    if (known !== undefined) return known;
    if (!backend) throw new Error('The library is not available.');
    const text = await backend.getLibraryText(id);
    libraryTexts.current.set(id, text);
    return text;
  };

  // The passages the question can use: the files of this message, or the files sent earlier in the chat.
  const documentsFor = async (files: PendingFile[], chatId: string) => {
    const images: ChatImage[] = [];
    const fresh: LibraryDocument[] = [];
    for (const file of files) {
      if (file.kind === 'image') images.push(file.image);
      else if (file.kind === 'document') fresh.push({ id: file.key, name: file.name, text: file.text });
      else fresh.push({ id: `library-${file.fileId}`, name: file.name, text: await loadLibraryText(file.fileId) });
    }
    const earlier = chatFiles.current.get(chatId) ?? [];
    if (fresh.length === 0) return { docs: earlier, images };
    const kept = [...earlier.filter((doc) => !fresh.some((item) => item.id === doc.id)), ...fresh].slice(-KEPT_FILES);
    chatFiles.current.set(chatId, kept);
    return { docs: fresh, images };
  };

  const send = async (rawText: string) => {
    const text = rawText.trim();
    const files = pending;
    if ((!text && files.length === 0) || sending || reading || messages === null || !backend || !profile || !ready) return;
    setSending(true);
    setFailure(null);
    setDraft('');
    setPending([]);
    try {
      let chatId = activeRef.current;
      if (!chatId) {
        const created = await backend.createTutorChat();
        chatId = created.id;
        activeRef.current = chatId;
        setActiveId(chatId);
        setChats((list) => [created, ...list]);
      }
      const id = chatId;
      const isFirstQuestion = (messages ?? []).length === 0;
      const userRow = await backend.addTutor(id, 'user', text, { attachments: attachmentsOf(files) });
      const history = [...(messages ?? []), userRow];
      if (activeRef.current === id) setMessages(history);
      if (isFirstQuestion) void nameChat(id, text || files.map((file) => file.name).join(', '));

      const { docs, images } = await documentsFor(files, id);
      const indexes = docs.filter((doc) => doc.text.trim()).map(indexFor);
      const question = text || (images.length > 0 ? PICTURES_ONLY : FILES_ONLY);
      const earlierQuestions = (messages ?? []).filter((row) => row.role === 'user').map((row) => row.content).slice(-2);
      const found = indexes.length > 0 ? retrieve(question, indexes, earlierQuestions) : null;
      const content = found && found.text ? `${question}\n\n---\nPassages from the learner's files:\n\n${found.text}` : question;
      const system = [
        coachSystem(profile),
        indexes.length > 0
          ? 'The learner shared files with this question. Their passages come with it, each labelled with its file. Answer from them where they help, name the file you used, and say so when they do not answer the question.'
          : '',
        images.length > 0 ? 'The learner sent pictures with this question. Look at them and answer about them.' : '',
      ]
        .filter(Boolean)
        .join('\n');

      const reply = await complete({
        system,
        messages: [...chatHistory(history.slice(0, -1)), { role: 'user', content, images }],
        maxTokens: 2048,
      });
      const coachRow = await backend.addTutor(id, 'assistant', reply.text);
      if (activeRef.current === id) setMessages((list) => [...(list ?? []), coachRow]);
    } catch (error) {
      // The message stays in the chat, and the reason stays on screen until the next try.
      const message = t(errorText(error));
      setFailure(message);
      notify(message, 'error');
    } finally {
      setSending(false);
    }
  };

  const addFiles = async (list: FileList | File[]) => {
    const picked = Array.from(list);
    if (picked.length === 0 || reading || sending) return;
    const room = MAX_FILES - pending.length;
    if (room <= 0) {
      setFailure(t('You can send up to {max} files with a message.', { max: MAX_FILES }));
      return;
    }
    setReading(true);
    setFailure(null);
    const added: PendingFile[] = [];
    let problem = picked.length > room ? t('You can send up to {max} files with a message.', { max: MAX_FILES }) : null;
    for (const file of picked.slice(0, room)) {
      try {
        added.push(await readAttachment(file));
      } catch (error) {
        problem = t(errorText(error));
      }
    }
    setReading(false);
    if (added.length > 0) setPending((items) => [...items, ...added].slice(0, MAX_FILES));
    if (problem) setFailure(problem);
  };

  const removeFile = (key: string) => setPending((items) => items.filter((item) => item.key !== key));

  const openMention = async () => {
    if (!backend) return;
    try {
      setLibraryFiles(await backend.listLibraryFiles());
      setMentionOpen(true);
    } catch (error) {
      notify(t(errorText(error)), 'error');
    }
  };

  const applyMentions = (ids: string[]) => {
    const picked = libraryFiles.filter((file) => ids.includes(file.id));
    setPending((items) =>
      [
        ...items.filter((item) => item.kind !== 'library'),
        ...picked.map((file): PendingFile => ({ key: `library-${file.id}`, kind: 'library', name: file.name, size: file.size_bytes, fileId: file.id })),
      ].slice(0, MAX_FILES),
    );
    setMentionOpen(false);
  };

  const newChat = () => {
    setHistoryOpen(false);
    setPending([]);
    setStarters(pickStarters(STARTERS, STARTER_COUNT));
    void openChat(null);
  };

  const openFromHistory = (id: string) => {
    setHistoryOpen(false);
    setPending([]);
    void openChat(id);
  };

  const renameChat = async (id: string, title: string) => {
    if (!backend) return;
    try {
      replaceChat(await backend.renameTutorChat(id, title));
    } catch (error) {
      notify(t(errorText(error)), 'error');
    }
  };

  const archiveChat = async (chat: TutorChatRow, archived: boolean) => {
    if (!backend) return;
    try {
      replaceChat(await backend.setTutorChatArchived(chat.id, archived));
      if (archived && activeRef.current === chat.id) await openChat(null);
      notify(archived ? t('Chat archived.') : t('Chat restored.'), 'ok');
    } catch (error) {
      notify(t(errorText(error)), 'error');
    }
  };

  const deleteChat = async (chat: TutorChatRow) => {
    if (!backend) return;
    try {
      await backend.deleteTutorChat(chat.id);
      chatFiles.current.delete(chat.id);
      const remaining = chats.filter((item) => item.id !== chat.id);
      setChats(remaining);
      if (activeRef.current === chat.id) await openChat(remaining.find((item) => !item.archived)?.id ?? null);
      notify(t('Chat deleted.'), 'ok');
    } catch (error) {
      notify(t(errorText(error)), 'error');
    }
  };

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    setDragOver(true);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    setDragOver(false);
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    void addFiles(event.dataTransfer.files);
  };

  const providerLabel = selection ? connections.find((item) => item.provider === selection.provider)?.label : undefined;
  const busy = sending || reading;
  const canAttach = Boolean(ready && backend && !busy && pending.length < MAX_FILES);
  const canSend = Boolean(ready && backend && !busy && messages !== null && (draft.trim() || pending.length > 0));
  const mentioned = pending.filter((file) => file.kind !== 'library').length;

  return (
    <div className="page page--coach">
      <PageHeader
        eyebrow={activeChat?.title || t('Ask anything')}
        title={t('Coach')}
        aside={
          <>
            {ready && providerLabel && (
              <span className="chip chip--ai">
                <Sparkles aria-hidden="true" /> {providerLabel}
              </span>
            )}
            <button className="btn btn--ghost btn--sm" onClick={newChat} disabled={sending || !backend}>
              <Plus /> {t('New chat')}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setHistoryOpen(true)} disabled={!backend}>
              <History /> {t('History')}
            </button>
          </>
        }
      />

      {!ready &&
        (desktop ? (
          <Notice tone="info">
            {t('Add your AI key to start chatting with your coach.')}{' '}
            <button className="btn btn--text" onClick={() => navigate('/settings')}>
              {t('Open settings')}
            </button>
          </Notice>
        ) : (
          <Notice tone="info">{t('The coach runs in the danna desktop app, where your AI key is kept on this device.')}</Notice>
        ))}

      <div className="coach__list" ref={listRef} aria-live="polite">
        {messages === null ? (
          <Skeleton height={260} />
        ) : (
          <div className="chat">
            {messages.length === 0 && ready && (
              <div className="stack">
                <p className="muted">{t('Ask anything about English. Try one of these to start.')}</p>
                <div className="suggest">
                  {starters.map((suggestion) => (
                    <button key={suggestion} onClick={() => send(t(suggestion))} disabled={sending}>
                      {t(suggestion)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.role === 'user' ? 'message--user' : 'message--coach'}`}>
                {message.attachments.length > 0 && (
                  <div className="message__files">
                    {message.attachments.map((file, index) => (
                      <span key={`${file.name}-${index}`} className="file-chip file-chip--static">
                        {file.kind === 'library' ? (
                          <BookOpen aria-hidden="true" />
                        ) : file.kind === 'image' ? (
                          <ImageIcon aria-hidden="true" />
                        ) : (
                          <FileText aria-hidden="true" />
                        )}
                        <span className="file-chip__name">{file.name}</span>
                      </span>
                    ))}
                  </div>
                )}
                {message.content && <div className={`bubble ${message.role === 'user' ? 'bubble--user' : 'bubble--coach'}`}>{message.content}</div>}
              </div>
            ))}
            {sending && (
              <div className="bubble bubble--coach muted" aria-label={t('Coach is typing')}>
                {t('Thinking…')}
              </div>
            )}
            {failure && <Notice tone="error">{failure}</Notice>}
          </div>
        )}
      </div>

      <div className={`coach__composer ${dragOver ? 'is-over' : ''}`} onDragOver={onDragOver} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
        {(pending.length > 0 || reading) && (
          <div className="composer-files" aria-label={t('Files for this message')}>
            {pending.map((file) => (
              <span key={file.key} className={`file-chip file-chip--${file.kind}`}>
                {file.kind === 'image' ? (
                  <img className="file-chip__thumb" src={file.preview} alt="" />
                ) : file.kind === 'library' ? (
                  <BookOpen aria-hidden="true" />
                ) : (
                  <FileText aria-hidden="true" />
                )}
                <span className="file-chip__name">{file.name}</span>
                <button className="file-chip__remove" onClick={() => removeFile(file.key)} aria-label={t('Remove {name}', { name: file.name })} title={t('Remove')}>
                  <X aria-hidden="true" />
                </button>
              </span>
            ))}
            {reading && (
              <span className="file-chip file-chip--busy">
                <Spinner /> {t('Reading files…')}
              </span>
            )}
            <span className="composer-files__count small muted">{t('{count} of {max} files', { count: pending.length, max: MAX_FILES })}</span>
          </div>
        )}
        <div className="chat-input">
          <button
            className="btn btn--ghost btn--icon"
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={!canAttach}
            aria-label={t('Attach files')}
            title={t('Attach files')}
          >
            <Paperclip />
          </button>
          <button
            className="btn btn--ghost btn--icon"
            type="button"
            onClick={() => void openMention()}
            disabled={!canAttach}
            aria-label={t('Mention a library file')}
            title={t('Mention a library file')}
          >
            <AtSign />
          </button>
          <textarea
            rows={1}
            value={draft}
            placeholder={t('Ask your coach…')}
            disabled={!ready || busy}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKey}
            aria-label={t('Message your coach')}
          />
          <button className="btn btn--primary btn--icon" onClick={() => send(draft)} disabled={!canSend} aria-label={t('Send message')}>
            <ArrowUp />
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {historyOpen && (
        <ChatHistory
          chats={visibleChats}
          searching={Boolean(query)}
          query={historyQuery}
          activeId={activeId}
          busy={busy}
          onQuery={setHistoryQuery}
          onOpen={openFromHistory}
          onNew={newChat}
          onRename={renameChat}
          onArchive={archiveChat}
          onDelete={deleteChat}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {mentionOpen && (
        <MentionSheet
          files={libraryFiles}
          chosen={pending.flatMap((file) => (file.kind === 'library' ? [file.fileId] : []))}
          limit={MAX_FILES - mentioned}
          onConfirm={applyMentions}
          onClose={() => setMentionOpen(false)}
        />
      )}
    </div>
  );
}
