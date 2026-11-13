// The places the search looks through: the screens, settings, units, lessons and tests the app ships with, and the
// learner's own results, library items, coach chats, friends and news. The bundled part is built once; the other
// part is read each time the search opens, so it always shows the current data.
import { levelSkillTests, levelTest, toeflSkillTests, toeflTest, wordsTest } from '../content';
import { TOEFL_UNITS, UNITS, type UnitDef } from '../content/roadmap';
import type { DataBackend } from './data/backend';
import type { SearchEntry } from './search';
import { LEVELS, SKILLS, SKILL_LABEL, type TestDef } from './types';

const PAGES: ReadonlyArray<{ title: string; route: string; keywords: string }> = [
  { title: 'Today', route: '/', keywords: 'home start next lesson hoje' },
  { title: 'Roadmap', route: '/roadmap', keywords: 'path units lessons trilha unidades' },
  { title: 'Self study', route: '/study', keywords: 'sections tests practice estudo livre' },
  { title: 'Review', route: '/review', keywords: 'repeat missed questions revisão' },
  { title: 'Coach', route: '/coach', keywords: 'chat tutor ask ai ia conversa' },
  { title: 'My library', route: '/library', keywords: 'files links pdf txt markdown biblioteca arquivos' },
  { title: 'Friends', route: '/friends', keywords: 'ranking inbox amigos' },
  { title: 'Profile', route: '/profile', keywords: 'picture name streak xp perfil foto' },
  { title: 'Settings', route: '/settings', keywords: 'configurações language key voice update' },
  { title: "What's new", route: '/whats-new', keywords: 'release notes novidades updates versão' },
];

const SETTINGS: ReadonlyArray<{ title: string; keywords: string }> = [
  { title: 'App language', keywords: 'idioma language english portuguese português' },
  { title: 'AI assistant', keywords: 'key chave openai anthropic gemini openrouter deepseek ia' },
  { title: 'Listening voice', keywords: 'voice voz natural speech tts audio som' },
  { title: 'Check for updates', keywords: 'update atualização version versão new release nova' },
];

let bundled: SearchEntry[] | null = null;

function testEntry(test: TestDef): SearchEntry {
  return {
    id: `test:${test.id}`,
    kind: 'test',
    title: test.title,
    detail: test.subtitle,
    bundled: true,
    route: `/play/test/${test.id}`,
    keywords: 'test mock simulado teste practice prática',
  };
}

/** The screens, sections, settings, units, lessons and tests the app ships with. Built once. */
export function bundledEntries(): SearchEntry[] {
  if (bundled) return bundled;
  const entries: SearchEntry[] = [];

  for (const page of PAGES) {
    entries.push({ id: `page:${page.route}`, kind: 'page', title: page.title, bundled: true, route: page.route, keywords: page.keywords });
  }
  for (const skill of SKILLS) {
    entries.push({
      id: `section:${skill}`,
      kind: 'page',
      title: SKILL_LABEL[skill],
      detail: 'Self study',
      bundled: true,
      route: `/study/${skill}`,
      keywords: `${skill} section seção estudo`,
    });
  }
  for (const setting of SETTINGS) {
    entries.push({
      id: `setting:${setting.title}`,
      kind: 'setting',
      title: setting.title,
      detail: 'Settings',
      bundled: true,
      route: '/settings',
      keywords: setting.keywords,
    });
  }

  const units: UnitDef[] = [...UNITS, ...TOEFL_UNITS];
  for (const unit of units) {
    entries.push({ id: `unit:${unit.id}`, kind: 'unit', title: unit.title, detail: unit.blurb, bundled: true, route: '/roadmap', keywords: `${unit.level} unit unidade` });
    for (const lesson of unit.lessons) {
      entries.push({
        id: `lesson:${lesson.id}`,
        kind: 'lesson',
        title: lesson.title,
        detail: unit.title,
        bundled: true,
        route: `/play/lesson/${lesson.id}`,
        keywords: `${lesson.skill} ${unit.level} ${lesson.blurb}`,
      });
    }
  }

  for (const level of LEVELS) {
    entries.push(testEntry(levelTest(level)));
    entries.push(testEntry(wordsTest(level)));
    for (const test of levelSkillTests(level)) entries.push(testEntry(test));
  }
  entries.push(testEntry(toeflTest()));
  for (const test of toeflSkillTests()) entries.push(testEntry(test));
  entries.push({ id: 'test:diagnostic', kind: 'test', title: 'Level check', bundled: true, route: '/play/diagnostic', keywords: 'placement diagnostic nível' });

  bundled = entries;
  return entries;
}

/** The learner's own places: results, library files and links, coach chats, friends and news. */
export async function learnerEntries(backend: DataBackend | null): Promise<SearchEntry[]> {
  if (!backend) return [];
  const [attempts, files, links, chats, friends, news] = await Promise.all([
    backend.listAttempts(60).catch(() => []),
    backend.listLibraryFiles().catch(() => []),
    backend.listLibraryLinks().catch(() => []),
    backend.listTutorChats().catch(() => []),
    backend.listFriends().catch(() => []),
    backend.listAnnouncements().catch(() => []),
  ]);

  const entries: SearchEntry[] = [];
  for (const attempt of attempts) {
    entries.push({ id: `result:${attempt.id}`, kind: 'result', title: attempt.title, bundled: false, route: `/report/${attempt.id}` });
  }
  for (const file of files) {
    entries.push({
      id: `file:${file.id}`,
      kind: 'file',
      title: file.name,
      detail: file.kind.toUpperCase(),
      bundled: false,
      route: '/library',
      state: { tab: 'files', fileId: file.id },
    });
  }
  for (const link of links) {
    entries.push({
      id: `link:${link.id}`,
      kind: 'link',
      title: link.title || link.url,
      detail: link.platform,
      bundled: false,
      route: '/library',
      state: { tab: 'links', query: link.title || link.url },
      keywords: `${link.url} ${link.note}`,
    });
  }
  for (const chat of chats) {
    entries.push({
      id: `chat:${chat.id}`,
      kind: 'chat',
      title: chat.title ?? 'Untitled chat',
      bundled: chat.title === null,
      route: '/coach',
      state: { chatId: chat.id },
    });
  }
  for (const friend of friends) {
    entries.push({
      id: `friend:${friend.friendship_id}`,
      kind: 'friend',
      title: friend.display_name || friend.username,
      detail: `@${friend.username}`,
      bundled: false,
      route: '/friends',
    });
  }
  for (const item of news) {
    entries.push({
      id: `news:${item.id}`,
      kind: 'news',
      title: item.title,
      detail: item.body.split('\n')[0]?.replace(/^- /, '').slice(0, 90),
      bundled: false,
      route: '/whats-new',
    });
  }
  return entries;
}
