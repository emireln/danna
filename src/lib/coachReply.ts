// The coach's replies can carry interactive parts, written as fenced blocks: an exercise (choices, blanks or a free
// answer, as JSON) and quick replies (a JSON list). Everything else is plain text. A block that does not read as it
// should is left out, so the rest of the reply still shows. The grading here is the same for every screen.

export type ExerciseItem =
  | { type: 'choice'; prompt: string; options: string[]; answer: number; explain: string }
  | { type: 'gap'; prompt: string; answers: string[]; hint: string; explain: string }
  | { type: 'free'; prompt: string };

export interface Exercise {
  title: string;
  items: ExerciseItem[];
}

export type CoachPart = { kind: 'text'; text: string } | { kind: 'exercise'; exercise: Exercise } | { kind: 'chips'; chips: string[] };

/** What the learner gave for one item: the option's index, the words typed for each blank, or a free answer. */
export type ItemResponse = number | string[] | string;

export const BLANK = '___';
const MAX_ITEMS = 8;
const MAX_OPTIONS = 6;
const MAX_PROMPT = 400;
const MAX_OPTION = 120;
const MAX_CHIPS = 4;
const MAX_CHIP = 60;

// A block opens with ```exercise or ```chips and closes with ```. Its body is the JSON.
const BLOCK = /```(exercise|chips)[ \t]*\r?\n([\s\S]*?)\r?\n?```/g;
const OPENING = /```(exercise|chips)\b/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A text value, with its spaces tidied and its length limited. Anything that is not text becomes empty. */
function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
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

function toItem(value: unknown): ExerciseItem | null {
  if (!isRecord(value)) return null;
  const prompt = clean(value.prompt, MAX_PROMPT).replace(/_{3,}/g, BLANK);
  if (!prompt) return null;
  const explain = clean(value.explain, MAX_PROMPT);
  switch (value.type) {
    case 'choice': {
      const options = Array.isArray(value.options)
        ? value.options.map((option) => clean(option, MAX_OPTION)).filter((option) => option.length > 0).slice(0, MAX_OPTIONS)
        : [];
      const answer = value.answer;
      if (options.length < 2 || typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer >= options.length) {
        return null;
      }
      return { type: 'choice', prompt, options, answer, explain };
    }
    case 'gap': {
      const blanks = prompt.split(BLANK).length - 1;
      const answers = Array.isArray(value.answers) ? value.answers.map((answer) => clean(answer, MAX_OPTION)) : [];
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

function addText(parts: CoachPart[], text: string): void {
  const trimmed = text.trim();
  if (trimmed) parts.push({ kind: 'text', text: trimmed });
}

/** Splits a reply into its plain text, its exercises and its quick replies, in the order they appear. */
export function parseCoachReply(reply: string): CoachPart[] {
  const parts: CoachPart[] = [];
  const pattern = new RegExp(BLOCK.source, 'g');
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(reply)) !== null) {
    addText(parts, reply.slice(cursor, match.index));
    const value = readJson(match[2]);
    if (match[1] === 'exercise') {
      const exercise = toExercise(value);
      if (exercise) parts.push({ kind: 'exercise', exercise });
    } else {
      const chips = toChips(value);
      if (chips) parts.push({ kind: 'chips', chips });
    }
    cursor = match.index + match[0].length;
  }
  // A block that never closes means the reply was cut short. That block and what follows it are left out.
  const rest = reply.slice(cursor);
  const open = rest.search(OPENING);
  addText(parts, open === -1 ? rest : rest.slice(0, open));
  return parts;
}

/** The text of a reply as it is read aloud: no exercises, no quick replies, and no markdown marks. */
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
