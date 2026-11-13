// Checks the practice lessons (src/content/units/practice*.ts) on both tracks, the general path and the TOEFL
// warm-up: each unit has its grammar drill, reading passage and listening passage in order, the passages and
// transcripts are long enough, every drill has one blank, and the warm-up test leaves its grammar drills out. The content is TypeScript with extensionless imports, so Vite
// loads it the same way the app does.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let roadmap;
let content;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  roadmap = await server.ssrLoadModule('/src/content/roadmap.ts');
  content = await server.ssrLoadModule('/src/content/index.ts');
});

after(async () => {
  await server?.close();
});

const lessonOf = (unit, suffix) => unit.lessons.find((lesson) => lesson.id === `${unit.id}-${suffix}`);
const words = (text) => text.trim().split(/\s+/).length;

// The general path asks for shorter passages at A1. The TOEFL passages are academic, so they are longer.
const tracks = () => [
  { units: roadmap.UNITS, minimumPassage: (unit) => (unit.level === 'A1' ? 45 : 60), minimumTranscript: 25 },
  { units: roadmap.TOEFL_UNITS, minimumPassage: () => 80, minimumTranscript: 60 },
];

test('every unit, on both tracks, has its practice in order before its vocabulary, which comes last', () => {
  // Grammar, reading, listening, then the extra reading, listening, writing and speaking, then the vocabulary.
  const order = ['grammar', 'reading', 'listening', 'reading-2', 'listening-2', 'writing', 'speaking', 'words'];
  const skills = ['language', 'reading', 'listening', 'reading', 'listening', 'writing', 'speaking', 'language'];
  for (const unit of [...roadmap.UNITS, ...roadmap.TOEFL_UNITS]) {
    const ids = unit.lessons.map((lesson) => lesson.id);
    const start = ids.indexOf(`${unit.id}-grammar`);
    assert.ok(start > 0, `${unit.id} has its grammar practice after its own lessons`);
    assert.deepEqual(
      ids.slice(start, start + order.length),
      order.map((part) => `${unit.id}-${part}`),
      `${unit.id}: the practice is in order, and the vocabulary comes last`,
    );
    assert.deepEqual(
      unit.lessons.slice(start, start + order.length).map((lesson) => lesson.skill),
      skills,
      `${unit.id}: each lesson has the skill of its part`,
    );
  }
});

test('each grammar drill has eight questions, one blank each, and options that differ, on both tracks', () => {
  for (const { units } of tracks()) {
    for (const unit of units) {
      const grammar = lessonOf(unit, 'grammar');
      assert.equal(grammar.questions.length, 8, `${unit.id} has eight drills`);
      for (const question of grammar.questions) {
        assert.equal(question.type, 'choice', `${unit.id}: drills are multiple choice`);
        assert.equal((question.prompt.match(/___/g) ?? []).length, 1, `${unit.id}: one blank in “${question.prompt}”`);
        assert.equal(new Set(question.options).size, question.options.length, `${unit.id}: options must differ`);
      }
    }
  }
});

test('each reading practice has one passage long enough for its track, and every question points to it', () => {
  const problems = [];
  for (const { units, minimumPassage } of tracks()) {
    for (const unit of units) {
      const reading = lessonOf(unit, 'reading');
      if (reading.passages.length !== 1) problems.push(`${unit.id}: one passage`);
      const passage = reading.passages[0];
      const minimum = minimumPassage(unit);
      if (words(passage.text) < minimum) problems.push(`${unit.id}: the passage has ${words(passage.text)} words, at least ${minimum} needed`);
      if (reading.questions.length !== 4) problems.push(`${unit.id}: four questions`);
      for (const question of reading.questions) {
        if (question.passageId !== passage.id) problems.push(`${unit.id}: “${question.prompt}” does not point to the passage`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('each listening practice has four questions, and every transcript is long enough for its track', () => {
  const problems = [];
  for (const { units, minimumTranscript } of tracks()) {
    for (const unit of units) {
      const listening = lessonOf(unit, 'listening');
      if (listening.questions.length !== 4) problems.push(`${unit.id}: four questions`);
      for (const question of listening.questions) {
        if (!question.listen) problems.push(`${unit.id}: “${question.prompt}” has no transcript`);
        else if (words(question.listen) < minimumTranscript) problems.push(`${unit.id}: the transcript has ${words(question.listen)} words, at least ${minimumTranscript} needed`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('the practice adds at least 300 questions to the general path', () => {
  let total = 0;
  for (const unit of roadmap.UNITS) {
    for (const lesson of unit.lessons) {
      if (/-(grammar|reading|listening)$/.test(lesson.id)) total += lesson.questions.length;
    }
  }
  assert.ok(total >= 300, `the practice has ${total} questions`);
});

test('the TOEFL warm-up draws on the new reading and listening practice, and leaves out the grammar drills', () => {
  const warmUp = content.bundledTest(content.TOEFL_TEST_ID);
  assert.ok(warmUp.questions.length >= 10, 'the warm-up has at least ten questions');
  assert.equal(warmUp.questions.filter((question) => /-grammar-\d+$/.test(question.id)).length, 0, 'the warm-up has a grammar drill');
  assert.ok(warmUp.questions.some((question) => /^tf-u\d-(reading|listening)-\d+$/.test(question.id)), 'the warm-up has no practice question');
});
