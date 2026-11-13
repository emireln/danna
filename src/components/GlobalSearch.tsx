// The search of the whole app. It opens from the search button in the title bar, or with Ctrl+K. The results are
// grouped by kind; the arrow keys move between them, Enter opens the one chosen, and Escape closes the search.
import { Fragment, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { SearchField } from './ui';
import { useT } from '../lib/i18n/react';
import { groupHits, searchEntries, type SearchEntry, type SearchHit, type SearchKind } from '../lib/search';
import { bundledEntries, learnerEntries } from '../lib/searchIndex';
import { useAuth } from '../state/auth';

const GROUP_LABEL: Record<SearchKind, string> = {
  page: 'Screens',
  setting: 'Settings',
  lesson: 'Lessons',
  test: 'Tests',
  unit: 'Units',
  result: 'Results',
  chat: 'Coach chats',
  file: 'Files',
  link: 'Links',
  friend: 'Friends',
  news: "What's new",
};

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const { backend } = useAuth();
  const [query, setQuery] = useState('');
  const [learner, setLearner] = useState<SearchEntry[]>([]);
  const [chatIds, setChatIds] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState(0);

  // The learner's own places are read each time the search opens.
  useEffect(() => {
    let alive = true;
    void learnerEntries(backend).then((entries) => {
      if (alive) setLearner(entries);
    });
    return () => {
      alive = false;
    };
  }, [backend]);

  // Chats whose messages contain the words are found too, a moment after the typing stops.
  useEffect(() => {
    const needle = query.trim();
    if (!backend || needle.length < 2) {
      setChatIds(new Set());
      return undefined;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      backend
        .searchTutorChats(needle)
        .then((ids) => {
          if (alive) setChatIds(new Set(ids));
        })
        .catch(() => {
          if (alive) setChatIds(new Set());
        });
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [backend, query]);

  const hits = useMemo<SearchHit[]>(() => {
    const found = searchEntries([...bundledEntries(), ...learner], query, t);
    const seen = new Set(found.map((hit) => hit.entry.id));
    // A chat found through its messages is listed after the chats found through their names.
    const byMessage = learner
      .filter((entry) => entry.kind === 'chat' && !seen.has(entry.id) && chatIds.has(String(entry.state?.chatId)))
      .map((entry) => ({ entry, score: 1 }));
    return [...found, ...byMessage];
  }, [learner, query, chatIds, t]);

  const groups = useMemo(() => groupHits(hits), [hits]);
  const flat = useMemo(() => groups.flatMap((group) => group.hits), [groups]);
  const position = useMemo(() => new Map(flat.map((hit, index) => [hit.entry.id, index])), [flat]);
  const current = Math.min(active, Math.max(flat.length - 1, 0));

  // Escape closes the search from anywhere in the app.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The highlighted result stays in view while the arrow keys move.
  useEffect(() => {
    document.getElementById(`palette-hit-${current}`)?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const open = (hit: SearchHit) => {
    navigate(hit.entry.route, { state: hit.entry.state });
    onClose();
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(Math.min(current + 1, flat.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && flat[current]) {
      event.preventDefault();
      open(flat[current]);
    }
  };

  // The names the app ships with are translated; the learner's own names are shown as they were written.
  const shown = (entry: SearchEntry, text: string) => (entry.bundled ? t(text) : text);
  const trimmed = query.trim();

  return createPortal(
    <div
      className="palette-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label={t('Search danna')}>
        <SearchField
          value={query}
          onChange={(value) => {
            setQuery(value);
            setActive(0);
          }}
          onKeyDown={onKey}
          placeholder={t('Search lessons, tests, chats, files and pages')}
          label={t('Search danna')}
          autoFocus
        />
        <div className="palette__body">
          {!trimmed && (
            <p className="palette__hint muted small">{t('Type a word. The search looks through every lesson, test, chat, file and page.')}</p>
          )}
          {trimmed && flat.length === 0 && <p className="palette__hint muted">{t('Nothing matches “{query}”.', { query: trimmed })}</p>}
          {flat.length > 0 && (
            <ul className="palette__list" role="listbox" aria-label={t('Results')}>
              {groups.map((group) => (
                <Fragment key={group.kind}>
                  <li role="presentation" className="palette__group">
                    {t(GROUP_LABEL[group.kind])}
                  </li>
                  {group.hits.map((hit) => {
                    const index = position.get(hit.entry.id) ?? 0;
                    return (
                      <li
                        key={hit.entry.id}
                        id={`palette-hit-${index}`}
                        role="option"
                        aria-selected={index === current}
                        className={`palette__item${index === current ? ' is-active' : ''}`}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => open(hit)}
                      >
                        <span className="palette__title">{shown(hit.entry, hit.entry.title)}</span>
                        {hit.entry.detail && <span className="palette__detail">{shown(hit.entry, hit.entry.detail)}</span>}
                      </li>
                    );
                  })}
                </Fragment>
              ))}
            </ul>
          )}
        </div>
        <p className="palette__foot muted small">{t('Enter opens · arrow keys move · Esc closes')}</p>
      </div>
    </div>,
    document.body,
  );
}
