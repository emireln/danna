// The search of the whole app: the places a learner can open (screens, lessons, tests, results, library items,
// coach chats, friends and news) and how a query matches them. Pure functions, so the tests can check them.

export type SearchKind = 'page' | 'setting' | 'lesson' | 'test' | 'unit' | 'result' | 'chat' | 'file' | 'link' | 'friend' | 'news';

export interface SearchEntry {
  /** Unique among the entries. */
  id: string;
  kind: SearchKind;
  /** The name. */
  title: string;
  /** A line under the name. */
  detail?: string;
  /** Extra words the search also looks at. They are not shown. */
  keywords?: string;
  /**
   * True for the names and details the app ships with: they are English texts, shown in the language of the app.
   * False for what the learner made (files, links, chats, friends) and for news, which is shown as it is written.
   */
  bundled: boolean;
  /** The screen the result opens. */
  route: string;
  /** What that screen needs to show the result: a tab, a query, a file or a chat. */
  state?: Record<string, unknown>;
}

/** The order of the groups in the results. */
export const KIND_ORDER: readonly SearchKind[] = [
  'page',
  'setting',
  'lesson',
  'test',
  'unit',
  'result',
  'chat',
  'file',
  'link',
  'friend',
  'news',
];

/** Lower case, without accents, with single spaces, so that "acao" finds "ação" and "Coach" finds "coach". */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SearchHit {
  entry: SearchEntry;
  /** Higher is closer to the query. */
  score: number;
}

/**
 * The entries that match the query, best first. Every word of the query must appear in the name (as it is shown,
 * or as it is written), in the detail, or in the keywords. A name that starts with the whole query ranks first.
 */
export function searchEntries(
  entries: readonly SearchEntry[],
  query: string,
  translate: (text: string) => string,
  limit = 80,
): SearchHit[] {
  const phrase = normalizeSearch(query);
  if (!phrase) return [];
  const words = phrase.split(' ');
  const hits: SearchHit[] = [];
  for (const entry of entries) {
    const shown = normalizeSearch(entry.bundled ? translate(entry.title) : entry.title);
    const written = normalizeSearch(entry.title);
    const detail = entry.detail ? normalizeSearch(entry.bundled ? translate(entry.detail) : entry.detail) : '';
    const haystack = [shown, written, detail, normalizeSearch(entry.keywords ?? '')].join(' ');
    if (!words.every((word) => haystack.includes(word))) continue;
    const score =
      shown.startsWith(phrase) || written.startsWith(phrase)
        ? 4
        : shown.includes(phrase) || written.includes(phrase)
          ? 3
          : shown.split(' ').some((part) => part.startsWith(words[0]))
            ? 2
            : 1;
    hits.push({ entry, score });
  }
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      KIND_ORDER.indexOf(a.entry.kind) - KIND_ORDER.indexOf(b.entry.kind) ||
      a.entry.title.localeCompare(b.entry.title),
  );
  return hits.slice(0, limit);
}

/** The matches in groups by kind, in the order each kind first appears. Each group keeps its order. */
export function groupHits(hits: readonly SearchHit[]): Array<{ kind: SearchKind; hits: SearchHit[] }> {
  const groups = new Map<SearchKind, SearchHit[]>();
  for (const hit of hits) groups.set(hit.entry.kind, [...(groups.get(hit.entry.kind) ?? []), hit]);
  return [...groups.entries()].map(([kind, list]) => ({ kind, hits: list }));
}
