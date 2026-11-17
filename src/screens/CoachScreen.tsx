// The coach: a list of chats, each with its own history and its own way of working (a mode). A reply is written as
// it comes, and can be stopped, written again, edited or continued. The learner's answers, files and voice go in
// the same message box. A chat is named from its first question.
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp, AtSign, BookOpen, Download, FileText, History, Image as ImageIcon, Paperclip, Plus, Sparkles, Square, Volume2, VolumeX, X } from 'lucide-react';
import { AssistantReply, LearnerTurn } from '../components/CoachReply';
import { CoachHome } from '../components/CoachHome';
import { ChatHistory } from '../components/ChatHistory';
import { MentionSheet } from '../components/MentionSheet';
import { useVoiceInput, VoiceButton } from '../components/VoiceInput';
import { Notice, Skeleton, Spinner } from '../components/ui';
import { readAttachment } from '../lib/attachments';
import { chatHistory, coachSystem } from '../lib/ai';
import { errorText } from '../lib/bridge';
import { attachmentsOf, titleFromQuestion, MAX_FILES, pickStarters, STARTERS, STARTER_COUNT, type PendingFile } from '../lib/coach';
import { learnerContext } from '../lib/coachContext';
import { coachMode, type CoachModeId } from '../lib/coachModes';
import { parseCoachReply, spokenText, type VocabItem } from '../lib/coachReply';
import { vocabReview } from '../lib/coachVocab';
import { draftKey } from '../lib/drafts';
import { indexFor, retrieve, type LibraryDocument } from '../lib/retrieval';
import { activeExamDate } from '../lib/exam';
import { localDate } from '../lib/progress';
import { useT } from '../lib/i18n/react';
import { narrate, type Narration } from '../lib/speech';
import type { ChatImage, ChatMessage, LibraryFileRow, ReviewRow, TutorChatRow, TutorRow } from '../lib/types';
import { useAI, type ReplyStream } from '../state/ai';
import { useAppData } from '../state/appData';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,.md,.markdown,.txt,.pdf';
// The text of the files sent in a chat is kept for its follow-up questions, up to this many files.
const KEPT_FILES = 20;
// The reply budget: a long text can come back with its corrections, a model version and the explanations.
const REPLY_TOKENS = 4096;
const AUTO_READ_KEY = 'danna.coach.autoRead';

// What the model is asked when a message has files but no question. Not shown to the learner.
const FILES_ONLY = 'Summarize these files and tell me what matters most for learning English.';
const PICTURES_ONLY = 'Describe these pictures and tell me what is useful for learning English in them.';

/** A reply that is still being written: its chat, and the text so far. */
interface LiveReply {
  chatId: string;
  text: string;
}

function readAutoRead(): boolean {
  try {
    return window.localStorage.getItem(AUTO_READ_KEY) === '1';
  } catch {
    return false;
  }
}

function saveAutoRead(value: boolean): void {
  try {
    window.localStorage.setItem(AUTO_READ_KEY, value ? '1' : '0');
  } catch {
    // The choice is asked again next time.
  }
}

/** A file name made from a title: letters, digits and dashes only. */
function fileName(title: string): string {
  const clean = title.replace(/[^\p{L}\p{N} -]+/gu, '').trim().replace(/\s+/g, '-').slice(0, 60);
  return `${clean || 'coach-chat'}.md`;
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CoachScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const { backend } = useAuth();
  const { profile, skills } = useAppData();
  const { ready, selection, connections, desktop, canTranscribe, startReply, transcribe } = useAI();
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
  // The mode a new chat starts in, chosen on the home. Null means the free chat, until a mode is chosen.
  const [pendingMode, setPendingMode] = useState<CoachModeId | null>(null);
  const [live, setLive] = useState<LiveReply | null>(null);
  const [cutReplies, setCutReplies] = useState<ReadonlySet<string>>(() => new Set());
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewKeys, setReviewKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [autoRead, setAutoRead] = useState(readAutoRead);
  const [showJump, setShowJump] = useState(false);
  // A few questions for the home, picked again for each visit.
  const [starters, setStarters] = useState(() => pickStarters(STARTERS, STARTER_COUNT));

  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // The chat on screen. A reply is saved to the chat it was asked in, even if the learner has moved on.
  const activeRef = useRef<string | null>(null);
  // The text of the files sent earlier in each chat, so a follow-up question can still use them.
  const chatFiles = useRef(new Map<string, LibraryDocument[]>());
  const libraryTexts = useRef(new Map<string, string>());
  // The reply being written, so it can be stopped.
  const replyStream = useRef<ReplyStream | null>(null);
  // The newest text of the reply being written, shown at most once per frame.
  const liveFrame = useRef<number | null>(null);
  const liveNext = useRef<LiveReply | null>(null);
  // The list follows the newest message, until the learner scrolls up to read earlier ones.
  const stickToBottom = useRef(true);
  const narration = useRef<Narration | null>(null);

  const activeChat = chats.find((chat) => chat.id === activeId) ?? null;
  const activeMode = coachMode(activeChat ? activeChat.mode : pendingMode);
  const providerLabel = selection ? connections.find((item) => item.provider === selection.provider)?.label : undefined;
  const busy = sending || reading;
  const canAttach = Boolean(ready && backend && !busy && pending.length < MAX_FILES);
  const canSend = Boolean(ready && backend && !busy && messages !== null && (draft.trim() || pending.length > 0));
  const mentioned = pending.filter((file) => file.kind !== 'library').length;
  // The quick replies show under the newest reply only, and only while it is still the last message in the chat.
  const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;
  const latestReplyId = lastMessage?.role === 'assistant' ? lastMessage.id : null;
  // Only the newest question can be edited and sent again.
  const lastQuestionId = messages ? ([...messages].reverse().find((row) => row.role === 'user')?.id ?? null) : null;
  const emptyChat = messages !== null && messages.length === 0 && !sending && live === null;
  const showHome = emptyChat && pendingMode === null && !(activeChat && activeChat.mode && activeChat.mode !== 'chat');
  const showIntro = emptyChat && !showHome;
  const recentChats = useMemo(() => chats.filter((chat) => !chat.archived).slice(0, 3), [chats]);
  const visibleLive = live !== null && live.chatId === activeId ? live : null;

  const scrollToEnd = useCallback(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, []);

  const openChat = useCallback(
    async (id: string | null) => {
      activeRef.current = id;
      setActiveId(id);
      setFailure(null);
      stickToBottom.current = true;
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

  // On open, the chat a search result asked for is shown, else the newest chat that is not archived. Without one, the
  // home is ready to start a chat.
  useEffect(() => {
    if (!backend) return undefined;
    let cancelled = false;
    const requested = (location.state as { chatId?: string } | null)?.chatId;
    backend
      .listTutorChats()
      .then((rows) => {
        if (cancelled) return undefined;
        setChats(rows);
        const target = requested && rows.some((chat) => chat.id === requested) ? requested : (rows.find((chat) => !chat.archived)?.id ?? null);
        return openChat(target);
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

  // The answers to review are the learner's learning record: they tell the coach what to practise, and show which words are saved.
  useEffect(() => {
    if (!backend) return undefined;
    let cancelled = false;
    backend
      .listReviewItems()
      .then((rows) => {
        if (cancelled) return;
        const newest = [...rows].sort((a, b) => b.due_at.localeCompare(a.due_at));
        setReviews(newest);
        setReviewKeys(new Set(rows.map((row) => row.item_key)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [backend]);

  // A search result that asks for a chat, while the coach is already open. The request is used once.
  useEffect(() => {
    const requested = (location.state as { chatId?: string } | null)?.chatId;
    if (!requested) return;
    void openChat(requested);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, navigate, openChat]);

  // The newest text follows the list while the learner is at its end.
  useEffect(() => {
    if (stickToBottom.current) scrollToEnd();
  }, [messages?.length, visibleLive?.text, sending, failure, activeId, scrollToEnd]);

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

  // Stops any reply still being drawn, and the speech, when the screen is left.
  useEffect(
    () => () => {
      if (liveFrame.current !== null) window.cancelAnimationFrame(liveFrame.current);
      narration.current?.stop();
    },
    [],
  );

  const query = historyQuery.trim().toLowerCase();
  const visibleChats = chats.filter((chat) => {
    if (!query) return true;
    if (historyMatches) return historyMatches.has(chat.id);
    return (chat.title ?? '').toLowerCase().includes(query);
  });

  const replaceChat = (row: TutorChatRow) => setChats((list) => list.map((chat) => (chat.id === row.id ? row : chat)));

  // Names a new chat from the learner's own first question. No model writes the name, so it is in their language.
  const nameChat = async (id: string, question: string) => {
    if (!backend) return;
    const title = titleFromQuestion(question);
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

  // The learner's facts, the mode's instructions and the shared rules make the instructions of one reply.
  const instructionsFor = (modeId: CoachModeId, notes: string[]): string => {
    const facts = profile
      ? learnerContext({
          profile: {
            level: profile.level,
            goal: profile.goal,
            target_score: profile.target_score,
            exam_date: activeExamDate(profile),
            exam_name: profile.exam_name,
          },
          skills,
          mistakes: reviews,
          today: localDate(),
        })
      : '';
    return [profile ? coachSystem(profile) : '', facts, coachMode(modeId).instructions, ...notes].filter(Boolean).join('\n\n');
  };

  // Shows the reply's text as it is written, at most once per frame, so a fast reply does not stall the screen.
  const showLive = (chatId: string, text: string) => {
    liveNext.current = { chatId, text };
    if (liveFrame.current !== null) return;
    liveFrame.current = window.requestAnimationFrame(() => {
      liveFrame.current = null;
      if (liveNext.current) setLive(liveNext.current);
    });
  };

  const speak = (text: string) => {
    const words = spokenText(parseCoachReply(text));
    if (!words) return;
    narration.current?.stop();
    narration.current = narrate(words, {
      onStart: () => undefined,
      onEnd: () => {
        narration.current = null;
      },
      onNotice: (message) => notify(message),
    });
  };

  // Writes a reply to the chat, as it is drawn. The whole reply is saved when it is complete, or when it is stopped.
  const runReply = async (chatId: string, conversation: ChatMessage[], modeId: CoachModeId, notes: string[] = []) => {
    if (!backend || !profile) return;
    setSending(true);
    setFailure(null);
    setLive({ chatId, text: '' });
    let written = '';
    const stream = startReply({ system: instructionsFor(modeId, notes), messages: conversation, maxTokens: REPLY_TOKENS }, (piece) => {
      written += piece;
      showLive(chatId, written);
    });
    replyStream.current = stream;
    try {
      const result = await stream.done;
      const text = result.text;
      if (text.trim()) {
        const row = await backend.addTutor(chatId, 'assistant', text);
        if (result.cut) setCutReplies((set) => new Set(set).add(row.id));
        if (activeRef.current === chatId) setMessages((list) => [...(list ?? []), row]);
        if (autoRead && !result.aborted && activeRef.current === chatId) speak(text);
      }
    } catch (error) {
      const message = t(errorText(error));
      if (activeRef.current === chatId) setFailure(message);
      notify(message, 'error');
    } finally {
      if (liveFrame.current !== null) window.cancelAnimationFrame(liveFrame.current);
      liveFrame.current = null;
      liveNext.current = null;
      replyStream.current = null;
      setLive(null);
      setSending(false);
    }
  };

  // A quick reply or an exercise answer is sent as text alone. The draft and the files waiting for a message stay as they are.
  const send = async (rawText: string, options: { asText?: boolean; mode?: CoachModeId } = {}) => {
    const { asText = false, mode } = options;
    const text = rawText.trim();
    const files = asText ? [] : pending;
    if ((!text && files.length === 0) || sending || reading || messages === null || !backend || !profile || !ready) return;
    setFailure(null);
    if (!asText) {
      setDraft('');
      setPending([]);
    }
    try {
      let chatId = activeRef.current;
      let modeId: CoachModeId;
      if (!chatId) {
        // A new chat starts in the mode the learner chose: the mode of this send, else the one chosen on the home.
        modeId = mode ?? pendingMode ?? 'chat';
        const created = await backend.createTutorChat({ mode: modeId });
        chatId = created.id;
        activeRef.current = chatId;
        setActiveId(chatId);
        setChats((list) => [created, ...list]);
        setPendingMode(null);
      } else {
        modeId = coachMode(chats.find((chat) => chat.id === chatId)?.mode ?? null).id;
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
      const notes = [
        indexes.length > 0
          ? 'The learner shared files with this question. Their passages come with it, each labelled with its file. Answer from them where they help, name the file you used, and say so when they do not answer the question.'
          : '',
        images.length > 0 ? 'The learner sent pictures with this question. Look at them and answer about them.' : '',
      ].filter(Boolean);
      const conversation: ChatMessage[] = [...chatHistory(history.slice(0, -1)), { role: 'user', content, images }];
      await runReply(id, conversation, modeId, notes);
    } catch (error) {
      const message = t(errorText(error));
      setFailure(message);
      notify(message, 'error');
    }
  };

  // Starts a mode from the home: a mode that begins at once sends its opening message; the others wait for the learner.
  const startMode = (id: CoachModeId) => {
    const mode = coachMode(id);
    setFailure(null);
    if (mode.start === 'send' && mode.opener) {
      void send(t(mode.opener), { mode: id });
      return;
    }
    setPendingMode(id);
    setPending([]);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  };

  // Writes the newest reply again: the old one is removed, and the model answers the same question.
  const regenerate = async () => {
    const id = activeRef.current;
    if (busy || !backend || messages === null || !id) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    const history = messages.slice(0, -1);
    if (history.length === 0) return;
    try {
      await backend.deleteTutorMessage(last.id);
    } catch (error) {
      notify(t(errorText(error)), 'error');
      return;
    }
    setMessages(history);
    setCutReplies((set) => {
      const next = new Set(set);
      next.delete(last.id);
      return next;
    });
    await runReply(id, chatHistory(history), coachMode(activeChat ? activeChat.mode : pendingMode).id);
  };

  // Puts the newest question back in the message box, so the learner can change it and send it again.
  const editLast = async () => {
    if (busy || !backend || messages === null) return;
    let index = -1;
    for (let position = messages.length - 1; position >= 0; position -= 1) {
      if (messages[position].role === 'user') {
        index = position;
        break;
      }
    }
    if (index < 0) return;
    const edited = messages[index];
    try {
      for (const row of messages.slice(index)) await backend.deleteTutorMessage(row.id);
    } catch (error) {
      notify(t(errorText(error)), 'error');
      return;
    }
    setMessages(messages.slice(0, index));
    setDraft(edited.content);
    if (edited.attachments.length > 0) notify(t('Attach the files again, if you still need them.'));
    window.setTimeout(() => composerRef.current?.focus(), 0);
  };

  const stopReply = () => {
    replyStream.current?.stop();
  };

  const continueReply = () => {
    void send(t('Continue'), { asText: true });
  };

  const copyText = (text: string) => {
    const copied = () => notify(t('Copied.'), 'ok');
    const failed = () => notify(t('The text could not be copied.'), 'error');
    // Some windows refuse the clipboard API, and then the button did nothing. A hidden field copies the text instead:
    // the copy follows the learner's click, so the browser allows it.
    const copyByField = () => {
      const field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand('copy');
      field.remove();
      if (ok) copied();
      else failed();
    };
    if (!navigator.clipboard) {
      copyByField();
      return;
    }
    navigator.clipboard.writeText(text).then(copied, copyByField);
  };

  const saveWord = async (item: VocabItem): Promise<boolean> => {
    if (!backend) return false;
    const row = vocabReview(item);
    if (!row) {
      notify(t('This example does not use the word, so it cannot be saved.'), 'error');
      return false;
    }
    if (reviewKeys.has(row.item_key)) {
      notify(t('This word is already in your review.'), 'ok');
      return true;
    }
    try {
      await backend.upsertReviewItems([row]);
      setReviewKeys((keys) => new Set(keys).add(row.item_key));
      notify(t('Saved to your review.'), 'ok');
      return true;
    } catch (error) {
      notify(t(errorText(error)), 'error');
      return false;
    }
  };

  const exportChat = () => {
    if (!messages || messages.length === 0) return;
    const title = activeChat?.title || t('Coach chat');
    const lines = [`# ${title}`, ''];
    for (const row of messages) {
      const who = row.role === 'user' ? t('You') : t('Coach');
      const body = row.role === 'assistant' ? parseCoachReply(row.content).flatMap((part) => (part.kind === 'text' ? [part.text] : [])).join('\n\n') : row.content;
      lines.push(`**${who}:** ${body}`, '');
    }
    download(new Blob([lines.join('\n')], { type: 'text/markdown' }), fileName(title));
  };

  const toggleAutoRead = () => {
    const next = !autoRead;
    setAutoRead(next);
    saveAutoRead(next);
    if (!next) narration.current?.stop();
  };

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && sending) {
      event.preventDefault();
      stopReply();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
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

  const voice = useVoiceInput(
    transcribe,
    (text) => {
      // In speaking practice the words go straight to the coach, as the learner would say them.
      if (activeMode.id === 'speaking') void send(text);
      else setDraft((value) => (value.trim() ? `${value.trimEnd()} ${text}` : text));
    },
    (error) => notify(t(errorText(error)), 'error'),
  );

  const newChat = () => {
    setHistoryOpen(false);
    setPending([]);
    setPendingMode(null);
    setFailure(null);
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
      notify(t('Chat renamed.'), 'ok');
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

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!event.clipboardData.files.length || !canAttach) return;
    event.preventDefault();
    void addFiles(event.clipboardData.files);
  };

  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;
    const nearEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 140;
    stickToBottom.current = nearEnd;
    setShowJump(!nearEnd);
  };

  const jumpToEnd = () => {
    stickToBottom.current = true;
    setShowJump(false);
    scrollToEnd();
  };

  const modeTitle = t(activeMode.title);
  const sendButton = sending && replyStream.current ? (
    <button type="button" className="btn btn--primary btn--icon coach-send" onClick={stopReply} aria-label={t('Stop writing')} title={t('Stop writing')}>
      <Square aria-hidden="true" />
    </button>
  ) : (
    <button type="button" className="btn btn--primary btn--icon coach-send" onClick={() => send(draft)} disabled={!canSend} aria-label={t('Send message')} title={t('Send message')}>
      <ArrowUp aria-hidden="true" />
    </button>
  );

  return (
    <div className="page page--coach coach">
      <header className="coach-bar">
        <div className="coach-bar__main">
          <p className="coach-bar__mode">{modeTitle}</p>
          <h1 className="coach-bar__title">{activeChat?.title || t('Coach')}</h1>
        </div>
        <div className="coach-bar__tools">
          {ready && providerLabel && (
            <span className="chip chip--ai">
              <Sparkles aria-hidden="true" /> {providerLabel}
            </span>
          )}
          <button
            type="button"
            className={`btn btn--ghost btn--icon${autoRead ? ' is-on' : ''}`}
            onClick={toggleAutoRead}
            aria-pressed={autoRead}
            aria-label={autoRead ? t('Stop reading the answers aloud') : t('Read the answers aloud')}
            title={autoRead ? t('Stop reading the answers aloud') : t('Read the answers aloud')}
          >
            {autoRead ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={exportChat}
            disabled={!messages || messages.length === 0}
            aria-label={t('Save this chat as a file')}
            title={t('Save this chat as a file')}
          >
            <Download aria-hidden="true" />
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={newChat} disabled={sending || !backend}>
            <Plus aria-hidden="true" /> {t('New chat')}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setHistoryOpen(true)} disabled={!backend}>
            <History aria-hidden="true" /> {t('History')}
          </button>
        </div>
      </header>

      {!ready &&
        (desktop ? (
          <Notice tone="info">
            {t('Add your AI key to start chatting with your coach.')}{' '}
            <button type="button" className="btn btn--text" onClick={() => navigate('/settings')}>
              {t('Open settings')}
            </button>
          </Notice>
        ) : (
          <Notice tone="info">{t('The coach runs in the danna desktop app, where your AI key is kept on this device.')}</Notice>
        ))}

      <div className="coach__scroll" ref={listRef} onScroll={onScroll} aria-live="polite">
        <div className="coach__column">
          {messages === null ? (
            <Skeleton height={320} />
          ) : showHome ? (
            <CoachHome
              level={profile?.level ?? 'B1'}
              goal={profile?.goal ?? 'english'}
              targetScore={profile?.target_score ?? 100}
              examDate={activeExamDate(profile)}
              examName={profile?.exam_name ?? null}
              skills={skills}
              reviewCount={reviews.length}
              recentChats={recentChats}
              starters={starters}
              busy={busy || !ready}
              onMode={startMode}
              onOpenChat={openFromHistory}
              onStarter={(text) => void send(text)}
              onNavigate={navigate}
            />
          ) : (
            <div className="coach__thread">
              {showIntro && (
                <section className="mode-intro" aria-label={modeTitle}>
                  <p className="mode-intro__title">{modeTitle}</p>
                  <p className="mode-intro__text">{t(activeMode.blurb)}</p>
                  <p className="mode-intro__hint">{t('Write or attach what you want to work on, then send it.')}</p>
                </section>
              )}
              {messages.map((message) =>
                message.role === 'user' ? (
                  <LearnerTurn
                    key={message.id}
                    text={message.content}
                    editable={message.id === lastQuestionId}
                    busy={busy}
                    onCopy={copyText}
                    onEdit={() => void editLast()}
                    files={
                      message.attachments.length > 0 ? (
                        <div className="turn__files">
                          {message.attachments.map((file, index) => (
                            <span key={`${file.name}-${index}`} className="file-chip file-chip--static">
                              {file.kind === 'library' ? <BookOpen aria-hidden="true" /> : file.kind === 'image' ? <ImageIcon aria-hidden="true" /> : <FileText aria-hidden="true" />}
                              <span className="file-chip__name">{file.name}</span>
                            </span>
                          ))}
                        </div>
                      ) : null
                    }
                  />
                ) : (
                  message.content && (
                    <AssistantReply
                      key={message.id}
                      id={message.id}
                      text={message.content}
                      latest={message.id === latestReplyId && !visibleLive}
                      busy={busy}
                      cut={cutReplies.has(message.id)}
                      draftPrefix={profile ? draftKey(profile.id, `coach-exercise:${message.id}`) : null}
                      reviewKeys={reviewKeys}
                      onSend={(text) => void send(text, { asText: true })}
                      onSaveWord={saveWord}
                      onNavigate={navigate}
                      onRegenerate={() => void regenerate()}
                      onContinue={continueReply}
                      onCopy={copyText}
                    />
                  )
                ),
              )}
              {visibleLive && (
                <AssistantReply
                  id="writing"
                  text={visibleLive.text}
                  streaming
                  latest={false}
                  busy
                  cut={false}
                  draftPrefix={null}
                  reviewKeys={reviewKeys}
                  onSend={() => undefined}
                  onSaveWord={async () => false}
                  onNavigate={navigate}
                  onRegenerate={() => undefined}
                  onContinue={() => undefined}
                  onCopy={copyText}
                />
              )}
              {sending && !visibleLive && (
                <div className="turn turn--coach" aria-label={t('Coach is typing')}>
                  <span className="turn__avatar" aria-hidden="true">
                    <span className="turn__mark" />
                  </span>
                  <div className="turn__body">
                    <span className="typing" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                </div>
              )}
              {failure && <Notice tone="error">{failure}</Notice>}
            </div>
          )}
        </div>
      </div>

      {showJump && (
        <button type="button" className="coach-jump" onClick={jumpToEnd} aria-label={t('Jump to the newest message')}>
          {t('Newest')}
        </button>
      )}

      <div className={`coach__dock${dragOver ? ' is-over' : ''}`} onDragOver={onDragOver} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
        <div className="coach__column">
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
                  <button type="button" className="file-chip__remove" onClick={() => removeFile(file.key)} aria-label={t('Remove {name}', { name: file.name })} title={t('Remove')}>
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
          <div className="composer">
            <textarea
              ref={composerRef}
              className="composer__input"
              rows={1}
              value={draft}
              placeholder={t(activeMode.start === 'send' ? 'Ask your coach…' : activeMode.id === 'writing' ? 'Paste your text here…' : 'Ask your coach…')}
              disabled={!ready || busy}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKey}
              onPaste={onPaste}
              aria-label={t('Message your coach')}
            />
            <div className="composer__bar">
              <div className="composer__tools">
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  onClick={() => fileInput.current?.click()}
                  disabled={!canAttach}
                  aria-label={t('Attach files')}
                  title={t('Attach files')}
                >
                  <Paperclip aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  onClick={() => void openMention()}
                  disabled={!canAttach}
                  aria-label={t('Mention a library file')}
                  title={t('Mention a library file')}
                >
                  <AtSign aria-hidden="true" />
                </button>
                <VoiceButton
                  phase={voice.phase}
                  supported={voice.supported}
                  enabled={Boolean(ready && canTranscribe)}
                  onStart={() => void voice.start()}
                  onStop={voice.stop}
                />
                {voice.phase === 'recording' && <span className="composer__status">{t('Listening… press the microphone to stop.')}</span>}
                {voice.phase === 'writing' && <span className="composer__status">{t('Writing down what you said…')}</span>}
              </div>
              <span className="composer__hint">{t('Enter to send · Shift+Enter for a new line · Esc to stop')}</span>
              {sendButton}
            </div>
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
