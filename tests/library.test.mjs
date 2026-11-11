// Tests the library helpers (src/lib/library.ts): the file kinds the library keeps, cutting text
// into pieces, and choosing the passages the tutor reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText, kindForFile, selectPassages, tutorExcerpts } from '../src/lib/library.ts';

test('the library keeps only PDF, TXT and Markdown files', () => {
  assert.equal(kindForFile('Unit 3.PDF', ''), 'pdf');
  assert.equal(kindForFile('notes.md', ''), 'md');
  assert.equal(kindForFile('notes.markdown', ''), 'md');
  assert.equal(kindForFile('essay.txt', 'text/plain'), 'txt');
  assert.equal(kindForFile('photo.png', 'image/png'), null);
  assert.equal(kindForFile('page.html', 'text/html'), null);
});

test('text is cut into overlapping pieces that cover all of it', () => {
  const words = Array.from({ length: 900 }, (_, index) => `word${index}`).join(' ');
  const pieces = chunkText(words, 500, 60);
  assert.ok(pieces.length > 3);
  assert.ok(pieces.every((piece) => piece.length <= 520));
  assert.ok(pieces[0].startsWith('word0 '));
  assert.ok(pieces[pieces.length - 1].endsWith('word899'));
});

test('a small selection is read whole, in order', () => {
  const passages = selectPassages('anything', [
    { name: 'a.txt', text: 'First part.' },
    { name: 'b.md', text: 'Second part.' },
  ]);
  assert.deepEqual(passages, [
    { file: 'a.txt', text: 'First part.' },
    { file: 'b.md', text: 'Second part.' },
  ]);
});

test('a large selection keeps the passage that matches the question, even far from the start', () => {
  const filler = 'The weather was mild and the market was busy. '.repeat(400);
  const relevant = 'The past perfect tense describes an action that finished before another past action.';
  const text = `${filler}\n\n${relevant}\n\n${filler}`;
  const passages = selectPassages('How is the past perfect tense used?', [{ name: 'grammar.md', text }], 1500);
  assert.ok(passages.some((passage) => passage.text.includes('past perfect tense')));
  assert.ok(passages.reduce((sum, passage) => sum + passage.text.length, 0) <= 1500);
});

test('when no word of the question matches, the tutor still gets the start of the text', () => {
  const text = 'Alpha beta gamma. '.repeat(300);
  const passages = selectPassages('zebra', [{ name: 'short.txt', text }], 1000);
  assert.ok(passages.length >= 1, 'the tutor still gets some text');
  assert.ok(passages[0].text.startsWith('Alpha beta gamma.'), 'starting from the beginning of the file');
});

test('the tutor excerpts name the file each piece comes from', () => {
  const excerpts = tutorExcerpts('What is a noun?', [{ name: 'Grammar.txt', text: 'A noun names a person, place or thing.' }]);
  assert.match(excerpts, /^\[Grammar\.txt\]/);
});
