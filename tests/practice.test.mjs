// Checks the practice lessons of the general path (src/content/units/practice*.ts): each unit has its
// grammar drill, reading passage and listening passage in order, the passages and transcripts are
// long enough, every grammar drill has one blank, and the path has enough practice in total.
// The content is TypeScript with extensionless imports, so Vite loads it the same way the app does.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let roadmap;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  roadmap = await server.ssrLoadModule('/src/content/roadmap.ts');
});

after(async () => {
  await server?.close();
});

const lessonOf = (unit, suffix) => unit.lessons.find((lesson) => lesson.id === `${unit.id}-${suffix}`);
const words = (text) => text.trim().split(/\s+/).length;

test('every general unit has grammar, reading and listening practice, in that order, before its vocabulary', () => {
  for (const unit of roadmap.UNITS) {
    const ids = unit.lessons.map((lesson) => lesson.id);
    const start = ids.indexOf(`${unit.id}-grammar`);
    assert.ok(start > 0, `${unit.id} has its grammar practice after its own lessons`);
    assert.equal(ids[start + 1], `${unit.id}-reading`, `${unit.id}: reading follows grammar`);
    assert.equal(ids[start + 2], `${unit.id}-listening`, `${unit.id}: listening follows reading`);
    assert.equal(ids[start + 3], `${unit.id}-words`, `${unit.id}: vocabulary comes last`);
    assert.equal(unit.lessons[start].skill, 'language');
    assert.equal(unit.lessons[start + 1].skill, 'reading');
    assert.equal(unit.lessons[start + 2].skill, 'listening');
  }
});

test('each grammar drill has eight questions, one blank each, and options that differ', () => {
  for (const unit of roadmap.UNITS) {
    const grammar = lessonOf(unit, 'grammar');
    assert.equal(grammar.questions.length, 8, `${unit.id} has eight drills`);
    for (const question of grammar.questions) {
      assert.equal(question.type, 'choice', `${unit.id}: drills are multiple choice`);
      assert.equal((question.prompt.match(/___/g) ?? []).length, 1, `${unit.id}: one blank in “${question.prompt}”`);
      assert.equal(new Set(question.options).size, question.options.length, `${unit.id}: options must differ`);
    }
  }
});

test('each reading practice has a passage long enough for its level, and every question points to it', () => {
  const problems = [];
  for (const unit of roadmap.UNITS) {
    const reading = lessonOf(unit, 'reading');
    if (reading.passages.length !== 1) problems.push(`${unit.id}: one passage`);
    const passage = reading.passages[0];
    // A1 passages are shorter by design: at least forty-five words, and sixty from A2 upward.
    const minimum = unit.level === 'A1' ? 45 : 60;
    if (words(passage.text) < minimum) problems.push(`${unit.id}: the passage has ${words(passage.text)} words, at least ${minimum} needed`);
    if (reading.questions.length !== 4) problems.push(`${unit.id}: four questions`);
    for (const question of reading.questions) {
      if (question.passageId !== passage.id) problems.push(`${unit.id}: “${question.prompt}” does not point to the passage`);
    }
  }
  assert.deepEqual(problems, []);
});

test('each listening practice has four questions, and every question carries a transcript of at least twenty-five words', () => {
  for (const unit of roadmap.UNITS) {
    const listening = lessonOf(unit, 'listening');
    assert.equal(listening.questions.length, 4, `${unit.id}: four questions`);
    for (const question of listening.questions) {
      assert.ok(question.listen, `${unit.id}: “${question.prompt}” has a transcript`);
      assert.ok(words(question.listen) >= 25, `${unit.id}: the transcript has ${words(question.listen)} words`);
    }
  }
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
