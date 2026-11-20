// The writing check (2.0.0): the issues in a text, each with its place, a suggested fix and the reason in the learner's
// language. With an AI key the model finds them; without one, a few local rules find the basics. Every reply from the
// model is checked before it is used, so a wrong position or an invented issue is dropped, never shown.
export const WRITING_MIN_WORDS = 5;
export const WRITING_MAX_WORDS = 1500;
export const WRITING_CHECK_XP = 5;
const ISSUE_LIMIT = 25;

export const ISSUE_CATEGORIES = ['spelling', 'grammar', 'word_choice', 'clarity', 'punctuation', 'tone'] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];
export const TONES = ['formal', 'neutral', 'friendly', 'casual', 'assertive'] as const;
export type Tone = (typeof TONES)[number];

export interface Issue {
  /** Where the problem starts and ends, as character positions in the text checked (end is not included). */
  start: number;
  end: number;
  /** The words as they are in the text. */
  original: string;
  suggestion: string;
  category: IssueCategory;
  /** A short reason. The model writes it in the learner's language; the local rules write a key to translate. */
  reason: string;
}

export interface CheckResult {
  /** 0 to 100: how correct and clear the text is. */
  score: number;
  /** The tone the model hears, or null when the local rules ran. */
  tone: Tone | null;
  /** One or two sentences, or a key to translate for the local rules. */
  summary: string;
  issues: Issue[];
  /** True when the model checked the text, false when the local rules did. */
  byModel: boolean;
}

export function wordCount(text: string): number {
  const words = text.trim();
  return words ? words.split(/\s+/).length : 0;
}

/** The request for the model: one JSON object with the score, the tone, the summary and the issues, each with its place. */
export function writingCheckRequest(text: string, language: string): { system: string; prompt: string } {
  const system = [
    'You are a careful English writing coach. Find the real problems in the learner\'s text and suggest a fix for each one.',
    'Reply with one JSON object only, with no other text:',
    '{"score": integer 0-100 for how correct and clear the text is, "tone": one of "formal", "neutral", "friendly", "casual", "assertive", "summary": "one or two sentences", "issues": [{"start": integer, "end": integer, "original": "the exact words from the text between start and end", "suggestion": "the replacement", "category": one of "spelling", "grammar", "word_choice", "clarity", "punctuation", "tone", "reason": "one short sentence explaining why"}]}',
    'start and end are character positions in the text as given: start is included, end is not. original must be exactly text.slice(start, end).',
    `Return at most ${ISSUE_LIMIT} issues in order of position. Do not invent issues, and do not rewrite the whole text.`,
    `Write the summary and each reason in ${language}.`,
  ].join('\n');
  return { system, prompt: `Text:\n${text.slice(0, 9000)}` };
}

const str = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/**
 * Turns the model's reply into a check. An issue whose words are not at the position it names is found by its words
 * if they appear once in the text; otherwise it is dropped. Overlapping issues keep the first one.
 */
export function parseCheck(raw: unknown, text: string): CheckResult {
  if (!raw || typeof raw !== 'object') throw new Error('The check did not come back in the right form. Try again.');
  const data = raw as Record<string, unknown>;
  const score = Math.min(100, Math.max(0, Math.round(Number(data.score) || 0)));
  const tone = TONES.includes(data.tone as Tone) ? (data.tone as Tone) : 'neutral';
  const issues: Issue[] = [];
  const list = Array.isArray(data.issues) ? data.issues.slice(0, ISSUE_LIMIT * 2) : [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const category = ISSUE_CATEGORIES.includes(row.category as IssueCategory) ? (row.category as IssueCategory) : 'grammar';
    const original = str(row.original, 300);
    const suggestion = str(row.suggestion, 300);
    if (!original || !suggestion) continue;
    let start = Number.isInteger(row.start) ? (row.start as number) : -1;
    let end = Number.isInteger(row.end) ? (row.end as number) : -1;
    if (!(start >= 0 && end > start && end <= text.length && text.slice(start, end) === original)) {
      const found = text.indexOf(original);
      if (found < 0 || text.indexOf(original, found + 1) >= 0) continue;
      start = found;
      end = found + original.length;
    }
    const overlaps = issues.some((issue) => start < issue.end && end > issue.start);
    if (overlaps) continue;
    issues.push({ start, end, original: text.slice(start, end), suggestion, category, reason: str(row.reason, 240) || '' });
    if (issues.length >= ISSUE_LIMIT) break;
  }
  issues.sort((a, b) => a.start - b.start);
  return { score, tone, summary: str(data.summary, 400), issues, byModel: true };
}

/** Local rules for the basics. Each reason is a key, so the screen can translate it. */
const COMMON_MISTAKES: Record<string, string> = {
  alot: 'a lot',
  definately: 'definitely',
  recieve: 'receive',
  seperate: 'separate',
  occured: 'occurred',
  untill: 'until',
  wich: 'which',
  begining: 'beginning',
  accomodate: 'accommodate',
  goverment: 'government',
  tommorow: 'tomorrow',
  existance: 'existence',
  freind: 'friend',
  wierd: 'weird',
  becuase: 'because',
  beleive: 'believe',
};

const CONTRACTIONS: Record<string, string> = {
  dont: "don't",
  cant: "can't",
  wont: "won't",
  doesnt: "doesn't",
  didnt: "didn't",
  isnt: "isn't",
  im: "I'm",
};

export const LOCAL_REASON = {
  repeated: 'This word is repeated.',
  capitalI: 'Write “I” as a capital letter.',
  sentenceCapital: 'A new sentence starts with a capital letter.',
  spaces: 'Use one space between words.',
  spelling: 'Check this spelling.',
  apostrophe: 'Contractions need an apostrophe.',
} as const;

export const LOCAL_SUMMARY = 'Local check: spelling of common words, capitals, spaces and repeated words. Connect an AI key for a full check with reasons and a tone.';

/** Every match of a pattern, as issues. The pattern must have a global flag. */
function matches(text: string, pattern: RegExp, make: (match: RegExpExecArray) => Omit<Issue, 'start' | 'end' | 'original'> | null): Issue[] {
  const out: Issue[] = [];
  for (const match of text.matchAll(pattern)) {
    const row = make(match as RegExpExecArray);
    if (!row || match.index === undefined) continue;
    const original = match[0];
    out.push({ ...row, start: match.index, end: match.index + original.length, original });
  }
  return out;
}

export function localCheck(text: string): CheckResult {
  const found: Issue[] = [];
  found.push(
    ...matches(text, /\b([A-Za-z]+)\s+\1\b/gi, (match) => ({
      category: 'grammar',
      suggestion: match[1],
      reason: LOCAL_REASON.repeated,
    })),
  );
  found.push(
    ...matches(text, /(?<![A-Za-z'])i(?![A-Za-z'.])/g, () => ({
      category: 'grammar',
      suggestion: 'I',
      reason: LOCAL_REASON.capitalI,
    })),
  );
  found.push(
    ...matches(text, /([.!?]\s+)([a-z])/g, (match) => ({
      category: 'punctuation',
      // The fix keeps the full stop and the space, and only the first letter becomes a capital.
      suggestion: match[1] + match[2].toUpperCase(),
      reason: LOCAL_REASON.sentenceCapital,
    })),
  );
  found.push(...matches(text, / {2,}/g, () => ({ category: 'punctuation', suggestion: ' ', reason: LOCAL_REASON.spaces })));
  found.push(
    ...matches(text, /\b[A-Za-z]+\b/g, (match) => {
      const word = match[0].toLowerCase();
      if (COMMON_MISTAKES[word]) return { category: 'spelling', suggestion: COMMON_MISTAKES[word], reason: LOCAL_REASON.spelling };
      if (CONTRACTIONS[word]) return { category: 'punctuation', suggestion: CONTRACTIONS[word], reason: LOCAL_REASON.apostrophe };
      return null;
    }),
  );
  // Keep the first of any overlapping matches, in order of position.
  found.sort((a, b) => a.start - b.start);
  const issues: Issue[] = [];
  for (const issue of found) {
    if (issues.some((kept) => issue.start < kept.end && issue.end > kept.start)) continue;
    issues.push(issue);
    if (issues.length >= ISSUE_LIMIT) break;
  }
  // A capital "I" in the middle of a word is not an issue; the rule above only matches the lone word.
  const score = Math.max(0, 100 - issues.length * 6);
  return { score, tone: null, summary: LOCAL_SUMMARY, issues, byModel: false };
}

/** The text with one issue applied, and the issues that remain with their places moved to fit. */
export function applyIssue(text: string, issue: Issue, issues: readonly Issue[]): { text: string; issues: Issue[] } {
  const next = text.slice(0, issue.start) + issue.suggestion + text.slice(issue.end);
  const delta = issue.suggestion.length - (issue.end - issue.start);
  const remaining = issues
    .filter((item) => item !== issue)
    .map((item) => {
      if (item.start >= issue.end) return { ...item, start: item.start + delta, end: item.end + delta };
      return item;
    })
    .filter((item) => item.start >= 0 && item.end <= next.length && next.slice(item.start, item.end) === item.original);
  return { text: next, issues: remaining };
}
