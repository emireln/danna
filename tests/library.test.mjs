// Tests the library helpers (src/lib/library.ts): the file kinds the library keeps. The text cutting
// and the passages the coach reads are tested in retrieval.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kindForFile } from '../src/lib/library.ts';

test('the library keeps only PDF, TXT and Markdown files', () => {
  assert.equal(kindForFile('Unit 3.PDF', ''), 'pdf');
  assert.equal(kindForFile('notes.md', ''), 'md');
  assert.equal(kindForFile('notes.markdown', ''), 'md');
  assert.equal(kindForFile('essay.txt', 'text/plain'), 'txt');
  assert.equal(kindForFile('photo.png', 'image/png'), null);
  assert.equal(kindForFile('page.html', 'text/html'), null);
});
