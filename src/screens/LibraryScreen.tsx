// My library: learning files (PDF, TXT, Markdown), learning links with their platform logos, and
// the coach that answers from the files you choose. Works on this device and in your account.
import { useCallback, useEffect, useState, type DragEvent, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, Eye, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { openLink } from '../components/Banner';
import { FileViewer } from '../components/FileViewer';
import { LibraryCoach } from '../components/LibraryCoach';
import { PlatformLogo } from '../components/PlatformLogo';
import { ConfirmSheet, Empty, Notice, PageHeader, SearchField, SectionTitle, Skeleton, Spinner, Tabs } from '../components/ui';
import { Select } from '../components/Pickers';
import { bridge, errorText } from '../lib/bridge';
import { tn } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { KIND_LABEL, KIND_MIME, LIBRARY_MAX_BYTES, LIBRARY_TEXT_LIMIT, kindForFile } from '../lib/library';
import { readPdf } from '../lib/pdf';
import { formatDate } from '../lib/progress';
import { normalizeLinkUrl, platformForUrl } from '../lib/platforms';
import type { LibraryFileRow, LibraryLinkRow } from '../lib/types';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';

type Tab = 'files' | 'links' | 'ask';

// Categories are saved with the link in English, so the same category is found on every device.
// Only the label on screen is translated.
const CATEGORIES = ['Listening', 'Speaking', 'Reading', 'Writing', 'Vocabulary', 'Grammar', 'Pronunciation', 'TOEFL tips', 'General'];
const OTHER_CATEGORY = '__other__';
const FILE_TYPES = '.pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown';

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function LibraryScreen() {
  const { backend, mode } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const [tab, setTab] = useState<Tab>('files');
  const [files, setFiles] = useState<LibraryFileRow[] | null>(null);
  const [links, setLinks] = useState<LibraryLinkRow[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [viewing, setViewing] = useState<LibraryFileRow | null>(null);
  const [fileToRemove, setFileToRemove] = useState<LibraryFileRow | null>(null);
  const [linkToRemove, setLinkToRemove] = useState<LibraryLinkRow | null>(null);
  const [adding, setAdding] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  // Files need the desktop app (this device) or an online account. Links work everywhere.
  const filesAvailable = Boolean(backend) && (mode === 'supabase' || Boolean(bridge));

  const load = useCallback(async () => {
    if (!backend) return;
    try {
      const [nextFiles, nextLinks] = await Promise.all([backend.listLibraryFiles(), backend.listLibraryLinks()]);
      setFiles(nextFiles);
      setLinks(nextLinks);
    } catch (error) {
      // Show the empty library with the reason, instead of a skeleton that never ends.
      setFiles((current) => current ?? []);
      setLinks((current) => current ?? []);
      notify(t(errorText(error)), 'error');
    }
  }, [backend, notify, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // A search result opens the library on its tab, with its search filled in, or with its file shown.
  useEffect(() => {
    const intent = location.state as { tab?: Tab; query?: string; fileId?: string } | null;
    if (!intent || (intent.fileId && files === null)) return;
    if (intent.tab) setTab(intent.tab);
    if (typeof intent.query === 'string') setQuery(intent.query);
    if (intent.fileId) {
      const file = files?.find((item) => item.id === intent.fileId);
      if (file) setViewing(file);
    }
    // The request is used once, so a later visit to the library starts plainly.
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.state, files, navigate]);

  async function importFiles(list: FileList | File[]) {
    if (!backend) return;
    for (const file of Array.from(list)) {
      const kind = kindForFile(file.name, file.type);
      if (!kind) {
        notify(t('{name}: only PDF, TXT and Markdown files can be added.', { name: file.name }), 'error');
        continue;
      }
      if (file.size > LIBRARY_MAX_BYTES) {
        notify(t('{name} is larger than 20 MB.', { name: file.name }), 'error');
        continue;
      }
      setAdding((count) => count + 1);
      try {
        let text = '';
        let pages: number | null = null;
        if (kind === 'pdf') {
          try {
            ({ text, pages } = await readPdf(await file.arrayBuffer()));
          } catch {
            notify(t('{name} could not be read. Try another file.', { name: file.name }), 'error');
            continue;
          }
        } else {
          text = (await file.text()).slice(0, LIBRARY_TEXT_LIMIT);
        }
        await backend.addLibraryFile({ name: file.name, kind, mime_type: KIND_MIME[kind], blob: file, extracted_text: text, pages });
        notify(t('{name} is in your library.', { name: file.name }), 'ok');
      } catch (error) {
        notify(t(errorText(error)), 'error');
      } finally {
        setAdding((count) => count - 1);
      }
    }
    await load();
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    if (filesAvailable) void importFiles(event.dataTransfer.files);
  }

  async function removeFile(file: LibraryFileRow) {
    if (!backend) return;
    try {
      await backend.deleteLibraryFile(file.id);
      setSelected((ids) => ids.filter((id) => id !== file.id));
      await load();
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setFileToRemove(null);
    }
  }

  async function addLink(event: FormEvent) {
    event.preventDefault();
    if (!backend) return;
    const href = normalizeLinkUrl(url);
    if (!href) {
      notify(t('Paste a web link that starts with https://'), 'error');
      return;
    }
    const chosen = category === OTHER_CATEGORY ? customCategory.trim() : category;
    setSavingLink(true);
    try {
      await backend.addLibraryLink({
        url: href,
        title: title.trim(),
        platform: platformForUrl(href).id,
        category: (chosen || 'General').slice(0, 40),
        note: '',
      });
      setUrl('');
      setTitle('');
      setCustomCategory('');
      notify(t('Link saved to your library.'), 'ok');
      await load();
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setSavingLink(false);
    }
  }

  async function changeCategory(link: LibraryLinkRow, next: string) {
    if (!backend || next === link.category) return;
    try {
      await backend.updateLibraryLink(link.id, { category: next });
      await load();
    } catch (error) {
      notify(t(errorText(error)), 'error');
    }
  }

  async function removeLink(link: LibraryLinkRow) {
    if (!backend) return;
    try {
      await backend.deleteLibraryLink(link.id);
      await load();
    } catch (error) {
      notify(t(errorText(error)), 'error');
    } finally {
      setLinkToRemove(null);
    }
  }

  function toggleSelected(id: string) {
    setSelected((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  }

  function askAbout(file: LibraryFileRow) {
    setSelected((ids) => (ids.includes(file.id) ? ids : [...ids, file.id]));
    setTab('ask');
  }

  const detectedHref = normalizeLinkUrl(url);
  const detected = detectedHref ? platformForUrl(detectedHref) : null;
  const categoriesInUse = [...new Set((links ?? []).map((link) => link.category))].sort();
  // The search looks at the names of the files, and at the titles, addresses and notes of the links.
  const needle = query.trim().toLowerCase();
  const shownFiles = (files ?? []).filter((file) => !needle || file.name.toLowerCase().includes(needle));
  const shownLinks = (links ?? []).filter(
    (link) =>
      (filter === 'All' || link.category === filter) &&
      (!needle || [link.title, link.url, link.platform, link.note].join(' ').toLowerCase().includes(needle)),
  );
  const groups = new Map<string, LibraryLinkRow[]>();
  for (const link of shownLinks) groups.set(link.category, [...(groups.get(link.category) ?? []), link]);

  return (
    <div className={tab === 'ask' ? 'page page--coach' : 'page'}>
      <PageHeader eyebrow={t('Private to you')} title={t('My library')} />

      <Tabs
        label={t('My library')}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'files', label: t('Files'), count: files?.length ?? 0 },
          { value: 'links', label: t('Links'), count: links?.length ?? 0 },
          { value: 'ask', label: t('Ask the coach') },
        ]}
      />

      {tab !== 'ask' && (
        <div className="mt-4">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={tab === 'files' ? t('Search your files') : t('Search your links')}
            label={tab === 'files' ? t('Search your files') : t('Search your links')}
          />
        </div>
      )}

      {tab === 'files' && (
        <div className="stack mt-4">
          {!filesAvailable && (
            <Notice tone="info">{t('Files are kept in the desktop app or in an online account. Links work everywhere.')}</Notice>
          )}

          <label
            className={`drop-zone ${dragOver ? 'is-over' : ''}`}
            aria-disabled={!filesAvailable}
            onDragOver={(event) => {
              event.preventDefault();
              if (filesAvailable) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <input
              type="file"
              accept={FILE_TYPES}
              multiple
              disabled={!filesAvailable}
              onChange={(event) => {
                if (event.target.files) void importFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <span className="icon-tile icon-tile--sm">{adding > 0 ? <Spinner dark /> : <Plus />}</span>
            <strong>
              {adding > 0
                ? tn('Adding {count} file…', 'Adding {count} files…', adding, { count: adding })
                : t('Drop PDF, TXT or Markdown files here')}
            </strong>
            <span className="small muted">{t('or choose files · up to 20 MB each · only you can see them')}</span>
          </label>

          {files === null ? (
            <Skeleton height={120} />
          ) : files.length === 0 ? (
            <Empty title={t('Nothing here yet')}>{t('Add a PDF, a text or a Markdown file. Then read it, or ask the coach about it.')}</Empty>
          ) : shownFiles.length === 0 ? (
            <Empty title={t('No file matches your search.')} />
          ) : (
            <div className="set-list">
              {shownFiles.map((file) => (
                <div key={file.id} className="person">
                  <span className="chip chip--blue">{t(KIND_LABEL[file.kind])}</span>
                  <div className="person__body">
                    <div className="person__name">{file.name}</div>
                    <div className="person__meta">
                      {[
                        formatSize(file.size_bytes),
                        file.pages ? tn('{count} page', '{count} pages', file.pages, { count: file.pages }) : null,
                        formatDate(file.created_at),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <div className="person__actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => setViewing(file)}>
                      <Eye /> {t('Open')}
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => askAbout(file)}>
                      <MessageSquare /> {t('Ask')}
                    </button>
                    <button className="btn btn--icon" onClick={() => setFileToRemove(file)} aria-label={t('Remove {name}', { name: file.name })}>
                      <Trash2 />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'links' && (
        <div className="stack mt-4">
          <form className="card library-add" onSubmit={addLink}>
            <label className="field">
              <span className="field__label">{t('Link')}</span>
              <span className="library-add__link">
                <input
                  className="input"
                  value={url}
                  placeholder={t('Paste a link, for example a YouTube video')}
                  disabled={savingLink}
                  onChange={(event) => setUrl(event.target.value)}
                />
                {detected && (
                  <span className="chip library-detected">
                    <PlatformLogo platform={detected} size={20} />
                    {t(detected.name)}
                  </span>
                )}
              </span>
            </label>
            <div className="library-add__row">
              <label className="field library-add__title">
                <span className="field__label">{t('Title (optional)')}</span>
                <input
                  className="input"
                  value={title}
                  maxLength={200}
                  placeholder={t('What is it about?')}
                  disabled={savingLink}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="field library-add__category">
                <span className="field__label">{t('Category')}</span>
                <Select
                  label={t('Category')}
                  value={category}
                  onChange={setCategory}
                  disabled={savingLink}
                  options={[
                    ...CATEGORIES.map((item) => ({ value: item, label: t(item) })),
                    { value: OTHER_CATEGORY, label: t('Other…') },
                  ]}
                />
              </label>
              {category === OTHER_CATEGORY && (
                <label className="field library-add__category">
                  <span className="field__label">{t('New category')}</span>
                  <input
                    className="input"
                    value={customCategory}
                    maxLength={40}
                    disabled={savingLink}
                    onChange={(event) => setCustomCategory(event.target.value)}
                  />
                </label>
              )}
              <button className="btn btn--primary" type="submit" disabled={savingLink || !url.trim()}>
                {savingLink ? <Spinner /> : <Plus />} {t('Save link')}
              </button>
            </div>
          </form>

          {links && links.length > 0 && (
            <div className="library-filters">
              {['All', ...categoriesInUse].map((item) => (
                <button key={item} className="chip-toggle" aria-pressed={filter === item} onClick={() => setFilter(item)}>
                  {t(item)}
                </button>
              ))}
            </div>
          )}

          {links === null ? (
            <Skeleton height={140} />
          ) : links.length === 0 ? (
            <Empty title={t('No links yet')}>{t('Paste a link above. The platform and its logo are detected from the address.')}</Empty>
          ) : (
            [...groups.entries()].map(([name, items]) => (
              <section key={name}>
                <SectionTitle title={t(name)} />
                <div className="set-list">
                  {items.map((link) => {
                    const platform = platformForUrl(link.url);
                    return (
                      <div key={link.id} className="person">
                        <PlatformLogo platform={platform} />
                        <div className="person__body">
                          <div className="person__name">{link.title || hostOf(link.url)}</div>
                          <div className="person__meta">
                            {t(platform.name)} · {hostOf(link.url)} · {formatDate(link.created_at)}
                          </div>
                        </div>
                        <div className="person__actions">
                          <div className="library-category">
                            <Select
                              label={t('Category')}
                              value={link.category}
                              onChange={(value) => void changeCategory(link, value)}
                              options={[...new Set([...CATEGORIES, link.category])].map((item) => ({ value: item, label: t(item) }))}
                            />
                          </div>
                          <button className="btn btn--ghost btn--sm" onClick={() => openLink(link.url, navigate)}>
                            <ExternalLink /> {t('Open')}
                          </button>
                          <button
                            className="btn btn--icon"
                            onClick={() => setLinkToRemove(link)}
                            aria-label={t('Remove {name}', { name: link.title || hostOf(link.url) })}
                          >
                            <Trash2 />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {tab === 'ask' && <LibraryCoach files={files ?? []} selected={selected} onToggle={toggleSelected} />}

      {viewing && <FileViewer file={viewing} onClose={() => setViewing(null)} onChanged={() => void load()} />}

      {fileToRemove && (
        <ConfirmSheet
          title={t('Remove this file?')}
          confirmLabel={t('Remove file')}
          onConfirm={() => void removeFile(fileToRemove)}
          onClose={() => setFileToRemove(null)}
        >
          {t('{name} is removed from your library. This cannot be undone.', { name: fileToRemove.name })}
        </ConfirmSheet>
      )}

      {linkToRemove && (
        <ConfirmSheet
          title={t('Remove this link?')}
          confirmLabel={t('Remove link')}
          onConfirm={() => void removeLink(linkToRemove)}
          onClose={() => setLinkToRemove(null)}
        >
          {t('The link is removed from your library.')}
        </ConfirmSheet>
      )}
    </div>
  );
}
