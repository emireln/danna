// The coach's replies can carry blocks that the app draws as cards. A block is a fenced code block with a name
// (exercise, chips, feedback, vocab or actions) and one JSON value. Everything else is plain text. A block that
// does not read as it should is left out, so the rest of the reply still shows. The grading and the checks here
// are the same on every screen.

export type ExerciseItem =
  | { type: 'choice'; prompt: string; options: string[]; answer: number; explain: string }
  | { type: 'gap'; prompt: string; answers: string[]; hint: string; explain: string }
  | { type: 'free'; prompt: string };

export interface Exercise {
  title: string;
  items: ExerciseItem[];
}

export interface FeedbackScore {
  label: string;
  score: number;
}

export interface Correction {
  before: string;
  after: string;
  why: string;
}

/** The feedback on a text the learner wrote: its scores, its corrections, and a model version. */
export interface Feedback {
  title: string;
  scores: FeedbackScore[];
  summary: string;
  corrections: Correction[];
  model: string;
}

export interface VocabItem {
  word: string;
  meaning: string;
  example: string;
  note: string;
}

export interface AppAction {
  label: string;
  to: string;
}

export type CoachPart =
  | { kind: 'text'; text: string }
  | { kind: 'exercise'; exercise: Exercise }
  | { kind: 'chips'; chips: string[] }
  | { kind: 'feedback'; feedback: Feedback }
  | { kind: 'vocab'; items: VocabItem[] }
  | { kind: 'actions'; actions: AppAction[] };

/** What the learner gave for one item: the option's index, the words typed for each blank, or a free answer. */
export type ItemResponse = number | string[] | string;

export const BLANK = '___';

const MAX_ITEMS = 8;
const MAX_OPTIONS = 6;
const MAX_PROMPT = 400;
const MAX_OPTION = 120;
const MAX_CHIPS = 4;
const MAX_CHIP = 60;
const MAX_SCORES = 6;
const MAX_CORRECTIONS = 8;
const MAX_TEXT = 400;
const MAX_SUMMARY = 600;
const MAX_MODEL = 2000;
const MAX_WORDS = 8;
const MAX_ACTIONS = 4;

// A block opens with ```name and closes with ```. Its body is the JSON.
const BLOCK = /```(exercise|chips|feedback|vocab|actions)[ \t]*\r?\n([\s\S]*?)\r?\n?```/g;
const OPENING = /```(exercise|chips|feedback|vocab|actions)\b/;

/** The paths the coach may send the learner to. Lessons and tests are checked against the content before they show. */
export const ROUTE_PATTERN =
  /^\/(study\/(reading|listening|speaking|writing|language|toefl)|review|exam|roadmap|play\/diagnostic|play\/test\/[a-z0-9-]{1,40}|play\/lesson\/[a-z0-9-]{1,80})$/;

export function isAppRoute(path: string): boolean {
  return ROUTE_PATTERN.test(path);
}

/** The blocks the app draws as cards, as the model is told them. Each form is written the way the app reads it. */
export const COACH_BLOCK_GUIDE = [
  'Some replies carry blocks that the app draws as cards. A block is written as a line with three backticks and its name, then one JSON value, then a line with three backticks. Use a block only when it helps; most replies are plain text. The blocks and their JSON:',
  '- ```exercise, then {"title": string, "items": [...]}, with up to eight items. Every item has a "type", which is "choice", "gap" or "free". A "choice" item has "type": "choice", "prompt", "options" (two to four strings), "answer" (the index of the right option, counting from 0) and "explain". A "gap" item has "type": "gap", "prompt" with ___ for each missing word, "answers" (one string for each ___, in order; accepted alternatives are joined with |), an optional "hint", and "explain". A "free" item has "type": "free" and a "prompt" that asks the learner to write something; the app sends their answer to you.',
  '  For example, one choice question is written as a line of three backticks and "exercise", then this JSON, then a line of three backticks:',
  '  {"title": "Past simple", "items": [{"type": "choice", "prompt": "Yesterday I ___ to the cinema.", "options": ["go", "went", "gone"], "answer": 1, "explain": "Yesterday needs the past simple, went."}]}',
  '- ```feedback, then {"title": string, "scores": [{"label": string, "score": number from 0 to 5}], "summary": string, "corrections": [{"before": string, "after": string, "why": string}], "model": string}, for a text the learner wrote. "before" quotes the learner\'s own words exactly.',
  '- ```vocab, then {"items": [{"word": string, "meaning": string, "example": string, "note": string}]}, for new words. Each "example" uses the exact word, so the app can save it for review.',
  '- ```actions, then {"items": [{"label": string, "to": string}]}, to send the learner to practice in the app. The allowed paths are /study/reading, /study/listening, /study/speaking, /study/writing, /study/language, /study/toefl, /review, /exam, /roadmap, /play/diagnostic and /play/test/ followed by a test id.',
  '- ```chips, then a JSON list of two to four short replies the learner can tap next, written in the reply language. End most replies with one.',
  'Never write the answers in the text, and never write an answer key. The app marks the answers.',
].join('\n');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A text value, with its spaces tidied and its length limited. Anything that is not text becomes empty. */
function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** A text value that keeps its line breaks, for a paragraph. */
function paragraph(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, max) : '';
}

/** The JSON of a block. A trailing comma, which models often leave, is forgiven once. Null when it is not JSON. */
function readJson(body: string): unknown {
  for (const source of [body, body.replace(/,\s*([}\]])/g, '$1')]) {
    try {
      return JSON.parse(source);
    } catch {
      // Tried again below, without the trailing commas.
    }
  }
  return null;
}

// The names an item's "type" may carry, written without spaces, dashes or underscores.
const KINDS = new Map<string, ExerciseItem['type']>([
  ['choice', 'choice'],
  ['multiplechoice', 'choice'],
  ['mcq', 'choice'],
  ['gap', 'gap'],
  ['fill', 'gap'],
  ['fillin', 'gap'],
  ['blank', 'gap'],
  ['free', 'free'],
]);

/**
 * The kind of an item. A type the item names is used, and a name the app does not know leaves the item out. An item
 * with no type is read from its fields: options make a choice, answers make a gap, and anything else is a free answer.
 */
function kindOf(value: Record<string, unknown>): ExerciseItem['type'] | null {
  const named = value.type === undefined || value.type === null ? '' : String(value.type).replace(/[\s_-]+/g, '').toLowerCase();
  if (named) return KINDS.get(named) ?? null;
  if (Array.isArray(value.options)) return 'choice';
  if (value.answer !== undefined || value.answers !== undefined) return 'gap';
  return 'free';
}

/** The index of the right option. A number counts from 0. Text may be the option itself, or its letter (A to F). */
function answerIndex(value: unknown, options: string[]): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = clean(value, MAX_OPTION);
  if (/^\d+$/.test(text)) return Number(text);
  const same = options.findIndex((option) => option.toLowerCase() === text.toLowerCase());
  if (same !== -1) return same;
  const letter = /^\(?([a-f])\)?[.):]?$/i.exec(text);
  return letter ? letter[1].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0) : null;
}

/** The accepted answers of a gap, as the model wrote them: a list, or one text for a single blank. */
function answersOf(value: Record<string, unknown>): unknown[] {
  const raw = value.answers !== undefined ? value.answers : value.answer;
  if (Array.isArray(raw)) return raw;
  return raw === undefined ? [] : [raw];
}

function toItem(value: unknown): ExerciseItem | null {
  if (!isRecord(value)) return null;
  const prompt = clean(value.prompt, MAX_PROMPT).replace(/_{3,}/g, BLANK);
  if (!prompt) return null;
  const explain = clean(value.explain, MAX_PROMPT);
  switch (kindOf(value)) {
    case 'choice': {
      const options = Array.isArray(value.options)
        ? value.options.map((option) => clean(option, MAX_OPTION)).filter((option) => option.length > 0).slice(0, MAX_OPTIONS)
        : [];
      const answer = answerIndex(value.answer, options);
      if (options.length < 2 || answer === null || answer < 0 || answer >= options.length) {
        return null;
      }
      return { type: 'choice', prompt, options, answer, explain };
    }
    case 'gap': {
      const blanks = prompt.split(BLANK).length - 1;
      const answers = answersOf(value).map((answer) => clean(answer, MAX_OPTION));
      if (blanks < 1 || answers.length !== blanks || answers.some((answer) => answer.length === 0)) return null;
      return { type: 'gap', prompt, answers, hint: clean(value.hint, MAX_PROMPT), explain };
    }
    case 'free':
      return { type: 'free', prompt };
    default:
      return null;
  }
}

function toExercise(value: unknown): Exercise | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const items = value.items
    .map(toItem)
    .filter((item): item is ExerciseItem => item !== null)
    .slice(0, MAX_ITEMS);
  return items.length > 0 ? { title: clean(value.title, MAX_OPTION), items } : null;
}

function toChips(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const chips = [...new Set(value.map((chip) => clean(chip, MAX_CHIP)).filter((chip) => chip.length > 0))].slice(0, MAX_CHIPS);
  return chips.length > 0 ? chips : null;
}

function toFeedback(value: unknown): Feedback | null {
  if (!isRecord(value)) return null;
  const scores: FeedbackScore[] = [];
  if (Array.isArray(value.scores)) {
    for (const item of value.scores) {
      if (!isRecord(item) || typeof item.score !== 'number' || !Number.isFinite(item.score)) continue;
      const label = clean(item.label, MAX_OPTION);
      if (label) scores.push({ label, score: Math.min(5, Math.max(0, Math.round(item.score * 2) / 2)) });
    }
  }
  const corrections: Correction[] = [];
  if (Array.isArray(value.corrections)) {
    for (const item of value.corrections) {
      if (!isRecord(item)) continue;
      const before = clean(item.before, MAX_TEXT);
      const after = clean(item.after, MAX_TEXT);
      if (before && after && before !== after) corrections.push({ before, after, why: clean(item.why, MAX_TEXT) });
    }
  }
  const summary = clean(value.summary, MAX_SUMMARY);
  const model = paragraph(value.model, MAX_MODEL);
  if (scores.length === 0 && corrections.length === 0 && !summary && !model) return null;
  return {
    title: clean(value.title, MAX_OPTION),
    scores: scores.slice(0, MAX_SCORES),
    summary,
    corrections: corrections.slice(0, MAX_CORRECTIONS),
    model,
  };
}

function toVocab(value: unknown): VocabItem[] | null {
  const raw = isRecord(value) ? value.items : value;
  if (!Array.isArray(raw)) return null;
  const items: VocabItem[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const word = clean(item.word, 40);
    const meaning = clean(item.meaning, 160);
    if (!word || !meaning || !/^[A-Za-z][A-Za-z '-]*$/.test(word)) continue;
    items.push({ word, meaning, example: clean(item.example, 240), note: clean(item.note, 160) });
  }
  const kept = items.slice(0, MAX_WORDS);
  return kept.length > 0 ? kept : null;
}

function toActions(value: unknown): AppAction[] | null {
  const raw = isRecord(value) ? value.items : value;
  if (!Array.isArray(raw)) return null;
  const actions: AppAction[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const label = clean(item.label, MAX_OPTION);
    const to = typeof item.to === 'string' ? item.to.trim() : '';
    if (label && isAppRoute(to)) actions.push({ label, to });
  }
  const kept = actions.slice(0, MAX_ACTIONS);
  return kept.length > 0 ? kept : null;
}

const READERS: Record<BlockKind, (value: unknown) => CoachPart | null> = {
  exercise: (value) => {
    const exercise = toExercise(value);
    return exercise ? { kind: 'exercise', exercise } : null;
  },
  chips: (value) => {
    const chips = toChips(value);
    return chips ? { kind: 'chips', chips } : null;
  },
  feedback: (value) => {
    const feedback = toFeedback(value);
    return feedback ? { kind: 'feedback', feedback } : null;
  },
  vocab: (value) => {
    const items = toVocab(value);
    return items ? { kind: 'vocab', items } : null;
  },
  actions: (value) => {
    const actions = toActions(value);
    return actions ? { kind: 'actions', actions } : null;
  },
};

type BlockKind = 'exercise' | 'chips' | 'feedback' | 'vocab' | 'actions';

function addText(parts: CoachPart[], text: string): void {
  const trimmed = text.trim();
  if (trimmed) parts.push({ kind: 'text', text: trimmed });
}

/** Splits a reply into its plain text and its cards, in the order they appear. */
export function parseCoachReply(reply: string): CoachPart[] {
  const parts: CoachPart[] = [];
  const pattern = new RegExp(BLOCK.source, 'g');
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(reply)) !== null) {
    addText(parts, reply.slice(cursor, match.index));
    const part = READERS[match[1] as BlockKind](readJson(match[2]));
    if (part) parts.push(part);
    cursor = match.index + match[0].length;
  }
  // A block that never closes means the reply was cut short, or is still being written. That block and what
  // follows it are left out until it closes.
  const rest = reply.slice(cursor);
  const open = rest.search(OPENING);
  addText(parts, open === -1 ? rest : rest.slice(0, open));
  return parts;
}

/** The text of a reply as it is read aloud or copied: no cards, and no markdown marks. */
export function spokenText(parts: CoachPart[]): string {
  return parts
    .filter((part): part is { kind: 'text'; text: string } => part.kind === 'text')
    .map((part) => part.text)
    .join(' ')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normal(value: string): string {
  return value.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
}

/** A typed word matches an accepted one when the letters match. Capitals, the spaces at the ends and a final full stop do not count. */
export function gapMatches(typed: string, accepted: string): boolean {
  const given = normal(typed);
  if (!given) return false;
  return accepted.split('|').some((option) => normal(option) === given);
}

/** True when the answer to an item is right, false when it is wrong or missing, and null for a free answer, which the coach reads. */
export function gradeItem(item: ExerciseItem, response: ItemResponse | undefined): boolean | null {
  switch (item.type) {
    case 'free':
      return null;
    case 'choice':
      return typeof response === 'number' && response === item.answer;
    case 'gap':
      return Array.isArray(response) && item.answers.every((accepted, blank) => gapMatches(response[blank] ?? '', accepted));
  }
}

/** How many of the graded items (choices and blanks) are right, and which ones are not, unanswered ones included. */
export function scoreExercise(items: readonly ExerciseItem[], responses: Record<string, ItemResponse>): { graded: number; correct: number; wrong: number[] } {
  let graded = 0;
  let correct = 0;
  const wrong: number[] = [];
  items.forEach((item, index) => {
    const right = gradeItem(item, responses[String(index)]);
    if (right === null) return;
    graded += 1;
    if (right) correct += 1;
    else wrong.push(index);
  });
  return { graded, correct, wrong };
}

/** The average of a feedback's scores, to one decimal place. Null when it has no scores. */
export function averageScore(scores: readonly FeedbackScore[]): number | null {
  if (scores.length === 0) return null;
  const total = scores.reduce((sum, item) => sum + item.score, 0);
  return Math.round((total / scores.length) * 10) / 10;
}
