// Prompts and validators for everything the AI writes or grades. Model output is
// untrusted: it is parsed, validated and clamped before the app uses it.
import {
  SKILLS,
  type ChatMessage,
  type Goal,
  type Level,
  type Passage,
  type Question,
  type Skill,
  type TestContent,
  type TutorRow,
} from './types';

const LEVEL_GUIDE: Record<Level, string> = {
  A1: 'beginner (A1): single words and very short, simple sentences about daily life',
  A2: 'elementary (A2): short, simple sentences and everyday words',
  B1: 'intermediate (B1): clear everyday and study topics',
  B2: 'upper-intermediate (B2): academic topics and longer sentences',
  C1: 'advanced (C1): academic vocabulary and complex structures',
};

const WRITING_RUBRIC = ['Clear position', 'Developed reasons', 'Specific examples', 'Grammar and linking words'];
const SPEAKING_RUBRIC = ['Clear answer', 'Specific details', 'Fluent delivery'];

export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('The model did not return the expected JSON. Try again.');
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error('The model returned malformed JSON. Try again.');
  }
}

const str = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const num = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

const list = (value: unknown, max: number, itemMax: number): string[] =>
  Array.isArray(value) ? value.map((item) => str(item, itemMax)).filter(Boolean).slice(0, max) : [];

function toQuestion(raw: unknown, index: number, fallback: Skill | 'mixed'): Question {
  if (!raw || typeof raw !== 'object') throw new Error('Question is not an object.');
  const q = raw as Record<string, unknown>;
  const skillName = str(q.skill, 20).toLowerCase();
  const skill: Skill = (SKILLS as readonly string[]).includes(skillName)
    ? (skillName as Skill)
    : fallback === 'mixed'
      ? 'language'
      : fallback;
  const prompt = str(q.prompt, 500);
  if (!prompt) throw new Error('Question has no prompt.');

  const common = {
    id: `q${index + 1}`,
    skill,
    prompt,
    explanation: str(q.explanation, 400) || undefined,
    passageId: str(q.passageId, 40) || undefined,
    listen: str(q.listen, 1500) || undefined,
  };

  switch (str(q.type, 20)) {
    case 'choice': {
      const options = Array.isArray(q.options) ? q.options.map((item) => str(item, 200)).filter(Boolean) : [];
      const answer = Number(q.answer);
      if (options.length < 3 || options.length > 5 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) {
        throw new Error('Choice question has invalid options.');
      }
      return { ...common, type: 'choice', options, answer };
    }
    case 'cloze': {
      const body = str(q.text, 900);
      if (!/\{\{[^{}]+\}\}/.test(body)) throw new Error('Cloze question has no blanks.');
      return { ...common, type: 'cloze', text: body };
    }
    case 'reorder': {
      const answer = str(q.answer, 300);
      if (answer.split(/\s+/).length < 3) throw new Error('Reorder answer is too short.');
      return { ...common, type: 'reorder', answer };
    }
    case 'writing': {
      const rubric = list(q.rubric, 4, 120);
      return {
        ...common,
        skill: 'writing',
        type: 'writing',
        minWords: num(q.minWords, 60, 300, 120),
        rubric: rubric.length >= 2 ? rubric : WRITING_RUBRIC,
      };
    }
    case 'speaking': {
      const rubric = list(q.rubric, 4, 120);
      return {
        ...common,
        skill: 'speaking',
        type: 'speaking',
        seconds: num(q.seconds, 30, 60, 45),
        rubric: rubric.length >= 2 ? rubric : SPEAKING_RUBRIC,
      };
    }
    default:
      throw new Error('Unknown question type.');
  }
}

export interface GeneratedTest {
  title: string;
  description: string;
  minutes: number;
  content: TestContent;
}

export function validateGeneratedTest(raw: unknown, fallbackSkill: Skill | 'mixed'): GeneratedTest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('The generated set was not in the expected format. Try again.');
  }
  const data = raw as Record<string, unknown>;

  const passages: Passage[] = (Array.isArray(data.passages) ? data.passages : []).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const p = item as Record<string, unknown>;
    const body = str(p.text, 3000);
    return body
      ? [{ id: str(p.id, 40) || `p${index + 1}`, title: str(p.title, 120) || `Passage ${index + 1}`, text: body }]
      : [];
  });

  const questions: Question[] = [];
  (Array.isArray(data.questions) ? data.questions : []).forEach((item, index) => {
    try {
      questions.push(toQuestion(item, index, fallbackSkill));
    } catch {
      // Malformed items are skipped; the set is kept if enough valid ones remain.
    }
  });
  if (questions.length < 3) throw new Error('The generated set did not contain enough valid questions. Try again.');

  return {
    title: str(data.title, 80) || 'Generated practice set',
    description: str(data.description, 200),
    minutes: num(data.minutes, 3, 40, Math.max(4, Math.round(questions.length * 1.5))),
    content: { passages, questions },
  };
}

export function testRequest(options: { skill: Skill | 'mixed'; level: Level; topic: string; count: number }): {
  system: string;
  prompt: string;
} {
  const system = [
    'You write original English practice material for learners.',
    'Reply with one JSON object and nothing else: no markdown and no commentary.',
    'Shape: {"title": string, "description": string, "minutes": number, "passages": [{"id": "p1", "title": string, "text": string}], "questions": [...]}',
    'Each question has "id" (unique), "skill" (reading | listening | speaking | writing | language), "prompt", "explanation" (one or two sentences), "type", and:',
    '- "choice": "options" (3 to 5 strings) and "answer", the index of the one correct option.',
    '- "cloze": "text" with blanks written as {{word}}, or {{word:2}} to show the first 2 letters.',
    '- "reorder": "answer", the complete correct sentence.',
    '- "writing": "minWords" (60 to 300) and "rubric" (3 short criteria).',
    '- "speaking": "seconds" (30 to 60) and "rubric" (3 short criteria).',
    'Reading choice questions set "passageId" to a passage id. Listening choice questions include "listen": a 50 to 90 word transcript that will be read aloud.',
    `Write for ${LEVEL_GUIDE[options.level]}. Keep every item original and unambiguous, and make wrong options plausible.`,
  ].join('\n');

  const focus =
    options.skill === 'mixed'
      ? 'a balanced mix of reading, listening, speaking, writing and language questions'
      : `${options.skill} questions only`;
  const prompt = `Create ${options.count} questions on: ${options.topic.trim() || 'everyday academic life'}. Use ${focus}.`;
  return { system, prompt };
}

export interface Feedback {
  score: number;
  strengths: string[];
  improvements: string[];
  revision: string;
}

export function writingRequest(options: { task: string; rubric: string[]; minWords: number; response: string }): {
  system: string;
  prompt: string;
} {
  const words = options.response.trim() ? options.response.trim().split(/\s+/).length : 0;
  const system = [
    'You are an experienced English writing teacher.',
    'Score the response from 0 to 5 (decimals allowed) using these criteria: task fulfilment, development, organisation and language use.',
    'Reply with one JSON object only: {"score": number, "strengths": [up to 3 short strings], "improvements": [up to 3 short strings], "revision": "one improved sentence taken from the response"}.',
    'Be specific and honest. Quote the learner\'s own words when you point out an error. Keep the total feedback under 120 words.',
  ].join('\n');
  const prompt = `Task: ${options.task}\nCriteria: ${options.rubric.join('; ')}\nMinimum length: ${options.minWords} words. The response has ${words}.\n\nResponse:\n${options.response.slice(0, 6000)}`;
  return { system, prompt };
}

export function speakingRequest(options: { task: string; rubric: string[]; transcript: string }): {
  system: string;
  prompt: string;
} {
  const system = [
    'You are an experienced English speaking teacher. You receive an automatic transcript of a spoken answer of about 45 seconds.',
    'Score from 0 to 5 for delivery, language use and topic development.',
    'Reply with one JSON object only: {"score": number, "strengths": [up to 3 short strings], "improvements": [up to 3 short strings], "revision": "one sentence the learner could say instead"}.',
    'Keep the total feedback under 100 words.',
  ].join('\n');
  const prompt = `Task: ${options.task}\nCriteria: ${options.rubric.join('; ')}\n\nTranscript:\n${options.transcript.slice(0, 4000)}`;
  return { system, prompt };
}

export function parseFeedback(raw: unknown): Feedback {
  if (!raw || typeof raw !== 'object') throw new Error('The grader did not return feedback. Try again.');
  const data = raw as Record<string, unknown>;
  const score = Number(data.score);
  if (!Number.isFinite(score)) throw new Error('The grader did not return a score. Try again.');
  return {
    score: Math.min(5, Math.max(0, Math.round(score * 10) / 10)),
    strengths: list(data.strengths, 3, 160),
    improvements: list(data.improvements, 3, 160),
    revision: str(data.revision, 400),
  };
}

export function coachSystem(profile: { level: Level; goal: Goal; target_score: number }): string {
  const aim =
    profile.goal === 'toefl'
      ? `The learner is also warming up for the TOEFL iBT, aiming for a score of ${profile.target_score}.`
      : 'The learner is studying English in general, for everyday life, study and work.';
  return [
    'You are the danna coach: a patient English coach.',
    `The learner is at ${LEVEL_GUIDE[profile.level]}. ${aim}`,
    'Answer in short paragraphs. When you correct a mistake, show the corrected sentence and explain the rule in one sentence.',
    'When asked for practice, give three to five short items and put the answers at the end. Use plain text: no tables and no emoji.',
    'If a question is unrelated to English, answer briefly and steer the conversation back to learning.',
  ].join('\n');
}

export function chatHistory(rows: TutorRow[]): ChatMessage[] {
  return rows.slice(-20).map((row) => ({ role: row.role, content: row.content }));
}
