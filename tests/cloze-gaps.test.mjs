// The fill-in-the-gaps questions: a phrase is typed with its space ("would have"), and a wrong gap shows its answer
// right after what was typed, without an empty box in between.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const question = readFileSync(join(root, 'src', 'components', 'Question.tsx'), 'utf8');
let server;
let grading;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
  grading = await server.ssrLoadModule('/src/lib/grading.ts');
});

after(async () => {
  await server?.close();
});

const cloze = { id: 'cloze-test', type: 'cloze', skill: 'language', text: 'If they had asked for help, we {{would have}} helped them.' };

test('a phrase is marked right with or without its space, and a different word is not', () => {
  assert.deepEqual(grading.gradeCloze(cloze, ['would have']).correct, [true]);
  assert.deepEqual(grading.gradeCloze(cloze, ['wouldhave']).correct, [true]);
  assert.deepEqual(grading.gradeCloze(cloze, ['would']).correct, [false]);
});

test('the gap keeps the spaces that are typed; only the ones before the first letter are dropped', () => {
  assert.doesNotMatch(question, /replace\(\/\\s\/g, ''\)/, 'no space is removed while typing');
  assert.match(question, /replace\(\/\^\\s\+\/, ''\)/, 'the leading spaces are dropped');
});

test('a wrong gap is only as wide as what was typed, and its answer sits right after it', () => {
  assert.match(question, /wrong \? Math\.max\(typed\.length, 1\) : remaining/);
  assert.match(question, /\{wrong && <span className="blank__answer">/);
});
