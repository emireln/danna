// My library: learning files (PDF, TXT, Markdown), learning links with their platform logos, and
// the coach that answers from the files you choose. Works on this device and in your account.
import { useCallback, useEffect, useState, type DragEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Eye, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { openLink } from '../components/Banner';
import { FileViewer } from '../components/FileViewer';
import { LibraryCoach } from '../components/LibraryCoach';
import { PlatformLogo } from '../components/PlatformLogo';
import { ConfirmSheet, Empty, Notice, PageHeader, SectionTitle, Skeleton, Spinner, Tabs } from '../components/ui';
import { Select } from '../components/Pickers';
import { bridge, errorText } from '../lib/bridge';
import { KIND_LABEL, KIND_MIME, LIBRARY_MAX_BYTES, LIBRARY_TEXT_LIMIT, kindForFile } from '../lib/library';
import { readPdf } from '../lib/pdf';
import { formatDate } from '../lib/progress';
import { normalizeLinkUrl, platformForUrl } from '../lib/platforms';
import { plural } from '../lib/text';
import type { LibraryFileRow, LibraryLinkRow } from '../lib/types';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';

type Tab = 'files' | 'links' | 'ask';

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
      notify(errorText(error), 'error');
    }
  }, [backend, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  async function importFiles(list: FileList | File[]) {
    if (!backend) return;
    for (const file of Array.from(list)) {
      const kind = kindForFile(file.name, file.type);
      if (!kind) {
        notify(`${file.name}: only PDF, TXT and Markdown files can be added.`, 'error');
        continue;
      }
      if (file.size > LIBRARY_MAX_BYTES) {
        notify(`${file.name} is larger than 20 MB.`, 'error');
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
            notify(`${file.name} could not be read. Try another file.`, 'error');
            continue;
          }
        } else {
          text = (await file.text()).slice(0, LIBRARY_TEXT_LIMIT);
        }
        await backend.addLibraryFile({ name: file.name, kind, mime_type: KIND_MIME[kind], blob: file, extracted_text: text, pages });
        notify(`${file.name} is in your library.`, 'ok');
      } catch (error) {
        notify(errorText(error), 'error');
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
      notify(errorText(error), 'error');
    } finally {
      setFileToRemove(null);
    }
  }

  async function addLink(event: FormEvent) {
    event.preventDefault();
    if (!backend) return;
    const href = normalizeLinkUrl(url);
    if (!href) {
      notify('Paste a web link that starts with https://', 'error');
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
      notify('Link saved to your library.', 'ok');
      await load();
    } catch (error) {
      notify(errorText(error), 'error');
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
      notify(errorText(error), 'error');
    }
  }

  async function removeLink(link: LibraryLinkRow) {
    if (!backend) return;
    try {
      await backend.deleteLibraryLink(link.id);
      await load();
    } catch (error) {
      notify(errorText(error), 'error');
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
  const shownLinks = (links ?? []).filter((link) => filter === 'All' || link.category === filter);
  const groups = new Map<string, LibraryLinkRow[]>();
  for (const link of shownLinks) groups.set(link.category, [...(groups.get(link.category) ?? []), link]);

  return (
    <div className="page">
      <PageHeader eyebrow="Private to you" title="My library" />

      <Tabs
        label="My library"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'files', label: 'Files', count: files?.length ?? 0 },
          { value: 'links', label: 'Links', count: links?.length ?? 0 },
          { value: 'ask', label: 'Ask the coach' },
        ]}
      />

      {tab === 'files' && (
        <div className="stack mt-4">
          {!filesAvailable && <Notice tone="info">Files are kept in the desktop app or in an online account. Links work everywhere.</Notice>}

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
            <strong>{adding > 0 ? `Adding ${plural(adding, 'file')}…` : 'Drop PDF, TXT or Markdown files here'}</strong>
            <span className="small muted">or choose files · up to 20 MB each · only you can see them</span>
          </label>

          {files === null ? (
            <Skeleton height={120} />
          ) : files.length === 0 ? (
            <Empty title="Nothing here yet">Add a PDF, a text or a Markdown file. Then read it, or ask the coach about it.</Empty>
          ) : (
            <div className="set-list">
              {files.map((file) => (
                <div key={file.id} className="person">
                  <span className="chip chip--blue">{KIND_LABEL[file.kind]}</span>
                  <div className="person__body">
                    <div className="person__name">{file.name}</div>
                    <div className="person__meta">
                      {[formatSize(file.size_bytes), file.pages ? plural(file.pages, 'page') : null, formatDate(file.created_at)]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <div className="person__actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => setViewing(file)}>
                      <Eye /> Open
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => askAbout(file)}>
                      <MessageSquare /> Ask
                    </button>
                    <button className="btn btn--icon" onClick={() => setFileToRemove(file)} aria-label={`Remove ${file.name}`}>
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
              <span className="field__label">Link</span>
              <span className="library-add__link">
                <input
                  className="input"
                  value={url}
                  placeholder="Paste a link, for example a YouTube video"
                  disabled={savingLink}
                  onChange={(event) => setUrl(event.target.value)}
                />
                {detected && (
                  <span className="chip library-detected">
                    <PlatformLogo platform={detected} size={20} />
                    {detected.name}
                  </span>
                )}
              </span>
            </label>
            <div className="library-add__row">
              <label className="field library-add__title">
                <span className="field__label">Title (optional)</span>
                <input
                  className="input"
                  value={title}
                  maxLength={200}
                  placeholder="What is it about?"
                  disabled={savingLink}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="field library-add__category">
                <span className="field__label">Category</span>
                <Select
                  label="Category"
                  value={category}
                  onChange={setCategory}
                  disabled={savingLink}
                  options={[...CATEGORIES.map((item) => ({ value: item, label: item })), { value: OTHER_CATEGORY, label: 'Other…' }]}
                />
              </label>
              {category === OTHER_CATEGORY && (
                <label className="field library-add__category">
                  <span className="field__label">New category</span>
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
                {savingLink ? <Spinner /> : <Plus />} Save link
              </button>
            </div>
          </form>

          {links && links.length > 0 && (
            <div className="library-filters">
              {['All', ...categoriesInUse].map((item) => (
                <button key={item} className="chip-toggle" aria-pressed={filter === item} onClick={() => setFilter(item)}>
                  {item}
                </button>
              ))}
            </div>
          )}

          {links === null ? (
            <Skeleton height={140} />
          ) : links.length === 0 ? (
            <Empty title="No links yet">Paste a link above. The platform and its logo are detected from the address.</Empty>
          ) : (
            [...groups.entries()].map(([name, items]) => (
              <section key={name}>
                <SectionTitle title={name} />
                <div className="set-list">
                  {items.map((link) => {
                    const platform = platformForUrl(link.url);
                    return (
                      <div key={link.id} className="person">
                        <PlatformLogo platform={platform} />
                        <div className="person__body">
                          <div className="person__name">{link.title || hostOf(link.url)}</div>
                          <div className="person__meta">
                            {platform.name} · {hostOf(link.url)} · {formatDate(link.created_at)}
                          </div>
                        </div>
                        <div className="person__actions">
                          <div className="library-category">
                            <Select
                              label="Category"
                              value={link.category}
                              onChange={(value) => void changeCategory(link, value)}
                              options={[...new Set([...CATEGORIES, link.category])].map((item) => ({ value: item, label: item }))}
                            />
                          </div>
                          <button className="btn btn--ghost btn--sm" onClick={() => openLink(link.url, navigate)}>
                            <ExternalLink /> Open
                          </button>
                          <button className="btn btn--icon" onClick={() => setLinkToRemove(link)} aria-label={`Remove ${link.title || hostOf(link.url)}`}>
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

      {tab === 'ask' && (
        <div className="mt-4">
          <LibraryCoach files={files ?? []} selected={selected} onToggle={toggleSelected} />
        </div>
      )}

      {viewing && <FileViewer file={viewing} onClose={() => setViewing(null)} />}

      {fileToRemove && (
        <ConfirmSheet
          title="Remove this file?"
          confirmLabel="Remove file"
          onConfirm={() => void removeFile(fileToRemove)}
          onClose={() => setFileToRemove(null)}
        >
          {fileToRemove.name} is removed from your library. This cannot be undone.
        </ConfirmSheet>
      )}

      {linkToRemove && (
        <ConfirmSheet
          title="Remove this link?"
          confirmLabel="Remove link"
          onConfirm={() => void removeLink(linkToRemove)}
          onClose={() => setLinkToRemove(null)}
        >
          The link is removed from your library.
        </ConfirmSheet>
      )}
    </div>
  );
}
