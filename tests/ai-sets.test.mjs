// Checks the sets the AI writes (src/lib/ai.ts): the right option stays the right option when the list is
// moved, the answers do not all sit in the same place, and a set with too few valid questions is refused.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let ai;
let placement;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  ai = await server.ssrLoadModule('/src/lib/ai.ts');
  placement = await server.ssrLoadModule('/src/lib/placement.ts');
});

after(async () => {
  await server?.close();
});

// Ten questions as a model often writes them: the right option first, and answer 0.
const modelSet = {
  title: 'Everyday English',
  description: 'Ten questions',
  minutes: 8,
  passages: [],
  questions: Array.from({ length: 10 }, (_, index) => ({
    id: `q${index + 1}`,
    skill: 'language',
    prompt: `Choose the right word for item ${index + 1}.`,
    explanation: 'The right word fits the sentence.',
    type: 'choice',
    options: [`right ${index + 1}`, `wrong ${index + 1} a`, `wrong ${index + 1} b`, `wrong ${index + 1} c`],
    answer: 0,
  })),
};

test('the right option is still the right option after the list is placed', () => {
  const set = ai.validateGeneratedTest(modelSet, 'language');
  set.content.questions.forEach((question, index) => {
    assert.equal(question.options[question.answer], `right ${index + 1}`, `question ${index + 1} keeps its right option`);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options).size, question.options.length, 'no option is repeated');
  });
});

test('the right answers of an AI set do not all sit in one place', () => {
  const set = ai.validateGeneratedTest(modelSet, 'language');
  const positions = new Set(set.content.questions.map((question) => question.answer));
  assert.ok(positions.size >= 3, `the right answers sit at ${[...positions].sort().join(', ')}`);
});

test('the placement is the same on every run', () => {
  const first = ai.validateGeneratedTest(modelSet, 'language').content.questions.map((question) => question.answer);
  const second = ai.validateGeneratedTest(modelSet, 'language').content.questions.map((question) => question.answer);
  assert.deepEqual(first, second);
});

test('a placed list keeps the order of the wrong options', () => {
  const placed = placement.placeAnswer(['right', 'wrong a', 'wrong b', 'wrong c'], 0, 'a question');
  assert.deepEqual(placed.options.filter((option) => option !== 'right'), ['wrong a', 'wrong b', 'wrong c']);
  assert.equal(placed.options[placed.answer], 'right');
});

test('a set with fewer than three valid questions is refused', () => {
  const broken = { ...modelSet, questions: modelSet.questions.slice(0, 2) };
  assert.throws(() => ai.validateGeneratedTest(broken, 'language'), /did not contain enough valid questions/);
});
