// Shows a library file: PDF pages, plain text, or Markdown rendered as a document.
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';
import { Notice, Spinner } from './ui';
import { drawPdf } from '../lib/pdf';
import { useT } from '../lib/i18n/react';
import type { LibraryFileRow } from '../lib/types';
import { useAuth } from '../state/auth';

type Loaded =
  | { status: 'loading' }
  | { status: 'text'; text: string }
  | { status: 'pdf'; bytes: ArrayBuffer }
  | { status: 'error'; message: string };

export function FileViewer({ file, onClose }: { file: LibraryFileRow; onClose: () => void }) {
  const { backend } = useAuth();
  const t = useT();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const pages = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    setLoaded({ status: 'loading' });
    (async () => {
      try {
        const blob = backend ? await backend.getLibraryBlob(file.id) : null;
        if (!blob) throw new Error('The file is not here.');
        const next: Loaded =
          file.kind === 'pdf' ? { status: 'pdf', bytes: await blob.arrayBuffer() } : { status: 'text', text: await blob.text() };
        if (active) setLoaded(next);
      } catch {
        if (active) setLoaded({ status: 'error', message: 'This file is not available on this device yet.' });
      }
    })();
    return () => {
      active = false;
    };
  }, [backend, file.id, file.kind]);

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

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={file.name}>
      <div className="viewer__bar">
        <div className="viewer__title">{file.name}</div>
        <button className="btn btn--icon" onClick={onClose} aria-label={t('Close')}>
          <X />
        </button>
      </div>
      <div className="viewer__body">
        {loaded.status === 'loading' && <Spinner dark />}
        {loaded.status === 'error' && <Notice tone="error">{t(loaded.message)}</Notice>}
        {loaded.status === 'pdf' && <div ref={pages} className="viewer__pages" />}
        {loaded.status === 'text' && file.kind === 'txt' && <pre className="viewer__text">{loaded.text}</pre>}
        {loaded.status === 'text' && file.kind === 'md' && (
          <div className="viewer__markdown">
            <ReactMarkdown>{loaded.text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
