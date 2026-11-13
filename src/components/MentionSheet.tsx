// Mention library files in a message to the coach: search the library, tick the files, and send them with
// the message. The coach reads the passages that match the question from them.
import { useState } from 'react';
import { tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { KIND_LABEL } from '../lib/library';
import type { LibraryFileRow } from '../lib/types';
import { Empty, Notice, SearchField, Sheet } from './ui';

interface MentionSheetProps {
  files: LibraryFileRow[];
  /** The library files already mentioned in this message. */
  chosen: string[];
  /** How many library files this message can still carry. */
  limit: number;
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}

export function MentionSheet({ files, chosen, limit, onConfirm, onClose }: MentionSheetProps) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>(chosen);

  const needle = query.trim().toLowerCase();
  const shown = needle ? files.filter((file) => file.name.toLowerCase().includes(needle)) : files;

  const toggle = (id: string) =>
    setPicked((ids) => {
      if (ids.includes(id)) return ids.filter((item) => item !== id);
      return ids.length >= limit ? ids : [...ids, id];
    });

  return (
    <Sheet
      title={t('Mention library files')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn btn--primary" onClick={() => onConfirm(picked)}>
            {tn('Mention 1 file', 'Mention {count} files', picked.length, { count: picked.length })}
          </button>
        </>
      }
    >
      {files.length === 0 ? (
        <Empty title={t('Your library is empty')}>{t('Add a file in My library first.')}</Empty>
      ) : (
        <>
          <SearchField value={query} onChange={setQuery} placeholder={t('Search your files')} label={t('Search your files')} />
          {shown.length === 0 ? (
            <p className="muted">{t('No file matches your search.')}</p>
          ) : (
            <ul className="mention-list">
              {shown.map((file) => {
                const on = picked.includes(file.id);
                return (
                  <li key={file.id}>
                    <label className={`mention-option ${on ? 'is-on' : ''}`}>
                      <input type="checkbox" checked={on} disabled={!on && picked.length >= limit} onChange={() => toggle(file.id)} />
                      <span className="mention-option__name">{file.name}</span>
                      <span className="mention-option__kind">{KIND_LABEL[file.kind]}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <Notice tone="info">{t('You can mention up to {count} files in one message.', { count: limit })}</Notice>
        </>
      )}
    </Sheet>
  );
}
