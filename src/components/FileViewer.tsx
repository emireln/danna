// Shows a library file: PDF pages, plain text, or Markdown rendered as a document. TXT and Markdown files are
// edited and saved in place. A PDF keeps its pages, so its text is saved as a new Markdown file. Find works like
// the Find box of Notepad: Ctrl+F opens it, Enter goes to the next match, Shift+Enter to the previous one, and
// Escape closes it.
import {
  Children,
  Fragment,
  createContext,
  createElement,
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { ChevronDown, ChevronUp, Pencil, Search, X } from 'lucide-react';
import { ConfirmSheet, Notice, SearchField, Spinner } from './ui';
import { errorText } from '../lib/bridge';
import { findRanges, pageHits, splitHits } from '../lib/find';
import { KIND_MIME, LIBRARY_MAX_BYTES, LIBRARY_TEXT_LIMIT } from '../lib/library';
import { drawPdf, pdfPageTexts } from '../lib/pdf';
import { useT } from '../lib/i18n/react';
import type { LibraryFileRow } from '../lib/types';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';

type Loaded =
  | { status: 'loading' }
  | { status: 'text'; text: string }
  | { status: 'pdf'; bytes: ArrayBuffer }
  | { status: 'error'; message: string };

interface FindOptions {
  query: string;
  matchCase: boolean;
}

const FindContext = createContext<FindOptions>({ query: '', matchCase: false });

// Marks the matches in the words of a block. Elements inside it, such as bold text, mark their own words.
function markWords(children: ReactNode, options: FindOptions): ReactNode {
  if (!options.query) return children;
  return Children.map(children, (child) => {
    if (typeof child !== 'string') return child;
    return splitHits(child, options.query, options.matchCase).map((span, index) =>
      span.hit ? (
        <mark key={index} className="find-hit">
          {span.text}
        </mark>
      ) : (
        <Fragment key={index}>{span.text}</Fragment>
      ),
    );
  });
}

type MarkedTag = 'p' | 'li' | 'h1' | 'h2' | 'h3' | 'h4' | 'blockquote' | 'td' | 'th' | 'strong' | 'em' | 'del' | 'a' | 'code';

// A Markdown element that marks the matches in its words. One component is made per tag, so React keeps it.
function marked(tag: MarkedTag) {
  function Part({ node: _node, children, ...props }: { node?: unknown; children?: ReactNode }) {
    const options = useContext(FindContext);
    return createElement(tag, props as HTMLAttributes<HTMLElement>, markWords(children, options));
  }
  return Part;
}

const MARKED: Components = {
  p: marked('p'),
  li: marked('li'),
  h1: marked('h1'),
  h2: marked('h2'),
  h3: marked('h3'),
  h4: marked('h4'),
  blockquote: marked('blockquote'),
  td: marked('td'),
  th: marked('th'),
  strong: marked('strong'),
  em: marked('em'),
  del: marked('del'),
  a: marked('a'),
  code: marked('code'),
};

// The Markdown is parsed again only when the text changes. The find box changes the marks, not the parsing.
const MarkdownText = memo(function MarkdownText({ text }: { text: string }) {
  return <ReactMarkdown components={MARKED}>{text}</ReactMarkdown>;
});

// The styles a hidden copy of a text box needs, so that the copy lays out the words the same way the box does.
const LAYOUT_STYLES = [
  'boxSizing',
  'width',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'tabSize',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
] as const;

// Scrolls a text box so that the character at index sits near its top. A browser scrolls a text box to its
// selection only while the box has the focus, so the place is measured in a hidden copy with the same layout.
function scrollBoxTo(field: HTMLTextAreaElement, index: number) {
  const style = getComputedStyle(field);
  const copy = document.createElement('div');
  for (const name of LAYOUT_STYLES) copy.style[name] = style[name];
  Object.assign(copy.style, { position: 'absolute', visibility: 'hidden', top: '0', left: '-10000px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
  const marker = document.createElement('span');
  marker.textContent = field.value.slice(index, index + 1) || ' ';
  copy.textContent = field.value.slice(0, index);
  copy.appendChild(marker);
  document.body.appendChild(copy);
  const top = marker.offsetTop;
  copy.remove();
  field.scrollTop = Math.max(0, top - field.clientHeight / 3);
}

export function FileViewer({ file, onClose, onChanged }: { file: LibraryFileRow; onClose: () => void; onChanged: () => void }) {
  const { backend } = useAuth();
  const { notify } = useToast();
  const t = useT();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [discard, setDiscard] = useState<'close' | 'stop' | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [current, setCurrent] = useState(0);
  const [viewMatches, setViewMatches] = useState(0);
  const [pdfPages, setPdfPages] = useState<string[] | null>(null);
  const pages = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const findBox = useRef<HTMLInputElement>(null);

  const isPdf = file.kind === 'pdf';
  const ready = loaded.status === 'text' || loaded.status === 'pdf';
  const dirty = editing && draft !== saved;
  const options = useMemo<FindOptions>(() => ({ query, matchCase }), [query, matchCase]);
  const editMatches = useMemo(
    () => (editing && findOpen ? findRanges(draft, query, matchCase) : []),
    [editing, findOpen, draft, query, matchCase],
  );
  const pdfMatches = useMemo(
    () => (isPdf && !editing && findOpen && pdfPages ? pageHits(pdfPages, query, matchCase) : []),
    [isPdf, editing, findOpen, pdfPages, query, matchCase],
  );
  const total = editing ? editMatches.length : isPdf ? pdfMatches.length : viewMatches;
  const active = total > 0 ? Math.min(current, total - 1) : 0;

  useEffect(() => {
    let alive = true;
    setLoaded({ status: 'loading' });
    (async () => {
      try {
        const blob = backend ? await backend.getLibraryBlob(file.id) : null;
        if (!blob) throw new Error('The file is not here.');
        const next: Loaded = isPdf ? { status: 'pdf', bytes: await blob.arrayBuffer() } : { status: 'text', text: await blob.text() };
        if (alive) setLoaded(next);
      } catch {
        if (alive) setLoaded({ status: 'error', message: 'This file is not available on this device yet.' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [backend, file.id, isPdf]);

  useEffect(() => {
    if (loaded.status !== 'pdf' || !pages.current) return undefined;
    let cancelled = false;
    drawPdf(loaded.bytes, pages.current, () => cancelled).catch(() => {
      if (!cancelled) setLoaded({ status: 'error', message: 'This PDF could not be shown. The coach can still read its text.' });
    });
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  // The text of each PDF page is read the first time Find is used on it.
  useEffect(() => {
    if (loaded.status !== 'pdf' || !findOpen || pdfPages) return undefined;
    let alive = true;
    pdfPageTexts(loaded.bytes)
      .then((texts) => {
        if (alive) setPdfPages(texts);
      })
      .catch(() => {
        if (alive) setPdfPages([]);
      });
    return () => {
      alive = false;
    };
  }, [loaded, findOpen, pdfPages]);

  // Marks the matches of the text as shown, and brings the current one into view.
  useEffect(() => {
    if (editing || loaded.status !== 'text' || !body.current) return;
    const marks = Array.from(body.current.querySelectorAll<HTMLElement>('mark.find-hit'));
    setViewMatches(marks.length);
    marks.forEach((mark, index) => mark.classList.toggle('is-current', index === active));
    marks[active]?.scrollIntoView({ block: 'center' });
  }, [editing, loaded, options, active]);

  // A new search in a PDF goes to its first match. The Next and Previous buttons move on from there.
  useEffect(() => {
    if (isPdf && !editing && pdfMatches.length > 0) scrollToPage(pdfMatches[0].page);
  }, [isPdf, editing, pdfMatches]);

  useEffect(() => {
    if (findOpen) findBox.current?.focus();
  }, [findOpen]);

  function scrollToPage(page: number) {
    const canvas = pages.current?.children.item(page - 1);
    if (canvas instanceof HTMLElement) canvas.scrollIntoView({ block: 'start' });
  }

  // The match is selected and scrolled into view. The focus stays in the Find box, so Enter keeps going to the next
  // match instead of typing a new line into the text.
  function selectInEditor(index: number) {
    const range = editMatches[index];
    const field = editor.current;
    if (!range || !field) return;
    field.setSelectionRange(range[0], range[1]);
    scrollBoxTo(field, range[0]);
  }

  function step(delta: number) {
    if (total === 0) return;
    const next = (active + delta + total) % total;
    setCurrent(next);
    if (editing) selectInEditor(next);
    else if (isPdf) scrollToPage(pdfMatches[next].page);
  }

  function closeFind() {
    setFindOpen(false);
    setQuery('');
    setCurrent(0);
  }

  function requestClose() {
    if (dirty) setDiscard('close');
    else onClose();
  }

  function stopEditing() {
    if (dirty) setDiscard('stop');
    else setEditing(false);
  }

  function confirmDiscard() {
    const next = discard;
    setDiscard(null);
    if (next === 'close') {
      onClose();
      return;
    }
    setEditing(false);
    setDraft('');
    setSaved('');
  }

  async function startEditing() {
    if (!backend || !ready) return;
    try {
      const text = loaded.status === 'text' ? loaded.text : await backend.getLibraryText(file.id);
      setDraft(text);
      setSaved(text);
      setEditing(true);
    } catch (error) {
      notify(t(errorText(error)), 'error');
    }
  }

  async function save() {
    if (!backend || !editing || !dirty || saving) return;
    const text = draft;
    if (!text) {
      notify(t('The text is empty. Write something before you save.'), 'error');
      return;
    }
    const blob = new Blob([text], { type: isPdf ? KIND_MIME.md : KIND_MIME[file.kind] });
    if (blob.size > LIBRARY_MAX_BYTES) {
      notify(t('This text is larger than 20 MB, so it cannot be saved.'), 'error');
      return;
    }
    const extracted = text.slice(0, LIBRARY_TEXT_LIMIT);
    setSaving(true);
    try {
      if (isPdf) {
        const name = `${file.name.replace(/\.pdf$/i, '')} (edited).md`.slice(0, 200);
        await backend.addLibraryFile({ name, kind: 'md', mime_type: KIND_MIME.md, blob, extracted_text: extracted, pages: null });
        notify(t('Saved as {name} in your library.', { name }), 'ok');
      } else {
        await backend.updateLibraryFile(file.id, { blob, extracted_text: extracted });
        setLoaded({ status: 'text', text });
        notify(t('{name} is saved.', { name: file.name }), 'ok');
      }
      setSaved(text);
      onChanged();
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setSaving(false);
    }
  }

  // Ctrl+F, Ctrl+S, F3 and Escape work anywhere in the viewer. While a confirmation is open, it takes the keys.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (discard) return;
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (findOpen) closeFind();
        else requestClose();
      } else if (command && key === 'f') {
        event.preventDefault();
        setFindOpen(true);
      } else if (command && key === 's' && editing) {
        event.preventDefault();
        void save();
      } else if (event.key === 'F3' && findOpen) {
        event.preventDefault();
        step(event.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const countText = !query
    ? ''
    : isPdf && !editing && !pdfPages
      ? t('Searching…')
      : total === 0
        ? t('No matches')
        : isPdf && !editing
          ? t('{index} of {count} · page {page}', { index: active + 1, count: total, page: pdfMatches[active].page })
          : t('{index} of {count}', { index: active + 1, count: total });

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={file.name}>
      <div className="viewer__bar">
        <div className="viewer__title">{file.name}</div>
        {editing && (
          <span className="viewer__badge" role="status">
            <Pencil aria-hidden="true" />
            {t('Editor mode')}
          </span>
        )}
        <button className="btn btn--ghost btn--sm" onClick={() => setFindOpen(true)} disabled={!ready} aria-label={t('Find in this file')}>
          <Search /> {t('Find')}
        </button>
        {editing ? (
          <>
            <button className="btn btn--ghost btn--sm" onClick={stopEditing} disabled={saving}>
              {t('Done editing')}
            </button>
            <button className="btn btn--primary btn--sm" onClick={() => void save()} disabled={!dirty || saving}>
              {saving ? <Spinner /> : null} {isPdf ? t('Save as new file') : t('Save')}
            </button>
          </>
        ) : (
          <button className="btn btn--ghost btn--sm" onClick={() => void startEditing()} disabled={!ready}>
            <Pencil /> {t('Edit')}
          </button>
        )}
        <button className="btn btn--icon" onClick={requestClose} aria-label={t('Close')}>
          <X />
        </button>
      </div>

      {findOpen && (
        <div className="viewer__find" role="search">
          <div className="viewer__find-field">
            <SearchField
              inputRef={findBox}
              value={query}
              placeholder={t('Find in this file')}
              label={t('Find in this file')}
              onChange={(value) => {
                setQuery(value);
                setCurrent(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  step(event.shiftKey ? -1 : 1);
                }
              }}
            />
          </div>
          <span className="viewer__find-count" aria-live="polite">
            {countText}
          </span>
          <button className="btn btn--icon" onClick={() => step(-1)} disabled={total === 0} aria-label={t('Previous match')}>
            <ChevronUp />
          </button>
          <button className="btn btn--icon" onClick={() => step(1)} disabled={total === 0} aria-label={t('Next match')}>
            <ChevronDown />
          </button>
          <label className="viewer__find-case">
            <input
              type="checkbox"
              checked={matchCase}
              onChange={(event) => {
                setMatchCase(event.target.checked);
                setCurrent(0);
              }}
            />
            {t('Match case')}
          </label>
          <button className="btn btn--icon" onClick={closeFind} aria-label={t('Close')}>
            <X />
          </button>
        </div>
      )}

      <div className="viewer__body" ref={body}>
        {loaded.status === 'loading' && <Spinner dark />}
        {loaded.status === 'error' && <Notice tone="error">{t(loaded.message)}</Notice>}
        {ready && editing && isPdf && (
          <p className="viewer__note muted small">
            {t('A PDF keeps its pages as they are. Saving makes a Markdown file with this text in your library.')}
          </p>
        )}
        {ready && editing && (
          <textarea
            ref={editor}
            className={`viewer__editor ${file.kind === 'md' ? 'viewer__editor--md' : ''}`}
            value={draft}
            aria-label={t('Text of {name}', { name: file.name })}
            onChange={(event) => setDraft(event.target.value)}
          />
        )}
        {loaded.status === 'pdf' && <div ref={pages} className="viewer__pages" hidden={editing} />}
        {loaded.status === 'text' && !editing && file.kind === 'txt' && <pre className="viewer__text">{markWords(loaded.text, options)}</pre>}
        {loaded.status === 'text' && !editing && file.kind === 'md' && (
          <div className="viewer__markdown">
            <FindContext.Provider value={options}>
              <MarkdownText text={loaded.text} />
            </FindContext.Provider>
          </div>
        )}
      </div>

      {discard && (
        <ConfirmSheet title={t('Discard your changes?')} confirmLabel={t('Discard changes')} onConfirm={confirmDiscard} onClose={() => setDiscard(null)}>
          {t('The changes to {name} are not saved yet. They will be lost.', { name: file.name })}
        </ConfirmSheet>
      )}
    </div>
  );
}
