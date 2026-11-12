// Checks the bundled lessons (src/content): every item is well formed, ids are unique and short
// enough for the database, the path has every level, and the tests resolve. The content is TypeScript
// with extensionless imports, so Vite loads it the same way the app does.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let content;
let types;
let roadmap;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  content = await server.ssrLoadModule('/src/content/index.ts');
  types = await server.ssrLoadModule('/src/lib/types.ts');
  roadmap = await server.ssrLoadModule('/src/lib/roadmap.ts');
});

after(async () => {
  await server?.close();
});

const generalLessons = () => content.PATH.filter((item) => !item.checkpoint).map((item) => item.lesson);
const toeflLessons = () => content.toeflLessons();
const allLessons = () => [...content.PATH.map((item) => item.lesson), ...toeflLessons()];

test('every lesson id is unique and fits the database limit of 40 characters', () => {
  const ids = allLessons().map((lesson) => lesson.id);
  assert.equal(new Set(ids).size, ids.length, 'lesson ids must be unique');
  for (const id of ids) assert.ok(id.length <= 40, `${id} is longer than 40 characters`);
});

test('every lesson has a title, a blurb and questions, and every question skill matches its lesson', () => {
  for (const lesson of allLessons()) {
    assert.ok(lesson.title.trim(), `${lesson.id} has no title`);
    assert.ok(lesson.blurb.trim(), `${lesson.id} has no blurb`);
    // Writing and speaking lessons have two or three long prompts; the other lessons have more items.
    const minimum = lesson.skill === 'writing' || lesson.skill === 'speaking' ? 2 : 3;
    assert.ok(lesson.questions.length >= minimum, `${lesson.id} needs at least ${minimum} questions`);
    const ids = lesson.questions.map((question) => question.id);
    assert.equal(new Set(ids).size, ids.length, `${lesson.id} has repeated question ids`);
    // A unit check mixes the skills of its lessons on purpose, so only real lessons have one skill.
    if (lesson.id.endsWith('-check')) continue;
    for (const question of lesson.questions) {
      assert.equal(question.skill, lesson.skill, `${question.id} is not the skill of ${lesson.id}`);
    }
  }
});

test('every multiple-choice item has a prompt, three to five options and a valid answer', () => {
  for (const lesson of allLessons()) {
    for (const question of lesson.questions.filter((item) => item.type === 'choice')) {
      assert.ok(question.prompt.trim(), `${question.id} has no prompt`);
      assert.ok(question.options.length >= 3 && question.options.length <= 5, `${question.id} needs three to five options`);
      assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.options.length, `${question.id} has a bad answer`);
      assert.equal(new Set(question.options).size, question.options.length, `${question.id} repeats an option`);
      assert.doesNotMatch(question.prompt + question.options.join(' '), /undefined|NaN/, `${question.id} has a broken word`);
    }
  }
});

test('the right answers are spread over the positions, so no letter is the answer most of the time', () => {
  // One row of counts for each number of options: most items have three, and the vocabulary meanings have four.
  const rows = new Map();
  for (const lesson of allLessons()) {
    for (const question of lesson.questions.filter((item) => item.type === 'choice')) {
      const size = question.options.length;
      const row = rows.get(size) ?? new Array(size).fill(0);
      row[question.answer] += 1;
      rows.set(size, row);
    }
  }
  for (const [size, row] of rows) {
    const total = row.reduce((sum, count) => sum + count, 0);
    for (const count of row) assert.ok(count / total >= 0.5 / size, `with ${size} options the right answers sit at ${row.join(', ')}`);
  }
});

test('every gap-fill item has at least one blank, and every blank has a word', () => {
  for (const lesson of allLessons()) {
    for (const question of lesson.questions.filter((item) => item.type === 'cloze')) {
      const blanks = question.text.match(/\{\{[^{}]+\}\}/g) ?? [];
      assert.ok(blanks.length >= 1, `${question.id} has no blank`);
      for (const blank of blanks) assert.ok(blank.slice(2, -2).trim().length > 0, `${question.id} has an empty blank`);
    }
  }
});

test('ordering items have at least three words, and writing and speaking items have a length and a rubric', () => {
  for (const lesson of allLessons()) {
    for (const question of lesson.questions) {
      if (question.type === 'reorder') assert.ok(question.answer.split(/\s+/).length >= 3, `${question.id} is too short`);
      if (question.type === 'writing') {
        assert.ok(question.minWords >= 25 && question.minWords <= 300, `${question.id} has a bad word count`);
        assert.ok(question.rubric.length >= 2 && question.rubric.length <= 4, `${question.id} needs two to four criteria`);
      }
      if (question.type === 'speaking') {
        assert.ok(question.seconds >= 30 && question.seconds <= 60, `${question.id} has a bad time limit`);
        assert.ok(question.rubric.length >= 2 && question.rubric.length <= 4, `${question.id} needs two to four criteria`);
      }
    }
  }
});

test('every passage a question points to is in its lesson, and every listening item has a transcript', () => {
  for (const lesson of allLessons()) {
    const passages = new Set(lesson.passages.map((passage) => passage.id));
    for (const question of lesson.questions) {
      if (question.passageId) assert.ok(passages.has(question.passageId), `${question.id} points to a missing passage`);
      if (lesson.skill === 'listening') assert.ok(question.listen && question.listen.length > 20, `${question.id} needs a transcript`);
    }
  }
});

test('the general path covers every level from A1 to C1, with at least three lessons in each unit', () => {
  const levels = new Set(content.UNITS.map((unit) => unit.level));
  assert.deepEqual([...levels].sort(), [...types.LEVELS].sort());
  for (const unit of content.UNITS) assert.ok(unit.lessons.length >= 3, `${unit.id} needs at least three lessons`);
  assert.deepEqual(
    content.UNITS.map((unit) => unit.number),
    content.UNITS.map((_, index) => index + 1),
    'unit numbers run in order',
  );
});

test('the general path has many more lessons than before, and every level has enough questions', () => {
  const lessons = generalLessons();
  assert.ok(lessons.length >= 60, `expected at least 60 lessons, found ${lessons.length}`);
  for (const level of types.LEVELS) {
    const count = content.UNITS.filter((unit) => unit.level === level).reduce((sum, unit) => sum + unit.lessons.reduce((inner, lesson) => inner + lesson.questions.length, 0), 0);
    assert.ok(count >= 60, `${level} has only ${count} questions`);
  }
});

test('the TOEFL warm-up is a separate track with reading, listening, speaking and writing', () => {
  const skills = new Set(toeflLessons().map((lesson) => lesson.skill));
  for (const skill of ['reading', 'listening', 'speaking', 'writing']) assert.ok(skills.has(skill), `the warm-up needs ${skill}`);
  assert.ok(content.TOEFL_UNITS.length >= 3);
  assert.equal(content.PATH.some((item) => item.lesson.id.startsWith('tf-')), false, 'the warm-up is not on the general path');
});

test('every level test and the TOEFL test resolve and have questions', () => {
  for (const level of types.LEVELS) {
    const test = content.bundledTest(content.levelTestId(level));
    assert.ok(test, `${level} level test is missing`);
    assert.equal(test.kind, 'mock');
    assert.ok(test.questions.length >= 10, `${level} level test is too short`);
  }
  const toefl = content.bundledTest(content.TOEFL_TEST_ID);
  assert.ok(toefl && toefl.questions.length >= 10);
  assert.ok(content.bundledTest(content.DIAGNOSTIC_ID), 'the level check is missing');
});

test('every lesson and check resolves by its id, and a unit check mixes its lessons', () => {
  for (const lesson of allLessons()) {
    const test = content.bundledTest(lesson.id);
    assert.ok(test, `${lesson.id} does not resolve`);
    assert.equal(test.questions.length, lesson.questions.length);
  }
  for (const item of content.PATH.filter((entry) => entry.checkpoint)) {
    const test = content.bundledTest(item.lesson.id);
    assert.equal(test.kind, 'checkpoint');
    assert.ok(test.questions.length <= item.unit.lessons.length * 4);
  }
});

test('placement marks every lesson of the levels below as done, and nothing of the chosen level', () => {
  const placed = (level) => new Set(roadmap.placementRows(level).map((row) => row.lesson_id));
  assert.equal(placed('A1').size, 0, 'an A1 learner starts at the beginning');
  const b1 = placed('B1');
  for (const item of content.PATH.filter((entry) => entry.unit.level === 'A1' || entry.unit.level === 'A2')) {
    assert.ok(b1.has(item.lesson.id), `${item.lesson.id} should be done for B1`);
  }
  for (const item of content.PATH.filter((entry) => entry.unit.level === 'B1')) {
    assert.equal(b1.has(item.lesson.id), false, `${item.lesson.id} is in the chosen level`);
  }
});
