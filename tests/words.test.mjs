// Checks the vocabulary lists (src/content/units/words.ts): every word is written once in [brackets]
// in its example, every list has ten different meanings, and every unit of both paths has its lesson.
// The content is TypeScript with extensionless imports, so Vite loads it the same way the app does.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let words;
let roadmap;
let content;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  words = await server.ssrLoadModule('/src/content/units/words.ts');
  roadmap = await server.ssrLoadModule('/src/content/roadmap.ts');
  content = await server.ssrLoadModule('/src/content/index.ts');
});

after(async () => {
  await server?.close();
});

test('every word is one lower-case word, written once in [brackets] in its example', () => {
  const problems = [];
  for (const list of words.LISTS) {
    for (const [word, meaning, example] of list.words) {
      if (!/^[a-z]+$/.test(word)) problems.push(`${list.unitId}: “${word}” must be one lower-case word`);
      if (meaning.length <= 3) problems.push(`${list.unitId}: “${word}” needs a meaning`);
      const marks = example.split(`[${word}]`).length - 1;
      if (marks !== 1) problems.push(`${list.unitId}: “${word}” must appear once in [brackets] in: ${example}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('each list has ten different meanings, so every meaning question has three wrong answers', () => {
  for (const list of words.LISTS) {
    assert.equal(list.words.length, 10, `${list.unitId} has ten words`);
    const meanings = new Set(list.words.map(([, meaning]) => meaning));
    assert.equal(meanings.size, 10, `${list.unitId}: the meanings must differ`);
  }
});

test('each level has a vocabulary test that resolves, with at least twenty questions', () => {
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1']) {
    const test = content.bundledTest(content.wordsTestId(level));
    assert.ok(test, `${level} vocabulary test resolves`);
    assert.equal(test.kind, 'mock');
    assert.ok(test.questions.length >= 20, `${level}: ${test.questions.length} questions`);
  }
});

test('every unit of both paths has its vocabulary lesson at the end', () => {
  for (const unit of [...roadmap.UNITS, ...roadmap.TOEFL_UNITS]) {
    assert.ok(words.WORD_LESSONS[unit.id], `${unit.id} has no vocabulary list`);
    assert.equal(unit.lessons[unit.lessons.length - 1].id, `${unit.id}-words`, `${unit.id} ends with its vocabulary`);
  }
  assert.equal(words.LISTS.length, roadmap.UNITS.length + roadmap.TOEFL_UNITS.length);
});
