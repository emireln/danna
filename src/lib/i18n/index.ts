// The language of the whole app. The English text in the code is the source; PT-BR is the Brazilian
// Portuguese translation, found by the English text itself (see ./pt). Text without a translation stays
// in English, so a missing string never shows up blank.
import { PT } from './pt';

export type Lang = 'en' | 'pt';
export type Vars = Record<string, string | number>;

export const LANGUAGES: ReadonlyArray<{ code: Lang; label: string; locale: string }> = [
  { code: 'en', label: 'English', locale: 'en-US' },
  { code: 'pt', label: 'PT-BR', locale: 'pt-BR' },
];

const STORAGE_KEY = 'danna.language';
const dictionary = new Map<string, string>(Object.entries(PT));

// Strings with a value inside them. The fixed words are translated and the value is kept as it is:
// a question about one word, a level test, or an instruction in front of an English sentence.
const PATTERNS: Array<{ match: RegExp; pt: (...values: string[]) => string }> = [
  { match: /^What does “(.+)” mean\?$/, pt: (word) => `O que significa “${word}”?` },
  { match: /^Choose the right word: (.+)$/, pt: (sentence) => `Escolha a palavra certa: ${sentence}` },
  { match: /^Choose the best word: (.+)$/, pt: (sentence) => `Escolha a melhor palavra: ${sentence}` },
  { match: /^(A1|A2|B1|B2|C1) level test$/, pt: (level) => `Teste de nível ${level}` },
  { match: /^(A1|A2|B1|B2|C1) vocabulary test$/, pt: (level) => `Teste de vocabulário ${level}` },
  // Provider messages: the provider's name is kept as it is, and a detail from the provider stays in English.
  { match: /^(.+) did not accept this key\. Check that it is still active\.$/, pt: (name) => `${name} não aceitou esta chave. Confira se ela ainda está ativa.` },
  { match: /^(.+) says this account has no credit left\. Add credit on .+, then try again\.$/, pt: (name) => `${name} informa que esta conta não tem mais crédito. Adicione crédito em ${name} e tente de novo.` },
  { match: /^(.+) no longer offers the selected model\. Choose another model in Settings\.$/, pt: (name) => `${name} não oferece mais o modelo escolhido. Escolha outro modelo em Configurações.` },
  { match: /^(.+) could not use this request(.*)\. Try a shorter message or another model\.$/, pt: (name, detail) => `${name} não conseguiu usar esta solicitação${detail}. Tente uma mensagem mais curta ou outro modelo.` },
  { match: /^(.+) is busy right now\. Please try again in a moment\.$/, pt: (name) => `${name} está ocupado agora. Tente de novo em instantes.` },
  { match: /^We could not reach (.+)\. Check your internet connection\.$/, pt: (name) => `Não foi possível conectar com ${name}. Confira sua conexão com a internet.` },
  { match: /^(.+) could not finish that\. Please try again\.$/, pt: (name) => `${name} não conseguiu concluir isso. Tente de novo.` },
  { match: /^(.+) did not return any chat models for this key\.$/, pt: (name) => `${name} não retornou nenhum modelo de conversa para esta chave.` },
];

let current: Lang = 'en';

export function parseLang(value: unknown): Lang | null {
  return value === 'en' || value === 'pt' ? value : null;
}

/** The language to start with: the one chosen before, else PT-BR on a Portuguese system, else English. */
export function detectLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = parseLang(window.localStorage.getItem(STORAGE_KEY));
    if (saved) return saved;
  } catch {
    // Storage can be blocked. The system language still decides.
  }
  return (navigator.language ?? '').toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function getLang(): Lang {
  return current;
}

export function getLocale(): string {
  return LANGUAGES.find((item) => item.code === current)?.locale ?? 'en-US';
}

/** The language the AI should answer in: the one the app is shown in. */
export function replyLanguage(): string {
  return current === 'pt' ? 'Brazilian Portuguese' : 'English';
}

export function setLang(lang: Lang): void {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = getLocale();
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Without storage, the choice lasts until the app closes.
  }
}

/** Starts the app in the right language. Called once, before the first screen is drawn. */
export function initLang(): Lang {
  setLang(detectLang());
  return current;
}

function translated(text: string): string {
  if (current !== 'pt') return text;
  const direct = dictionary.get(text);
  if (direct !== undefined) return direct;
  for (const pattern of PATTERNS) {
    const found = text.match(pattern.match);
    if (found) return pattern.pt(...found.slice(1));
  }
  return text;
}

function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** The text in the current language. Values written as {name} are filled from vars. */
export function t(text: string, vars?: Vars): string {
  return fill(translated(text), vars);
}

/** The singular or the plural text, chosen by count. Each form is a string of its own, with {count} in it. */
export function tn(one: string, other: string, count: number, vars?: Vars): string {
  return t(count === 1 ? one : other, { count, ...vars });
}
