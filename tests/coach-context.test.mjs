// Tests what the coach is told about the learner: the level and goal, the days to the exam, the weakest skill, the
// answers to review, and that the text stays short.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let context;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  context = await server.ssrLoadModule('/src/lib/coachContext.ts');
});

after(async () => {
  await server?.close();
});

const profile = { level: 'B1', goal: 'toefl', target_score: 100, exam_date: '2026-12-01', exam_name: 'TOEFL iBT' };
const cloze = (id, text) => ({ item_key: id, skill: 'language', payload: { question: { id, type: 'cloze', skill: 'language', prompt: 'Fill the gap', text } }, ease: 2.5, interval_days: 0, reps: 0, due_at: '2026-11-01T09:00:00Z' });

test('the context gives the level, the goal, and the days left to a dated exam', () => {
  const text = context.learnerContext({ profile, skills: {}, mistakes: [], today: '2026-11-17' });
  assert.match(text, /Level B1\. Studying for the TOEFL iBT, target score 100 of 120\./);
  assert.match(text, /Exam: "TOEFL iBT", on 2026-12-01 \(14 days from today\)\./);
  assert.doesNotMatch(text, /Skill scores/, 'no scores are listed before a skill is tested');
});

test('the exam day and an exam already passed are said as such', () => {
  assert.match(context.learnerContext({ profile, skills: {}, mistakes: [], today: '2026-12-01' }), /\(today\)/);
  assert.match(context.learnerContext({ profile, skills: {}, mistakes: [], today: '2026-12-03' }), /\(already passed\)/);
});

test('the scores are rounded, and the weakest skill is named', () => {
  const text = context.learnerContext({ profile, skills: { reading: 62.4, listening: 48, writing: 55, speaking: 41.6 }, mistakes: [], today: '2026-11-17' });
  // The skills come in their fixed order. The weakest is the lowest raw score, here speaking at 41.6.
  assert.match(text, /Skill scores out of 100: reading 62, listening 48, speaking 42, writing 55\. Weakest: speaking\./);
});

test('the answers to review are written as the sentence with its gap and the right answer', () => {
  const text = context.learnerContext({
    profile: { ...profile, exam_date: null, exam_name: null },
    skills: {},
    mistakes: [
      cloze('a', 'She {{goes}} to school every day.'),
      {
        item_key: 'b',
        skill: 'language',
        payload: { question: { id: 'b', type: 'choice', skill: 'language', prompt: 'Pick the article', options: ['a', 'an', 'the'], answer: 1 } },
        ease: 2.5,
        interval_days: 0,
        reps: 0,
        due_at: '2026-11-01T09:00:00Z',
      },
    ],
    today: '2026-11-17',
  });
  assert.match(text, /Answers to review, newest first: "She ___ to school every day\." \(answer: goes\); "Pick the article" \(answer: an\)\./);
});

test('only the six newest answers to review are listed, and the whole context stays short', () => {
  const mistakes = Array.from({ length: 12 }, (_, index) => cloze(`m${index}`, `Sentence ${index} {{word}} here.`));
  const text = context.learnerContext({ profile, skills: {}, mistakes, today: '2026-11-17' });
  assert.equal((text.match(/Sentence \d+ ___ here/g) || []).length, 6);
  const long = context.learnerContext({
    profile: { ...profile, exam_name: 'x'.repeat(300) },
    skills: {},
    mistakes: Array.from({ length: 6 }, (_, index) => cloze(`l${index}`, `${'y'.repeat(300)} {{word${index}}}`)),
    today: '2026-11-17',
  });
  assert.ok(long.length <= 1400, 'the context is kept within its limit');
});

test('a learner with no record yet gets the level and the goal, and nothing else is invented', () => {
  const text = context.learnerContext({ profile: { ...profile, goal: 'english', exam_date: null, exam_name: null }, skills: {}, mistakes: [], today: '2026-11-17' });
  assert.match(text, /Level B1\. Studying for general English\./);
  assert.doesNotMatch(text, /Exam:|Skill scores|Answers to review/);
});
