// The coach's chat history: the chats, a search box, and the actions for each chat (open, rename,
// archive or restore, delete). The screen does the saving; this sheet only shows the list.
import { useState, type FormEvent } from 'react';
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react';
import { getLocale } from '../lib/i18n';
import { useT, type Translate } from '../lib/i18n/react';
import type { TutorChatRow } from '../lib/types';
import { ConfirmSheet, Empty, SearchField, Sheet } from './ui';

interface ChatHistoryProps {
  /** The chats that match the search, newest first. */
  chats: TutorChatRow[];
  /** Whether a search is typed. Without one, every chat is listed. */
  searching: boolean;
  query: string;
  activeId: string | null;
  busy: boolean;
  onQuery: (query: string) => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onArchive: (chat: TutorChatRow, archived: boolean) => Promise<void>;
  onDelete: (chat: TutorChatRow) => Promise<void>;
  onClose: () => void;
}

/** Today, Yesterday, or the day and month, in the app's language. */
export function chatDay(iso: string, t: Translate): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return t('Today');
  if (date.toDateString() === yesterday.toDateString()) return t('Yesterday');
  return date.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' });
}

export function ChatHistory({
  chats,
  searching,
  query,
  activeId,
  busy,
  onQuery,
  onOpen,
  onNew,
  onRename,
  onArchive,
  onDelete,
  onClose,
}: ChatHistoryProps) {
  const t = useT();
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [deleting, setDeleting] = useState<TutorChatRow | null>(null);
  const [saving, setSaving] = useState(false);

  const current = chats.filter((chat) => !chat.archived);
  const archived = chats.filter((chat) => chat.archived);

  const save = async (event: FormEvent<HTMLFormElement>, chat: TutorChatRow) => {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    try {
      await onRename(chat.id, editing.value);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const row = (chat: TutorChatRow) => (
    <li key={chat.id} className={`chat-row ${chat.id === activeId ? 'is-active' : ''}`}>
      {editing?.id === chat.id ? (
        <form className="chat-row__edit" onSubmit={(event) => save(event, chat)}>
          <input
            className="input"
            autoFocus
            maxLength={120}
            value={editing.value}
            aria-label={t('Chat name')}
            placeholder={t('Name this chat')}
            onChange={(event) => setEditing({ id: chat.id, value: event.target.value })}
          />
          <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
            {t('Save')}
          </button>
          <button className="btn btn--ghost btn--sm" type="button" onClick={() => setEditing(null)}>
            {t('Cancel')}
          </button>
        </form>
      ) : (
        <>
          <button className="chat-row__open" onClick={() => onOpen(chat.id)} disabled={busy}>
            <span className="chat-row__title">{chat.title || t('Untitled chat')}</span>
            <span className="chat-row__meta">{chatDay(chat.updated_at, t)}</span>
          </button>
          <span className="chat-row__actions">
            <button
              className="btn btn--ghost btn--icon btn--sm"
              onClick={() => setEditing({ id: chat.id, value: chat.title ?? '' })}
              aria-label={t('Rename chat')}
              title={t('Rename chat')}
              disabled={busy}
            >
              <Pencil />
            </button>
            <button
              className="btn btn--ghost btn--icon btn--sm"
              onClick={() => void onArchive(chat, !chat.archived)}
              aria-label={chat.archived ? t('Restore chat') : t('Archive chat')}
              title={chat.archived ? t('Restore chat') : t('Archive chat')}
              disabled={busy}
            >
              {chat.archived ? <ArchiveRestore /> : <Archive />}
            </button>
            <button
              className="btn btn--ghost btn--icon btn--sm"
              onClick={() => setDeleting(chat)}
              aria-label={t('Delete chat')}
              title={t('Delete chat')}
              disabled={busy}
            >
              <Trash2 />
            </button>
          </span>
        </>
      )}
    </li>
  );

  return (
    <>
      <Sheet
        title={t('Chat history')}
        onClose={onClose}
        footer={
          <button className="btn btn--primary" onClick={onNew} disabled={busy}>
            <Plus /> {t('New chat')}
          </button>
        }
      >
        <SearchField value={query} onChange={onQuery} placeholder={t('Search chats')} label={t('Search chats')} />
        {chats.length === 0 ? (
          <Empty title={searching ? t('No chat matches your search.') : t('No chats yet.')}>
            {searching ? null : t('Your conversations with the coach are kept here.')}
          </Empty>
        ) : (
          <div className="chat-groups">
            {current.length > 0 && (
              <section aria-label={t('Chats')}>
                <h3 className="chat-group__title">{t('Chats')}</h3>
                <ul className="chat-list">{current.map(row)}</ul>
              </section>
            )}
            {archived.length > 0 && (
              <section aria-label={t('Archived')}>
                <h3 className="chat-group__title">{t('Archived')}</h3>
                <ul className="chat-list">{archived.map(row)}</ul>
              </section>
            )}
          </div>
        )}
      </Sheet>

      {deleting && (
        <ConfirmSheet
          title={t('Delete this chat?')}
          confirmLabel={t('Delete chat')}
          busy={busy}
          onConfirm={async () => {
            await onDelete(deleting);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        >
          {t('The chat and its messages are deleted. This cannot be undone.')}
        </ConfirmSheet>
      )}
    </>
  );
}
