// Tests the retrieval behind the library coach (src/lib/retrieval.ts): words and stems, sections,
// ranking, the character budget, follow-up questions, several files, the fallback and the cache.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText, indexDocument, indexFor, retrieve, tokens } from '../src/lib/retrieval.ts';

test('text is cut into overlapping pieces that cover all of it', () => {
  const words = Array.from({ length: 900 }, (_, index) => `word${index}`).join(' ');
  const pieces = chunkText(words, 500, 60);
  assert.ok(pieces.length > 3);
  assert.ok(pieces.every((piece) => piece.length <= 520));
  assert.ok(pieces[0].startsWith('word0 '));
  assert.ok(pieces[pieces.length - 1].endsWith('word899'));
});

// Forty unrelated sections, then one about the past perfect.
const manySections = Array.from(
  { length: 40 },
  (_, index) => `## Topic ${index}\nThe market was busy on day ${index} and the weather stayed mild.`,
).join('\n\n');
const grammar = `${manySections}\n\n## Past perfect\nThe past perfect describes an action that finished before another past action.`;

test('words are lower case, stemmed, and common words and numbers are dropped', () => {
  assert.deepEqual(tokens('The studies were reading tenses 2024'), ['study', 'read', 'tense']);
  assert.deepEqual(tokens('She studied, then failed the test'), ['study', 'fail', 'test']);
});

test('sections keep their titles, and a piece never crosses a section', () => {
  const doc = indexDocument({
    id: 'g',
    name: 'grammar.md',
    text: '# Tenses\nTenses show time.\n\n## Present perfect\nUse have plus the past participle.\n\n## Past perfect\nIt describes an action before another past action.',
  });
  const sections = [...new Set(doc.pieces.map((piece) => piece.section))];
  assert.deepEqual(sections, ['Tenses', 'Present perfect', 'Past perfect']);
});

test('the passage that matches the question is found among many unrelated sections', () => {
  const index = indexDocument({ id: 'g', name: 'grammar.md', text: grammar });
  const result = retrieve('How is the past perfect used?', [index], [], 1500);
  assert.match(result.text, /\[grammar\.md · Past perfect\]/);
  assert.ok(result.text.includes('describes an action'));
  assert.deepEqual(result.files, ['grammar.md']);
});

test('the text sent to the coach stays within the character budget', () => {
  const big = Array.from({ length: 300 }, (_, index) => `## Part ${index}\nPast perfect practice number ${index}.`).join('\n\n');
  const index = indexDocument({ id: 'b', name: 'big.md', text: big });
  for (const budget of [1200, 3000, 9000]) {
    const result = retrieve('past perfect practice', [index], [], budget);
    assert.ok(result.text.length <= budget, `budget ${budget}: got ${result.text.length}`);
    assert.ok(result.passages > 0);
  }
});

test('a short follow-up borrows the words of the question before it', () => {
  const index = indexDocument({ id: 'g', name: 'grammar.md', text: grammar });
  const result = retrieve('Explain that again', [index], ['What is the past perfect tense?'], 1500);
  assert.ok(result.text.includes('describes an action'));
});

test('a question that names one file takes its passages from that file only, but every file gets a map', () => {
  const notes = indexDocument({ id: 'n', name: 'notes.txt', text: 'Photosynthesis turns light into chemical energy in leaves.' });
  const history = indexDocument({ id: 'h', name: 'history.md', text: '# Rome\nRome grew from a small city into an empire.' });
  const result = retrieve('How do plants use photosynthesis?', [notes, history], [], 2000);
  assert.deepEqual(result.files, ['notes.txt']);
  assert.match(result.text, /Files and sections:/);
  assert.ok(result.text.includes('[history.md · overview]'));
});

test('when no word matches, the coach still gets the start of each file', () => {
  const alpha = indexDocument({ id: 'a', name: 'alpha.txt', text: 'Alpha beta gamma. '.repeat(40) });
  const result = retrieve('zebra', [alpha], [], 1000);
  assert.ok(result.text.includes('Alpha beta gamma.'));
  assert.deepEqual(result.files, ['alpha.txt']);
  assert.ok(result.text.length <= 1000);
});

test('files with no readable text give nothing to send', () => {
  const empty = indexDocument({ id: 'e', name: 'empty.txt', text: '   ' });
  const result = retrieve('anything', [empty]);
  assert.equal(result.text, '');
  assert.deepEqual(result.files, []);
  assert.equal(result.passages, 0);
});

test('an index is built once and reused while the file does not change', () => {
  const doc = { id: 'c', name: 'c.txt', text: 'Hello world, this is a short text about cooking.' };
  assert.equal(indexFor(doc), indexFor({ ...doc }));
});
